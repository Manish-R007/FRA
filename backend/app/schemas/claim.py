from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class FRAClaimCreate(BaseModel):
    claim_id: str
    claim_type: str = Field(..., description="IFR, CR, or CFR")
    applicant_name: str
    father_or_husband_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    village: str
    block: Optional[str] = None
    district: str
    state: str
    survey_number: Optional[str] = None
    area_claimed: float = Field(..., gt=0, description="Claimed land area in standard hectares")
    area_unit: str = "hectares"
    land_use: Optional[str] = "Agriculture"
    application_date: Optional[str] = None
    status: Optional[str] = "UPLOADED"

class FRAClaimUpdate(BaseModel):
    claim_type: Optional[str] = None
    applicant_name: Optional[str] = None
    father_or_husband_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    block: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    survey_number: Optional[str] = None
    area_claimed: Optional[float] = None
    land_use: Optional[str] = None
    status: Optional[str] = None
    verification_status: Optional[str] = None

class FRAClaimResponse(BaseModel):
    id: int
    claim_id: str
    claim_type: str
    applicant_name: str
    father_or_husband_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    village: str
    block: Optional[str] = None
    district: str
    state: str
    survey_number: Optional[str] = None
    area_claimed: float
    area_unit: str
    land_use: Optional[str] = None
    application_date: Optional[str] = None
    status: str
    verification_status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    has_geometry: Optional[bool] = False
    has_analysis: Optional[bool] = False

    class Config:
        from_attributes = True
