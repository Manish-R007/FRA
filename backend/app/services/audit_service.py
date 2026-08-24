import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def calculate_block_hash(
    previous_hash: str,
    user_id: int | None,
    action: str,
    entity: str,
    entity_id: str,
    timestamp: str,
    new_value: str | None
) -> str:
    """
    Computes a cryptographic SHA-256 hash forming an immutable block in the audit hash-chain.
    """
    raw_payload = f"{previous_hash}|{user_id}|{action}|{entity}|{entity_id}|{timestamp}|{new_value or ''}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

def record_audit(
    db: Session,
    action: str,
    entity: str,
    entity_id: str,
    user_id: int | None = None,
    old_value: dict | str | None = None,
    new_value: dict | str | None = None,
    ip_address: str | None = None
) -> AuditLog:
    """
    Appends a new cryptographically chained audit log entry into the database.
    """
    # Fetch the latest audit entry to get previous hash
    last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    previous_hash = last_log.hash if last_log else GENESIS_HASH
    
    old_val_str = json.dumps(old_value) if isinstance(old_value, dict) else (str(old_value) if old_value is not None else None)
    new_val_str = json.dumps(new_value) if isinstance(new_value, dict) else (str(new_value) if new_value is not None else None)
    
    now = datetime.now(timezone.utc)
    timestamp_str = now.isoformat()
    
    current_hash = calculate_block_hash(
        previous_hash=previous_hash,
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        timestamp=timestamp_str,
        new_value=new_val_str
    )
    
    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        old_value=old_val_str,
        new_value=new_val_str,
        hash=current_hash,
        previous_hash=previous_hash,
        created_at=now,
        ip_address=ip_address
    )
    
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry

def verify_audit_chain(db: Session) -> dict:
    """
    Verifies the entire cryptographic hash chain for integrity.
    Detects any database tampering or altered history.
    """
    logs = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    if not logs:
        return {
            "is_valid": True,
            "total_blocks": 0,
            "genesis_hash": GENESIS_HASH,
            "latest_hash": GENESIS_HASH,
            "broken_block_id": None,
            "message": "Audit chain is empty. Genesis state intact."
        }
    
    expected_prev = GENESIS_HASH
    for log in logs:
        if log.previous_hash != expected_prev:
            return {
                "is_valid": False,
                "total_blocks": len(logs),
                "genesis_hash": GENESIS_HASH,
                "latest_hash": logs[-1].hash,
                "broken_block_id": log.id,
                "message": f"Hash chain broken at block ID {log.id}: previous_hash mismatch"
            }
        
        recalculated = calculate_block_hash(
            previous_hash=log.previous_hash,
            user_id=log.user_id,
            action=log.action,
            entity=log.entity,
            entity_id=log.entity_id,
            timestamp=log.created_at.isoformat() if hasattr(log.created_at, "isoformat") else str(log.created_at),
            new_value=log.new_value
        )
        
        # Verify content hash integrity
        if log.hash != recalculated:
            # Check with alternate timestamp format in case DB serialized differently
            alt_timestamp = log.created_at.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00") if hasattr(log.created_at, "strftime") else str(log.created_at)
            alt_recalculated = calculate_block_hash(
                previous_hash=log.previous_hash,
                user_id=log.user_id,
                action=log.action,
                entity=log.entity,
                entity_id=log.entity_id,
                timestamp=alt_timestamp,
                new_value=log.new_value
            )
            if log.hash != alt_recalculated:
                return {
                    "is_valid": False,
                    "total_blocks": len(logs),
                    "genesis_hash": GENESIS_HASH,
                    "latest_hash": logs[-1].hash,
                    "broken_block_id": log.id,
                    "message": f"Data tampering detected in block ID {log.id}: hash signature mismatch"
                }
        
        expected_prev = log.hash
        
    return {
        "is_valid": True,
        "total_blocks": len(logs),
        "genesis_hash": GENESIS_HASH,
        "latest_hash": logs[-1].hash,
        "broken_block_id": None,
        "message": f"All {len(logs)} audit blocks cryptographically verified and intact."
    }
