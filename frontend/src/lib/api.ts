import { getStoredToken } from "./auth";
import {
  FRAClaim,
  FRAGeometry,
  SatelliteAnalysis,
  SchemeRecommendation,
  DocumentData,
  VillageConvergence,
  AuditLog,
  AtlasStatistics,
  User,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
      // Token expired or invalid
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "An unexpected error occurred" }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    return fetchWithAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  getMe: async (): Promise<User> => {
    return fetchWithAuth("/auth/me");
  },

  // Stats
  getAtlasStats: async (): Promise<AtlasStatistics> => {
    return fetchWithAuth("/stats/atlas");
  },

  // Claims
  getClaims: async (params: Record<string, any> = {}): Promise<FRAClaim[]> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, String(val));
      }
    });
    const qs = query.toString();
    return fetchWithAuth(`/claims${qs ? `?${qs}` : ""}`);
  },
  getClaim: async (id: string | number): Promise<FRAClaim> => {
    return fetchWithAuth(`/claims/${id}`);
  },
  createClaim: async (data: Partial<FRAClaim>): Promise<FRAClaim> => {
    return fetchWithAuth("/claims", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateClaim: async (id: string | number, data: Partial<FRAClaim>): Promise<FRAClaim> => {
    return fetchWithAuth(`/claims/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  updateClaimStatus: async (id: string | number, status: string): Promise<FRAClaim> => {
    return fetchWithAuth(`/claims/${id}/status?new_status=${encodeURIComponent(status)}`, {
      method: "PATCH",
    });
  },
  purgeData: async (): Promise<{ status: string; message: string; purged_count: number }> => {
    return fetchWithAuth("/claims/purge-data", {
      method: "POST",
    });
  },
  bulkUploadClaims: async (payload: any): Promise<any> => {
    return fetchWithAuth("/claims/bulk-upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Geometries
  getGeometries: async (params: Record<string, any> = {}): Promise<any> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val) query.append(key, String(val));
    });
    const qs = query.toString();
    return fetchWithAuth(`/geometries${qs ? `?${qs}` : ""}`);
  },
  getGeometryByClaim: async (claimId: number): Promise<FRAGeometry> => {
    return fetchWithAuth(`/geometries/${claimId}`);
  },
  saveGeometry: async (claimId: number, geometry: any, source = "MANUAL", surveyRef?: string): Promise<FRAGeometry> => {
    return fetchWithAuth("/geometries", {
      method: "POST",
      body: JSON.stringify({
        claim_id: claimId,
        geometry,
        geometry_source: source,
        survey_reference: surveyRef,
      }),
    });
  },
  uploadGeospatialFile: async (file: File, claimId?: number, source = "GEOJSON_UPLOAD"): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    if (claimId) formData.append("claim_id", String(claimId));
    formData.append("geometry_source", source);

    return fetchWithAuth("/geometries/upload-file", {
      method: "POST",
      body: formData,
    });
  },

  // Satellite & AI Analysis
  runAnalysis: async (claimId: number): Promise<SatelliteAnalysis> => {
    return fetchWithAuth("/analysis/run", {
      method: "POST",
      body: JSON.stringify({ claim_id: claimId }),
    });
  },
  getAnalysis: async (claimId: number | string): Promise<SatelliteAnalysis> => {
    return fetchWithAuth(`/analysis/${claimId}`);
  },

  // Copernicus Sentinel Hub (CDSE)
  getSentinelStatistics: async (
    parcelId: string | number,
    params: { start_date?: string; end_date?: string; max_cloud?: number; resolution?: number } = {}
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    const qs = query.toString();
    return fetchWithAuth(`/sentinel/statistics/${parcelId}${qs ? `?${qs}` : ""}`);
  },
  getSentinelLayer: async (
    parcelId: string | number,
    layerType: "true-color" | "cir" | "ndvi" | "ndwi" | "ndbi",
    params: { start_date?: string; end_date?: string; max_cloud?: number; resolution?: number } = {}
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    const qs = query.toString();
    return fetchWithAuth(`/sentinel/${layerType}/${parcelId}${qs ? `?${qs}` : ""}`);
  },
  getSentinelImageUrl: (parcelId: string | number, layerType: string): string => {
    return `${API_BASE}/sentinel/image/${parcelId}/${layerType}`;
  },
  runSentinelProcess: async (
    parcelId: string | number,
    params: { start_date?: string; end_date?: string; max_cloud?: number } = {}
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    const qs = query.toString();
    return fetchWithAuth(`/sentinel/process/${parcelId}${qs ? `?${qs}` : ""}`, {
      method: "POST",
    });
  },

  // Documents & OCR
  uploadDocument: async (file: File, documentType = "FRA_PATTA", claimId?: number): Promise<DocumentData> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);
    if (claimId) formData.append("claim_id", String(claimId));

    return fetchWithAuth("/documents/upload", {
      method: "POST",
      body: formData,
    });
  },
  getDocument: async (documentId: number): Promise<DocumentData> => {
    return fetchWithAuth(`/documents/${documentId}`);
  },
  verifyDocument: async (documentId: number, action: string, fields?: any[], rejectionReason?: string): Promise<DocumentData> => {
    return fetchWithAuth(`/documents/${documentId}/verify`, {
      method: "PATCH",
      body: JSON.stringify({
        action,
        fields,
        rejection_reason: rejectionReason,
      }),
    });
  },

  // Schemes & DSS
  getSchemes: async (): Promise<any[]> => {
    return fetchWithAuth("/schemes");
  },
  getClaimRecommendations: async (claimId: number): Promise<SchemeRecommendation[]> => {
    return fetchWithAuth(`/dss/recommendations/${claimId}`);
  },
  chatDSS: async (req: import("./types").DSSChatRequest): Promise<import("./types").DSSChatResponse> => {
    return fetchWithAuth("/dss/chat", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  queryDSS: async (query: string, claimId?: number, district?: string, village?: string): Promise<any> => {
    return fetchWithAuth("/dss/query", {
      method: "POST",
      body: JSON.stringify({ query, claim_id: claimId, district, village }),
    });
  },
  getVillageConvergence: async (district?: string): Promise<VillageConvergence[]> => {
    const qs = district ? `?district=${encodeURIComponent(district)}` : "";
    return fetchWithAuth(`/dss/villages/convergence${qs}`);
  },

  // Audit
  getAuditLogs: async (): Promise<AuditLog[]> => {
    return fetchWithAuth("/audit/logs");
  },
  verifyAuditChain: async (): Promise<any> => {
    return fetchWithAuth("/audit/verify");
  },
};
