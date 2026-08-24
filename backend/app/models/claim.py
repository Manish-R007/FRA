from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from app.core.database import Base

class FRAClaim(Base):
    __tablename__ = "fra_claims"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(String(100), unique=True, index=True, nullable=False)
    claim_type = Column(String(20), nullable=False)  # IFR, CR, CFR
    applicant_name = Column(String(255), nullable=False)
    father_or_husband_name = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    village = Column(String(100), nullable=False, index=True)
    block = Column(String(100), nullable=True, index=True)
    district = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    survey_number = Column(String(100), nullable=True)
    area_claimed = Column(Float, nullable=False)  # Area in standard hectares
    area_unit = Column(String(20), default="hectares")
    land_use = Column(String(100), nullable=True)  # e.g., Agriculture, Homestead, Forest Produce
    application_date = Column(String(50), nullable=True)
    status = Column(String(50), default="UPLOADED")  # UPLOADED, OCR_PROCESSED, PENDING_VERIFICATION, FIELD_VERIFICATION, GIS_VALIDATED, SATELLITE_ANALYZE, APPROVED, REJECTED
    verification_status = Column(String(50), default="UNVERIFIED")  # UNVERIFIED, VERIFIED, REJECTED, FLAGGED
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
