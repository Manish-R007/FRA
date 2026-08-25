export type UserRole = "ADMIN" | "STATE_OFFICER" | "DISTRICT_OFFICER" | "FIELD_OFFICER" | "ANALYST" | "CITIZEN";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  state?: string;
  district?: string;
  village?: string;
  is_active: boolean;
}

export type ClaimType = "IFR" | "CR" | "CFR";
export type ClaimStatus = "UPLOADED" | "OCR_PROCESSED" | "PENDING_VERIFICATION" | "FIELD_VERIFICATION" | "GIS_VALIDATED" | "SATELLITE_ANALYZE" | "APPROVED" | "REJECTED";
export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED" | "FLAGGED";

export interface FRAClaim {
  id: number;
  claim_id: string;
  claim_type: ClaimType;
  applicant_name: string;
  father_or_husband_name?: string;
  age?: number;
  gender?: string;
  address?: string;
  village: string;
  block?: string;
  district: string;
  state: string;
  survey_number?: string;
  area_claimed: number;
  area_unit: string;
  land_use?: string;
  application_date?: string;
  status: ClaimStatus;
  verification_status: VerificationStatus;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  has_geometry?: boolean;
  has_analysis?: boolean;
}

export interface FRAGeometry {
  id: number;
  claim_id: number;
  geometry: any;
  geometry_source: string;
  survey_reference?: string;
  calculated_area_m2: number;
  calculated_area_hectares: number;
  claimed_area_hectares: number;
  area_difference_percentage: number;
  flag_for_review: boolean;
  centroid?: [number, number];
  bbox?: [number, number, number, number];
  geometry_status: string;
}

export interface LandCoverStatistic {
  class_name: "forest" | "crop" | "water" | "building" | "bare_land" | "grassland" | "road" | "other";
  pixel_count: number;
  area_m2: number;
  area_hectares: number;
  percentage: number;
  confidence: number;
}

export interface DetectedAsset {
  id: number;
  claim_id: number;
  asset_type: string;
  geometry: any;
  area_m2?: number;
  confidence: number;
  model_name: string;
}

export interface SatelliteAnalysis {
  id: number;
  claim_id: number;
  geometry_id?: number;
  satellite_source: string;
  acquisition_date: string;
  cloud_percentage: number;
  image_url?: string;
  false_color_url?: string;
  ndvi_url?: string;
  ndwi_url?: string;
  ndbi_url?: string;
  mean_ndvi?: number;
  mean_ndwi?: number;
  mean_ndbi?: number;
  processing_status: string;
  model_name: string;
  model_version: string;
  confidence: number;
  statistics: LandCoverStatistic[];
  assets: DetectedAsset[];
  created_at?: string;
}

export interface SchemeRecommendation {
  id: number;
  claim_id: number;
  scheme_id: number;
  scheme_name: string;
  scheme_code: string;
  department: string;
  eligibility_status: "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL";
  eligibility_score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  evidence?: string;
  citation_page?: number;
  benefits: string;
  created_at?: string;
}

export interface DocumentField {
  id?: number;
  field_name: string;
  field_value?: string;
  confidence: number;
  source: string;
}

export interface DocumentData {
  id: number;
  claim_id?: number;
  file_name: string;
  file_url: string;
  document_type: string;
  ocr_text?: string;
  ocr_confidence?: number;
  processing_status: string;
  fields: DocumentField[];
  created_at?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  model_used?: string;
}

export interface SatelliteTelemetry {
  crop_pct: number;
  forest_pct: number;
  water_pct: number;
  building_pct: number;
  bare_pct: number;
  mean_ndvi?: number;
  mean_ndwi?: number;
  assets_detected: string[];
  parcel_area_ha?: number;
  claim_type?: string;
  water_deficit: boolean;
}

export interface RAGCitation {
  document_name: string;
  scheme_code?: string;
  page_number: number;
  section_title?: string;
  excerpt: string;
  similarity_score: number;
}

export interface DSSChatRequest {
  query?: string;
  messages?: ChatMessage[];
  claim_id?: number;
  scheme_code?: string;
  village?: string;
  district?: string;
}

export interface DSSChatResponse {
  message: ChatMessage;
  context_type: string;
  claim_context?: {
    id: number;
    claim_id: string;
    applicant_name: string;
    father_or_husband_name?: string;
    village: string;
    district: string;
    state: string;
    claim_type: string;
    area_claimed: number;
    status: string;
    verification_status: string;
    land_use?: string;
  };
  satellite_telemetry?: SatelliteTelemetry;
  recommendations: SchemeRecommendation[];
  citations: RAGCitation[];
  suggested_followups: string[];
  statistics?: Record<string, any>;
}

export interface DSSQueryResponse {
  query: string;
  answer: string;
  context_type: string;
  recommendations?: SchemeRecommendation[];
  citations: RAGCitation[];
  statistics?: Record<string, any>;
}

export interface VillageConvergence {
  village: string;
  district: string;
  state: string;
  total_claims: number;
  approved_claims: number;
  total_fra_area_hectares: number;
  mean_forest_pct: number;
  mean_crop_pct: number;
  mean_water_pct: number;
  mean_building_pct: number;
  priority_level: "HIGH" | "MEDIUM" | "LOW";
  key_interventions_needed: string[];
  recommended_schemes: string[];
  coordinates?: [number, number];
}

export interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  entity: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
  hash: string;
  previous_hash: string;
  created_at: string;
  ip_address?: string;
}

export interface AtlasStatistics {
  summary: {
    total_claims: number;
    approved_claims: number;
    pending_claims: number;
    rejected_claims: number;
    total_claimed_area_hectares: number;
    total_gis_area_hectares: number;
    villages_covered: number;
    districts_covered: number;
    states_covered: number;
    flagged_discrepancies: number;
    high_priority_interventions: number;
  };
  claim_types: {
    IFR: number;
    CR: number;
    CFR: number;
  };
  land_cover_totals_ha: {
    forest: number;
    crop: number;
    water: number;
    building: number;
    bare_land: number;
  };
  assets_detected: {
    total: number;
    water_bodies: number;
    farms: number;
    forest_stands: number;
    homesteads: number;
  };
  charts: {
    by_state: { state: string; count: number }[];
    by_district: { district: string; state: string; count: number }[];
    by_status: { status: string; count: number }[];
  };
}

export interface IndexStats {
  min: number;
  max: number;
  mean: number;
  median?: number;
  std_dev?: number;
  valid_pixel_count: number;
}

export interface LandCharacteristics {
  vegetation_area_percentage: number;
  water_area_percentage: number;
  builtup_area_percentage: number;
}

export interface SentinelLayerMetadata {
  satellite_source: string;
  platform?: string;
  acquisition_date: string;
  cloud_coverage_percentage: number;
  processing_date: string;
  resolution_meters: number;
  bands_used: string[];
  cloud_masking_applied: boolean;
  masked_scl_classes: string[];
  parcel_area_hectares?: number;
  bounds?: [number, number, number, number];
}

export interface SentinelStatisticsResponse {
  claim_id: string;
  parcel_id: number;
  ndvi: IndexStats;
  ndwi: IndexStats;
  ndbi: IndexStats;
  land_characteristics: LandCharacteristics;
  metadata: SentinelLayerMetadata;
}

export interface SentinelLayerResponse {
  claim_id: string;
  parcel_id: number;
  layer_type: string;
  layer_name: string;
  image_url: string;
  metadata: SentinelLayerMetadata;
}

