from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentFieldSchema(BaseModel):
    id: Optional[int] = None
    field_name: str
    field_value: Optional[str] = None
    confidence: float = 1.0
    source: str = "OCR_LLM"

class DocumentResponse(BaseModel):
    id: int
    claim_id: Optional[int] = None
    file_name: str
    file_url: str
    document_type: str
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    processing_status: str
    uploaded_by: Optional[int] = None
    created_at: Optional[datetime] = None
    fields: Optional[List[DocumentFieldSchema]] = []

    class Config:
        from_attributes = True

class DocumentVerificationRequest(BaseModel):
    action: str  # CONFIRM, REJECT, UPDATE
    fields: Optional[List[DocumentFieldSchema]] = None
    rejection_reason: Optional[str] = None

class LLMExtractedDocument(BaseModel):
    claim_id: Optional[str] = None
    applicant_name: Optional[str] = None
    father_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    village: Optional[str] = None
    block: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    claim_type: Optional[str] = None
    area: Optional[float] = None
    survey_number: Optional[str] = None
    land_use: Optional[str] = None
    application_date: Optional[str] = None
    coordinates: Optional[List[float]] = None
    field_confidences: Optional[Dict[str, float]] = {}
