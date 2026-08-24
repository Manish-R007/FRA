from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class SchemeCreate(BaseModel):
    name: str
    code: str
    department: str
    description: str
    eligibility_rules: Dict[str, Any]
    benefits: str
    documents_required: List[str]
    active: bool = True

class SchemeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    description: Optional[str] = None
    eligibility_rules: Optional[Dict[str, Any]] = None
    benefits: Optional[str] = None
    documents_required: Optional[List[str]] = None
    active: Optional[bool] = None

class SchemeResponse(BaseModel):
    id: int
    name: str
    code: str
    department: str
    description: str
    eligibility_rules: Dict[str, Any]
    benefits: str
    documents_required: List[str]
    active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SchemeRecommendationResponse(BaseModel):
    id: int
    claim_id: int
    scheme_id: int
    scheme_name: str
    scheme_code: str
    department: str
    eligibility_status: str  # ELIGIBLE, INELIGIBLE, CONDITIONAL
    eligibility_score: float  # 0 to 100
    priority: str  # HIGH, MEDIUM, LOW
    reason: str
    evidence: Optional[str] = None
    citation_page: Optional[int] = None
    benefits: str
    created_at: Optional[datetime] = None
