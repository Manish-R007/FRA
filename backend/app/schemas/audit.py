from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity: str
    entity_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    hash: str
    previous_hash: str
    created_at: datetime
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True

class AuditVerificationResult(BaseModel):
    is_valid: bool
    total_blocks: int
    genesis_hash: str
    latest_hash: str
    broken_block_id: Optional[int] = None
    message: str

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    read: str
    created_at: datetime

    class Config:
        from_attributes = True
