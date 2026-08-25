from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class IndexStatistics(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    min: float
    max: float
    mean: float
    median: Optional[float] = None
    std_dev: Optional[float] = None
    valid_pixel_count: int

class LandPercentages(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    vegetation_area_percentage: float
    water_area_percentage: float
    builtup_area_percentage: float

class SentinelLayerMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    satellite_source: str = "Copernicus Sentinel-2 L2A (Surface Reflectance)"
    platform: Optional[str] = "Sentinel-2"
    acquisition_date: str
    cloud_coverage_percentage: float
    processing_date: str
    resolution_meters: float = 10.0
    bands_used: List[str]
    cloud_masking_applied: bool = True
    masked_scl_classes: List[str] = [
        "0 - No Data",
        "1 - Saturated / Defective",
        "3 - Cloud Shadows",
        "7 - Cloud Low Probability / Unclassified",
        "8 - Cloud Medium Probability",
        "9 - Cloud High Probability",
        "10 - Thin Cirrus"
    ]
    parcel_area_hectares: Optional[float] = None
    bounds: Optional[List[float]] = None

class SentinelStatisticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    claim_id: str
    parcel_id: int
    ndvi: IndexStatistics
    ndwi: IndexStatistics
    ndbi: IndexStatistics
    land_characteristics: LandPercentages
    metadata: SentinelLayerMetadata

class SentinelLayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    claim_id: str
    parcel_id: int
    layer_type: str
    layer_name: str
    image_url: str
    metadata: SentinelLayerMetadata

class SentinelProcessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    claim_id: int
    claim_code: str
    satellite_source: str
    acquisition_date: str
    cloud_percentage: float
    image_url: str
    false_color_url: str
    ndvi_url: str
    ndwi_url: str
    ndbi_url: str
    mean_ndvi: float
    mean_ndwi: float
    mean_ndbi: float
    statistics: SentinelStatisticsResponse
    processing_status: str
    created_at: datetime
