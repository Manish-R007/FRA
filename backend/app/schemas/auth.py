from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(default="CITIZEN")  # ADMIN, STATE_OFFICER, DISTRICT_OFFICER, FIELD_OFFICER, ANALYST, CITIZEN
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenRefresh(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

Token.model_rebuild()
