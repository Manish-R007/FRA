import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "FRA ATLAS AI"
    PROJECT_DESCRIPTION: str = "AI-Powered Forest Rights Act Atlas & WebGIS-Based Decision Support System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = "super-secret-fra-atlas-key-2025-ministry-of-tribal-affairs-secure-sha256"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./fra_atlas.db")
    
    # Storage
    UPLOAD_DIR: str = os.path.join(os.getcwd(), "uploads")
    PROCESSED_DIR: str = os.path.join(os.getcwd(), "uploads", "processed")
    SATELLITE_DIR: str = os.path.join(os.getcwd(), "uploads", "satellite")
    
    # Remote Sensing & GEE
    GEE_SERVICE_ACCOUNT: Optional[str] = os.getenv("GEE_SERVICE_ACCOUNT", None)
    GEE_PRIVATE_KEY_FILE: Optional[str] = os.getenv("GEE_PRIVATE_KEY_FILE", None)
    
    # LLM / Gemini API Key
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    
    # Discrepancy threshold percentage
    AREA_DISCREPANCY_THRESHOLD_PERCENT: float = 5.0
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
os.makedirs(settings.SATELLITE_DIR, exist_ok=True)
