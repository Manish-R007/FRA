from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.scheme import SchemeRecommendationResponse

class DSSQueryRequest(BaseModel):
    query: str
    claim_id: Optional[int] = None
    district: Optional[str] = None
    village: Optional[str] = None

class RAGCitation(BaseModel):
    document_name: str
    scheme_code: Optional[str] = None
    page_number: int
    section_title: Optional[str] = None
    excerpt: str
    similarity_score: float

class DSSQueryResponse(BaseModel):
    query: str
    answer: str
    context_type: str  # BENEFICIARY_ASSESSMENT, VILLAGE_CONVERGENCE, SCHEME_INQUIRY, POLICY_INFO
    recommendations: Optional[List[SchemeRecommendationResponse]] = []
    citations: List[RAGCitation]
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
