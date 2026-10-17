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
from app.schemas.dss import (
    DSSQueryRequest, 
    DSSQueryResponse, 
    DSSChatRequest, 
    DSSChatResponse, 
    VillageConvergenceSummary
)
from app.services.dss_service import (
    run_dss_for_claim, 
    calculate_village_convergence, 
    answer_dss_query,
    chat_dss_query
)
from app.services.rag_service import process_and_index_pdf, delete_policy_document
from app.services.audit_service import record_audit

router = APIRouter(prefix="/dss", tags=["Decision Support System & RAG"])

@router.post("/chat", response_model=DSSChatResponse)
def execute_dss_chat(
    req: DSSChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Conversational AI Decision Support Assistant powered by Groq LLM.
    Synthesizes live PostGIS claim geometries, Copernicus Sentinel-2 remote sensing indices
    (crop NDVI, canopy cover, water NDWI deficit), statutory scheme eligibility rules, and grounded RAG citations.
    """
    object.__setattr__(req, "_current_user", current_user)
    return chat_dss_query(db, req)

@router.post("/query", response_model=DSSQueryResponse)
def execute_dss_query(
    req: DSSQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified AI & Rules-Based Decision Support Query Engine (Legacy Single-Turn).
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
    state: Optional[str] = None,
    block: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculates village-level convergence priority metrics for DSS Map visualization.
    """
    return calculate_village_convergence(db, district=district, state=state, block=block, user=current_user)

@router.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_policy_document(
    file: UploadFile = File(...),
    document_name: str = Form(...),
    scheme_code: Optional[str] = Form(None),
    document_type: str = Form("POLICY_GUIDELINE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF policy documents are supported for RAG indexing")

    policy_dir = os.path.join(settings.UPLOAD_DIR, "policies")
    os.makedirs(policy_dir, exist_ok=True)
    safe_name = os.path.basename(file.filename).replace("..", "_")
    file_path = os.path.join(policy_dir, safe_name)

    with open(file_path, "wb") as buf:
        content = await file.read(25 * 1024 * 1024 + 1)
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Policy PDF exceeds 25 MB limit")
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


@router.delete("/documents/{document_id}")
def remove_policy_document(document_id: int, db: Session = Depends(get_db),
                           current_user: User = Depends(require_roles(["ADMIN"]))):
    from app.models.dss import DSSDocument
    document = db.query(DSSDocument).filter(DSSDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Policy document not found")
    old_name = document.name
    if not delete_policy_document(db, document_id):
        raise HTTPException(status_code=404, detail="Policy document not found")
    record_audit(db, action="DELETE_RAG_POLICY", entity="DSSDocument", entity_id=str(document_id),
                 user_id=current_user.id, old_value={"name": old_name})
    return {"message": "Policy document and its Chroma vectors were removed", "document_id": document_id}
