from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class SatelliteAnalysisRequest(BaseModel):
    claim_id: int
    force_refresh: bool = False
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_cloud_cover: float = 20.0

class LandCoverStatsResponse(BaseModel):
    class_name: str
    pixel_count: int
    area_m2: float
    area_hectares: float
    percentage: float
    confidence: float

class AssetResponse(BaseModel):
    id: int
    claim_id: int
    asset_type: str
    geometry: Dict[str, Any]
    area_m2: Optional[float] = None
    confidence: float
    model_name: str

class SatelliteAnalysisResponse(BaseModel):
    id: int
    claim_id: int
    geometry_id: Optional[int] = None
    satellite_source: str
    acquisition_date: str
    cloud_percentage: float
    image_url: Optional[str] = None
    false_color_url: Optional[str] = None
    ndvi_url: Optional[str] = None
    ndwi_url: Optional[str] = None
    ndbi_url: Optional[str] = None
    mean_ndvi: Optional[float] = None
    mean_ndwi: Optional[float] = None
    mean_ndbi: Optional[float] = None
    processing_status: str
    model_name: str
    model_version: str
    confidence: float
    statistics: List[LandCoverStatsResponse]
    assets: List[AssetResponse]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ClaimAnalysisSummary(BaseModel):
    claim_id: str
    area_m2: float
    satellite_date: str
    statistics: Dict[str, float]  # e.g., {"forest": 31.2, "crop": 42.5, "water": 7.8, "building": 4.5, "bare_land": 14.0}
    confidence: float
