from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.audit import AuditLog, Notification
from app.schemas.audit import AuditLogResponse, AuditVerificationResult, NotificationResponse
from app.services.audit_service import verify_audit_chain

router = APIRouter(prefix="/audit", tags=["Cryptographic Audit Vault & Notifications"])

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    entity: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]))
):
    """
    Retrieves immutable cryptographic audit logs forming the SHA-256 hash chain.
    """
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    return logs

@router.get("/verify", response_model=AuditVerificationResult)
def verify_hash_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographically verifies the unbroken SHA-256 hash chain across all blocks from genesis.
    Returns proof of system integrity or flags any unauthorized tamper point.
    """
    result = verify_audit_chain(db)
    return AuditVerificationResult(**result)

@router.get("/notifications", response_model=List[NotificationResponse])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.id.desc()).limit(20).all()
    return notifications

@router.patch("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if notif:
        notif.read = "TRUE"
        db.commit()
    return {"message": "Notification marked as read"}
