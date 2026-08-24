# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from datetime import datetime, timezone
from app.core.database import Base

class Scheme(Base):
    __tablename__ = "schemes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)  # e.g., PM-KISAN, PMKSY, PMAY-G, JJM, VDVY
    code = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    eligibility_rules = Column(Text, nullable=False)  # JSON formatted deterministic rule definition
    benefits = Column(Text, nullable=False)
    documents_required = Column(Text, nullable=False)  # JSON list
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SchemeRecommendation(Base):
    __tablename__ = "scheme_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("fra_claims.id"), nullable=False, index=True)
    scheme_id = Column(Integer, ForeignKey("schemes.id"), nullable=False, index=True)
    eligibility_status = Column(String(50), nullable=False)  # ELIGIBLE, INELIGIBLE, CONDITIONAL
    eligibility_score = Column(Float, nullable=False)  # 0 to 100
    priority = Column(String(20), nullable=False)  # HIGH, MEDIUM, LOW
    reason = Column(Text, nullable=False)  # Step-by-step rule reasoning
    evidence = Column(Text, nullable=True)  # RAG citation: Scheme Document Name, Page X, text excerpt
    citation_page = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
