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
    
    # LLM Settings (Groq & Gemini)
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", None)
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    # LangChain + Chroma DSS knowledge base
    DSS_CHROMA_DIR: str = os.getenv("DSS_CHROMA_DIR", os.path.join(os.getcwd(), "uploads", "chroma"))
    DSS_CHROMA_COLLECTION: str = os.getenv("DSS_CHROMA_COLLECTION", "fra_policy_documents")
    DSS_EMBEDDING_MODEL: str = os.getenv("DSS_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    DSS_EMBEDDING_DEVICE: str = os.getenv("DSS_EMBEDDING_DEVICE", "cpu")
    HF_HOME: str = os.getenv("HF_HOME", os.path.join(os.getcwd(), "uploads", "huggingface"))
    # Download the free Hugging Face model on first use, then reuse the persistent cache.
    DSS_EMBEDDINGS_LOCAL_ONLY: bool = os.getenv("DSS_EMBEDDINGS_LOCAL_ONLY", "false").lower() in ("1", "true", "yes")
    DSS_RAG_TOP_K: int = int(os.getenv("DSS_RAG_TOP_K", "4"))
    OCR_LANGUAGES: str = os.getenv("OCR_LANGUAGES", "eng+hin+kan+ori")
    
    # Copernicus Sentinel Hub (Copernicus Data Space Ecosystem - CDSE)
    SENTINEL_HUB_CLIENT_ID: Optional[str] = os.getenv("SENTINEL_HUB_CLIENT_ID", None)
    SENTINEL_HUB_CLIENT_SECRET: Optional[str] = os.getenv("SENTINEL_HUB_CLIENT_SECRET", None)
    SENTINEL_HUB_TOKEN_URL: str = os.getenv(
        "SENTINEL_HUB_TOKEN_URL",
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    )
    SENTINEL_HUB_PROCESS_URL: str = os.getenv(
        "SENTINEL_HUB_PROCESS_URL",
        "https://sh.dataspace.copernicus.eu/process/v1"
    )
    SENTINEL_HUB_CATALOG_URL: str = os.getenv(
        "SENTINEL_HUB_CATALOG_URL",
        "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0"
    )
    SENTINEL_HUB_MAX_CLOUD_COVER: float = float(os.getenv("SENTINEL_HUB_MAX_CLOUD_COVER", "20.0"))
    SENTINEL_HUB_DEFAULT_RESOLUTION: float = float(os.getenv("SENTINEL_HUB_DEFAULT_RESOLUTION", "10.0"))

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
os.makedirs(settings.DSS_CHROMA_DIR, exist_ok=True)
os.environ["HF_HOME"] = settings.HF_HOME
os.makedirs(settings.HF_HOME, exist_ok=True)
