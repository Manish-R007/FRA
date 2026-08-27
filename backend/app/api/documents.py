import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.document import Document, DocumentField
from app.schemas.document import DocumentResponse, DocumentVerificationRequest, DocumentFieldSchema
from app.services.ocr_service import perform_ocr
from app.services.llm_extractor import extract_structured_data
from app.services.audit_service import record_audit

router = APIRouter(prefix="/documents", tags=["Documents & OCR"])

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("FRA_PATTA"),
    claim_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, PNG, JPG, JPEG."
        )

    # 2. Sanitize filename and save securely
    doc_dir = os.path.join(settings.UPLOAD_DIR, "documents")
    os.makedirs(doc_dir, exist_ok=True)

    safe_filename = f"{int(os.path.getmtime(settings.UPLOAD_DIR) if os.path.exists(settings.UPLOAD_DIR) else 1)}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(doc_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File size exceeds maximum 25 MB limit")
        buffer.write(content)

    # 3. Create Document DB record
    doc = Document(
        claim_id=claim_id,
        file_name=file.filename,
        file_url=f"/uploads/documents/{safe_filename}",
        document_type=document_type,
        processing_status="PROCESSING",
        uploaded_by=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 4. Perform OCR
    ocr_res = perform_ocr(file_path)
    doc.ocr_text = ocr_res.get("text", "")
    doc.ocr_confidence = ocr_res.get("confidence", 0.85)

    # 5. Perform Structured LLM Extraction
    structured = await extract_structured_data(doc.ocr_text)

    # 6. Store extracted fields into document_fields table
    extracted_fields = [
        ("claim_id", structured.claim_id, structured.field_confidences.get("claim_id", 0.95)),
        ("applicant_name", structured.applicant_name, structured.field_confidences.get("applicant_name", 0.92)),
        ("father_name", structured.father_name, structured.field_confidences.get("father_name", 0.90)),
        ("age", str(structured.age) if structured.age else None, structured.field_confidences.get("age", 0.90)),
        ("gender", structured.gender, structured.field_confidences.get("gender", 0.90)),
        ("village", structured.village, structured.field_confidences.get("village", 0.92)),
        ("block", structured.block, structured.field_confidences.get("block", 0.88)),
        ("district", structured.district, structured.field_confidences.get("district", 0.94)),
        ("state", structured.state, structured.field_confidences.get("state", 0.95)),
        ("claim_type", structured.claim_type, structured.field_confidences.get("claim_type", 0.95)),
        ("area", str(structured.area) if structured.area else None, structured.field_confidences.get("area", 0.92)),
        ("survey_number", structured.survey_number, structured.field_confidences.get("survey_number", 0.90)),
        ("land_use", structured.land_use, structured.field_confidences.get("land_use", 0.85)),
        ("application_date", structured.application_date, structured.field_confidences.get("application_date", 0.90)),
    ]

    field_schemas = []
    for f_name, f_val, f_conf in extracted_fields:
        if f_val is not None:
            df = DocumentField(
                document_id=doc.id,
                field_name=f_name,
                field_value=str(f_val),
                confidence=f_conf,
                source="OCR_LLM"
            )
            db.add(df)
            db.commit()
            db.refresh(df)
            field_schemas.append(DocumentFieldSchema(
                id=df.id,
                field_name=df.field_name,
                field_value=df.field_value,
                confidence=df.confidence,
                source=df.source
            ))

    doc.processing_status = "COMPLETED"
    db.commit()
    db.refresh(doc)

    record_audit(db, action="UPLOAD_DOCUMENT_OCR", entity="Document", entity_id=str(doc.id), user_id=current_user.id, new_value={"file_name": doc.file_name, "extracted_fields_count": len(field_schemas)})

    resp = DocumentResponse.model_validate(doc)
    resp.fields = field_schemas
    return resp

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    fields = db.query(DocumentField).filter(DocumentField.document_id == doc.id).all()
    resp = DocumentResponse.model_validate(doc)
    resp.fields = [DocumentFieldSchema.model_validate(f) for f in fields]
    return resp

@router.patch("/{document_id}/verify", response_model=DocumentResponse)
def verify_document(
    document_id: int,
    verify_req: DocumentVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if verify_req.action == "REJECT":
        doc.processing_status = "REJECTED"
        if doc.claim_id:
            claim = db.query(FRAClaim).filter(FRAClaim.id == doc.claim_id).first()
            if claim:
                claim.verification_status = "REJECTED"
        db.commit()
        record_audit(db, action="REJECT_DOCUMENT", entity="Document", entity_id=str(doc.id), user_id=current_user.id, new_value={"reason": verify_req.rejection_reason})
    
    elif verify_req.action == "CONFIRM":
        doc.processing_status = "VERIFIED"

        # Update or create fields based on human edits
        fields_dict = {}
        if verify_req.fields:
            for f in verify_req.fields:
                fields_dict[f.field_name] = f.field_value
                existing_df = db.query(DocumentField).filter(
                    DocumentField.document_id == doc.id,
                    DocumentField.field_name == f.field_name
                ).first()
                if existing_df:
                    existing_df.field_value = f.field_value
                    existing_df.source = "HUMAN_EDITED"
                    existing_df.confidence = 1.0
                else:
                    new_df = DocumentField(
                        document_id=doc.id,
                        field_name=f.field_name,
                        field_value=f.field_value,
                        confidence=1.0,
                        source="HUMAN_EDITED"
                    )
                    db.add(new_df)

        # Update or create associated FRAClaim
        claim_id_code = fields_dict.get("claim_id") or f"FRA-GEN-{doc.id:04d}"
        claim = None
        if doc.claim_id:
            claim = db.query(FRAClaim).filter(FRAClaim.id == doc.claim_id).first()
        else:
            claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_code).first()

        if not claim:
            claim = FRAClaim(
                claim_id=claim_id_code,
                claim_type=fields_dict.get("claim_type", "IFR"),
                applicant_name=fields_dict.get("applicant_name", "Applicant Name"),
                father_or_husband_name=fields_dict.get("father_name"),
                age=int(fields_dict["age"]) if fields_dict.get("age") and fields_dict["age"].isdigit() else None,
                gender=fields_dict.get("gender"),
                village=fields_dict.get("village", "Village"),
                block=fields_dict.get("block"),
                district=fields_dict.get("district", "District"),
                state=fields_dict.get("state", "State"),
                survey_number=fields_dict.get("survey_number"),
                area_claimed=float(fields_dict.get("area", 1.5)),
                area_unit="hectares",
                land_use=fields_dict.get("land_use", "Agriculture"),
                application_date=fields_dict.get("application_date"),
                status="PENDING_VERIFICATION",
                verification_status="VERIFIED",
                created_by=current_user.id
            )
            db.add(claim)
            db.commit()
            db.refresh(claim)
            doc.claim_id = claim.id
        else:
            if "applicant_name" in fields_dict: claim.applicant_name = fields_dict["applicant_name"]
            if "claim_type" in fields_dict: claim.claim_type = fields_dict["claim_type"]
            if "village" in fields_dict: claim.village = fields_dict["village"]
            if "district" in fields_dict: claim.district = fields_dict["district"]
            if "state" in fields_dict: claim.state = fields_dict["state"]
            if "area" in fields_dict and fields_dict["area"]: 
                try: claim.area_claimed = float(fields_dict["area"])
                except Exception: pass
            claim.verification_status = "VERIFIED"
            claim.status = "PENDING_VERIFICATION"

        db.commit()
        record_audit(db, action="VERIFY_DOCUMENT_CONFIRM", entity="Document", entity_id=str(doc.id), user_id=current_user.id, new_value={"claim_id": claim.claim_id, "status": "VERIFIED"})

    db.commit()
    db.refresh(doc)

    fields = db.query(DocumentField).filter(DocumentField.document_id == doc.id).all()
    resp = DocumentResponse.model_validate(doc)
    resp.fields = [DocumentFieldSchema.model_validate(f) for f in fields]
    return resp
