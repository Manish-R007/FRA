import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.schemas.scheme import SchemeRecommendationResponse
from app.schemas.dss import DSSQueryRequest, DSSQueryResponse, VillageConvergenceSummary
from app.services.dss_service import run_dss_for_claim, calculate_village_convergence, answer_dss_query
from app.services.rag_service import process_and_index_pdf
from app.services.audit_service import record_audit

router = APIRouter(prefix="/dss", tags=["Decision Support System & RAG"])

@router.post("/query", response_model=DSSQueryResponse)
def execute_dss_query(
    req: DSSQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified AI & Rules-Based Decision Support Query Engine.
    Answers natural language inquiries using claim spatial context, remote-sensing data,
    deterministic eligibility rules, and grounded RAG citations from official policy PDFs.
    """
    return answer_dss_query(db, req)

@router.get("/recommendations/{claim_id}", response_model=List[SchemeRecommendationResponse])
def get_claim_recommendations(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    claim = db.query(FRAClaim).filter(FRAClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    return run_dss_for_claim(db, claim_id)

@router.get("/villages/convergence", response_model=List[VillageConvergenceSummary])
def get_village_convergence_map(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculates village-level convergence priority metrics for DSS Map visualization.
    """
    return calculate_village_convergence(db, district=district)

@router.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_policy_document(
    file: UploadFile = File(...),
    document_name: str = Form(...),
    scheme_code: Optional[str] = Form(None),
    document_type: str = Form("POLICY_GUIDELINE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF policy documents are supported for RAG indexing")

    policy_dir = os.path.join(settings.UPLOAD_DIR, "policies")
    os.makedirs(policy_dir, exist_ok=True)
    file_path = os.path.join(policy_dir, file.filename)

    with open(file_path, "wb") as buf:
        content = await file.read()
        buf.write(content)

    doc = process_and_index_pdf(
        db=db,
        file_path=file_path,
        document_name=document_name,
        scheme_code=scheme_code,
        document_type=document_type
    )

    record_audit(db, action="UPLOAD_RAG_POLICY", entity="DSSDocument", entity_id=str(doc.id), user_id=current_user.id, new_value={"name": doc.name, "scheme_code": scheme_code})

    return {"message": "Policy document successfully indexed into RAG vector repository", "document_id": doc.id}
