from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class FRAGeometryCreate(BaseModel):
    claim_id: int
    geometry: Dict[str, Any]  # GeoJSON Geometry object (Polygon / MultiPolygon)
    geometry_source: str = Field("MANUAL", description="DOCUMENT, GEOJSON, KML, SHAPEFILE, MANUAL, FIELD_SURVEY")
    survey_reference: Optional[str] = None

class FRAGeometryUpdate(BaseModel):
    geometry: Dict[str, Any]
    geometry_source: Optional[str] = None
    survey_reference: Optional[str] = None

class FRAGeometryResponse(BaseModel):
    id: int
    claim_id: int
    geometry: Dict[str, Any]
    geometry_source: str
    survey_reference: Optional[str] = None
    calculated_area_m2: float
    calculated_area_hectares: float
    claimed_area_hectares: float
    area_difference_percentage: float
    flag_for_review: bool
    centroid: Optional[List[float]] = None
    bbox: Optional[List[float]] = None
    geometry_status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
