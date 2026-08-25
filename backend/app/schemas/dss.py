from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.scheme import SchemeRecommendationResponse

class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Content of the message in markdown format")
    timestamp: Optional[str] = None
    model_used: Optional[str] = None

class DSSQueryRequest(BaseModel):
    query: str
    claim_id: Optional[int] = None
    district: Optional[str] = None
    village: Optional[str] = None

class DSSChatRequest(BaseModel):
    query: Optional[str] = None
    messages: List[ChatMessage] = []
    claim_id: Optional[int] = None
    scheme_code: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None

class RAGCitation(BaseModel):
    document_name: str
    scheme_code: Optional[str] = None
    page_number: int
    section_title: Optional[str] = None
    excerpt: str
    similarity_score: float

class SatelliteTelemetry(BaseModel):
    crop_pct: float = 0.0
    forest_pct: float = 0.0
    water_pct: float = 0.0
    building_pct: float = 0.0
    bare_pct: float = 0.0
    mean_ndvi: Optional[float] = None
    mean_ndwi: Optional[float] = None
    assets_detected: List[str] = []
    parcel_area_ha: Optional[float] = None
    claim_type: Optional[str] = None
    water_deficit: bool = False

class DSSQueryResponse(BaseModel):
    query: str
    answer: str
    context_type: str  # BENEFICIARY_ASSESSMENT, VILLAGE_CONVERGENCE, SCHEME_INQUIRY, POLICY_INFO
    recommendations: Optional[List[SchemeRecommendationResponse]] = []
    citations: List[RAGCitation] = []
    statistics: Optional[Dict[str, Any]] = None

class DSSChatResponse(BaseModel):
    message: ChatMessage
    context_type: str  # BENEFICIARY_ASSESSMENT, SCHEME_INQUIRY, VILLAGE_CONVERGENCE, ELIGIBILITY_CLARIFICATION, POLICY_INFO
    claim_context: Optional[Dict[str, Any]] = None
    satellite_telemetry: Optional[SatelliteTelemetry] = None
    recommendations: List[SchemeRecommendationResponse] = []
    citations: List[RAGCitation] = []
    suggested_followups: List[str] = []
    statistics: Optional[Dict[str, Any]] = None

class VillageConvergenceSummary(BaseModel):
    village: str
    district: str
    state: str
    total_claims: int
    approved_claims: int
    total_fra_area_hectares: float
    mean_forest_pct: float
    mean_crop_pct: float
    mean_water_pct: float
    mean_building_pct: float
    priority_level: str  # HIGH, MEDIUM, LOW
    key_interventions_needed: List[str]
    recommended_schemes: List[str]
    coordinates: Optional[List[float]] = None
