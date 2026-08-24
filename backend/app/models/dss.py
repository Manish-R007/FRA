from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from app.core.database import Base

class DSSDocument(Base):
    __tablename__ = "dss_documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    document_type = Column(String(100), default="POLICY_GUIDELINE")  # POLICY_GUIDELINE, FRA_ACT, CIRCULAR, SCHEME_MANUAL
    scheme_code = Column(String(50), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DSSChunk(Base):
    __tablename__ = "dss_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("dss_documents.id"), nullable=False, index=True)
    chunk_text = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=False)
    section_title = Column(String(255), nullable=True)
    embedding = Column(Text, nullable=True)  # JSON vector list of floats for RAG cosine similarity
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
