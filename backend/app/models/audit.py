from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)  # CREATE_CLAIM, VERIFY_DOCUMENT, UPDATE_GEOMETRY, RUN_SATELLITE, RUN_DSS, APPROVE_CLAIM
    entity = Column(String(100), nullable=False)  # FRAClaim, FRAGeometry, Document, SatelliteAnalysis, SchemeRecommendation
    entity_id = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    hash = Column(String(64), nullable=False, unique=True, index=True)  # SHA-256 block hash
    previous_hash = Column(String(64), nullable=False, index=True)  # SHA-256 parent hash forming hash chain
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ip_address = Column(String(50), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="INFO")  # INFO, SUCCESS, WARNING, ALERT
    read = Column(String(10), default="FALSE")  # "TRUE" or "FALSE"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
