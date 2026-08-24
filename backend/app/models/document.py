from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from app.core.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("fra_claims.id"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    document_type = Column(String(50), nullable=False)  # FRA_PATTA, TITLE_DEED, FORM_A, FORM_B, EVIDENCE, MAP
    ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    processing_status = Column(String(50), default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED, VERIFIED
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DocumentField(Base):
    __tablename__ = "document_fields"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_value = Column(Text, nullable=True)
    confidence = Column(Float, default=1.0)
    source = Column(String(50), default="OCR_LLM")  # OCR_LLM, HUMAN_EDITED, RULE_EXTRACTED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
