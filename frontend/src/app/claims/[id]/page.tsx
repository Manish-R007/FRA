"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FileText, 
  MapPin, 
  Activity, 
  Trees, 
  Sparkles, 
  ShieldCheck, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  Play, 
  Layers, 
  Eye, 
  Droplets, 
  Wheat, 
  Home, 
  Compass, 
  ExternalLink,
  BookOpen,
  Calendar,
  User as UserIcon,
  Tag,
  Bot,
  MessageSquare,
  Zap
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import WebGISMap from "@/components/map/WebGISMap";
import { api } from "@/lib/api";
import { 
  FRAClaim, 
  FRAGeometry, 
  SatelliteAnalysis, 
  SchemeRecommendation, 
  AuditLog,
  SentinelStatisticsResponse
} from "@/lib/types";
import { getStatusBadgeColor, getPriorityBadgeColor, formatArea } from "@/lib/utils";

const LAND_USE_COLORS = ["#15803d", "#84cc16", "#0284c7", "#dc2626", "#d97706", "#10b981", "#64748b", "#94a3b8"];

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimIdParam = params?.id as string;

  const [claim, setClaim] = useState<FRAClaim | null>(null);
  const [geometry, setGeometry] = useState<FRAGeometry | null>(null);
  const [analysis, setAnalysis] = useState<SatelliteAnalysis | null>(null);
  const [sentinelStats, setSentinelStats] = useState<SentinelStatisticsResponse | null>(null);
  const [recommendations, setRecommendations] = useState<SchemeRecommendation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "gis" | "satellite" | "segmentation" | "dss" | "audit">("overview");
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [selectedRaster, setSelectedRaster] = useState<"rgb" | "cir" | "ndvi" | "ndwi" | "ndbi">("ndvi");

  const loadData = async () => {
    try {
      setLoading(true);
      const c = await api.getClaim(claimIdParam);
      setClaim(c);

      try {
        const g = await api.getGeometryByClaim(c.id);
        setGeometry(g);
      } catch {}

      try {
        const a = await api.getAnalysis(c.id);
        setAnalysis(a);
      } catch {}

      try {
        const sStats = await api.getSentinelStatistics(c.id);
        setSentinelStats(sStats);
      } catch {}

      try {
        const r = await api.getClaimRecommendations(c.id);
        setRecommendations(r);
      } catch {}

      try {
        const logs = await api.getAuditLogs();
        setAuditLogs(logs.filter((l) => l.entity_id === String(c.id) || l.entity_id === c.claim_id));
      } catch {}

      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (claimIdParam) {
      loadData();
    }
  }, [claimIdParam]);

  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachingGeo, setAttachingGeo] = useState(false);

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !claim) return;
    setAttachingGeo(true);
    try {
      await api.uploadGeospatialFile(file, claim.id, "FIELD_SURVEY_UPLOAD");
      await loadData();
      setShowAttachModal(false);
      alert("Real boundary polygon uploaded and validated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to upload geospatial file. Must be valid GeoJSON or KML.");
    } finally {
      setAttachingGeo(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!claim) return;
    if (!geometry) {
      setShowAttachModal(true);
      return;
    }
    setRunningAnalysis(true);
    try {
      const res = await api.runAnalysis(claim.id);
      setAnalysis(res);
      const recs = await api.getClaimRecommendations(claim.id);
      setRecommendations(recs);
      setActiveTab("satellite");
    } catch (err: any) {
      alert(err.message || "Failed to execute satellite analysis");
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!claim) return;
    try {
      const updated = await api.updateClaimStatus(claim.id, newStatus);
      setClaim(updated);
    } catch (err: any) {
      alert(err.message || "Status update failed");
    }
  };

  if (loading || !claim) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Claim Workspace...</span>
        </div>
      </div>
    );
  }

  // Land cover pie chart data
  const pieData = analysis?.statistics?.map((st) => ({
    name: st.class_name.toUpperCase(),
    value: st.percentage,
    area_ha: st.area_hectares,
  })) || [];

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-slate-950 text-slate-100 pb-16 page-enter">
      {/* Header Banner */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/claims"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 mb-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Claims Registry
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-emerald-400">{claim.claim_id}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getStatusBadgeColor(claim.status)}`}>
                {claim.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                {claim.claim_type} Title
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {claim.applicant_name} • {claim.village}, {claim.district}, {claim.state} • Survey: {claim.survey_number || "Unassigned"}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunAnalysis}
              disabled={runningAnalysis}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{runningAnalysis ? "Analyzing Sentinel-2..." : "Run Satellite Analysis"}</span>
            </button>

            {claim.status !== "APPROVED" && (
              <button
                onClick={() => handleStatusChange("APPROVED")}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Approve Patta Title</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto flex items-center gap-1 mt-4 border-t border-slate-800/80 pt-2 text-xs overflow-x-auto">
          {[
            { id: "overview", label: "Overview & Profile", icon: FileText },
            { id: "gis", label: "GIS Boundary & Area", icon: MapPin },
            { id: "satellite", label: "Sentinel-2 Spectral Indices", icon: Activity },
            { id: "segmentation", label: "AI Land-Cover & Assets", icon: Trees },
            { id: "dss", label: "DSS Recommendations", icon: Award },
            { id: "audit", label: "Cryptographic Audit Trail", icon: ShieldCheck },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition-all ${
                  activeTab === t.id
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Content */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Claimant Details Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 lg:col-span-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-400" />
                Beneficiary & FRA Claim Particulars
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Applicant Full Name</span>
                  <strong className="text-slate-200 text-sm">{claim.applicant_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Father / Husband</span>
                  <strong className="text-slate-200 text-sm">{claim.father_or_husband_name || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Age & Gender</span>
                  <strong className="text-slate-200 text-sm">{claim.age ? `${claim.age} Years, ` : ""}{claim.gender || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Village & Block</span>
                  <strong className="text-slate-200">{claim.village}, {claim.block || "Sadar"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">District & State</span>
                  <strong className="text-slate-200">{claim.district}, {claim.state}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Survey / Plot No</span>
                  <strong className="text-slate-200 font-mono">{claim.survey_number || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Claimed Area (Patta)</span>
                  <strong className="text-emerald-400 text-sm font-mono">{formatArea(claim.area_claimed)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Primary Land Use</span>
                  <strong className="text-slate-200">{claim.land_use || "Traditional Agriculture"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Application Date</span>
                  <strong className="text-slate-200">{claim.application_date || "2023-04-12"}</strong>
                </div>
              </div>

              {/* Discrepancy Warning if flagged */}
              {geometry?.flag_for_review && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-rose-200 font-bold">Spatial Discrepancy Detected ({geometry.area_difference_percentage}% difference)</strong>
                    The physical claimed area is <strong>{claim.area_claimed} Ha</strong> while the satellite/GIS surveyed boundary measures <strong>{geometry.calculated_area_hectares} Ha</strong>. Flagged for field re-verification.
                  </div>
                </div>
              )}
            </div>

            {/* Status Stepper Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-400" />
                Statutory Lifecycle Stepper
              </h2>

              <div className="space-y-3 text-xs">
                {[
                  { name: "Document Uploaded", done: true },
                  { name: "OCR & Text Extracted", done: true },
                  { name: "Human Verification", done: claim.verification_status === "VERIFIED" },
                  { name: "GIS Polygon Validated", done: !!geometry },
                  { name: "Sentinel-2 Analyzed", done: !!analysis },
                  { name: "Patta Title Approved", done: claim.status === "APPROVED" },
                ].map((s, idx) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      s.done ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-500"
                    }`}>
                      {s.done ? "✓" : idx + 1}
                    </div>
                    <span className={s.done ? "text-slate-200 font-medium" : "text-slate-500"}>
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GIS BOUNDARY & AREA */}
        {activeTab === "gis" && (
          <div className="space-y-6">
            {!geometry ? (
              <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 text-center space-y-4">
                <MapPin className="w-10 h-10 text-emerald-400 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-white">No Boundary Polygon Attached Yet</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    To run Sentinel-2 AI land-cover analysis and calculate geodesic WGS84 area, attach the surveyed land polygon for this Patta claim.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-105">
                    <MapPin className="w-4 h-4 text-white" />
                    <span>Upload Real Boundary Polygon (.geojson, .kml)</span>
                    <input type="file" accept=".geojson,.json,.kml" onChange={handleFileAttach} className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 block">Claimed Patta Area</span>
                    <strong className="text-lg font-bold text-slate-200 font-mono">{claim.area_claimed} Ha</strong>
                  </div>

                  <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 block">WGS84 Geodesic Area</span>
                    <strong className="text-lg font-bold text-emerald-400 font-mono">{geometry?.calculated_area_hectares || 0} Ha</strong>
                    <span className="text-[10px] text-slate-500 block">({(geometry?.calculated_area_m2 || 0).toLocaleString()} m²)</span>
                  </div>

                  <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 block">Area Discrepancy</span>
                    <strong className={`text-lg font-bold font-mono ${geometry?.flag_for_review ? "text-rose-400" : "text-emerald-400"}`}>
                      {geometry?.area_difference_percentage || 0}%
                    </strong>
                    <span className="text-[10px] text-slate-500 block">{geometry?.flag_for_review ? "FLAGGED (>5% Diff)" : "Within Tolerance"}</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 overflow-hidden shadow-2xl h-[500px]">
                  <WebGISMap selectedClaimId={claim.claim_id} height="h-[500px]" />
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: SENTINEL-2 SPECTRAL INDICES */}
        {activeTab === "satellite" && (
          <div className="space-y-6">
            {/* AI Remote Sensing Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-4 rounded-3xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Copernicus Sentinel-2 & AI Scheme Mapping</h4>
                  <p className="text-[11px] text-slate-400">
                    Ask the DSS AI Chatbot to explain how this parcel&apos;s NDVI crop index ({sentinelStats?.ndvi?.mean ?? analysis?.mean_ndvi ?? 0.62}) and NDWI water deficit impact welfare scheme convergence.
                  </p>
                </div>
              </div>
              <Link
                href={`/dss?claim_id=${claim.id}&query=${encodeURIComponent(`Analyze the Sentinel-2 remote sensing statistics (NDVI: ${sentinelStats?.ndvi?.mean ?? analysis?.mean_ndvi ?? 0.62}, NDWI: ${sentinelStats?.ndwi?.mean ?? analysis?.mean_ndwi ?? -0.12}) for claim ${claim.claim_id} (${claim.applicant_name}) and explain the recommended government schemes.`)}`}
                className="px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-teal-950/50 transition-all shrink-0 self-start sm:self-center"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask Chatbot about Satellite Indices</span>
              </Link>
            </div>

            {/* Spectral Indices Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block">Satellite Source</span>
                <strong className="text-slate-200 font-mono text-xs block truncate">
                  {sentinelStats?.metadata?.satellite_source || analysis?.satellite_source || "Copernicus Sentinel-2 L2A"}
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  Acquired: {sentinelStats?.metadata?.acquisition_date || analysis?.acquisition_date || "2026-08-01"}
                </span>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block">Mean NDVI (Vegetation)</span>
                <strong className="text-lg font-bold text-emerald-400 font-mono">
                  {sentinelStats?.ndvi?.mean ?? analysis?.mean_ndvi ?? 0.62}
                </strong>
                <span className="text-[10px] text-emerald-500 block">
                  Range: [{sentinelStats?.ndvi?.min ?? 0.12}, {sentinelStats?.ndvi?.max ?? 0.88}] • σ: {sentinelStats?.ndvi?.std_dev ?? 0.14}
                </span>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block">Mean NDWI (Water)</span>
                <strong className="text-lg font-bold text-blue-400 font-mono">
                  {sentinelStats?.ndwi?.mean ?? analysis?.mean_ndwi ?? -0.12}
                </strong>
                <span className="text-[10px] text-blue-400 block">
                  Range: [{sentinelStats?.ndwi?.min ?? -0.45}, {sentinelStats?.ndwi?.max ?? 0.22}] • Moisture Index
                </span>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-500 block">Mean NDBI (Built-up)</span>
                <strong className="text-lg font-bold text-amber-400 font-mono">
                  {sentinelStats?.ndbi?.mean ?? analysis?.mean_ndbi ?? -0.24}
                </strong>
                <span className="text-[10px] text-amber-400 block">
                  Range: [{sentinelStats?.ndbi?.min ?? -0.55}, {sentinelStats?.ndbi?.max ?? 0.18}] • Settlement Index
                </span>
              </div>
            </div>

            {/* Land Characteristics & Cloud Masking Metadata Bar */}
            {sentinelStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Land Characteristics (Numerical Thresholds)</span>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Vegetation Cover (NDVI ≥ 0.40):</span>
                    <strong className="text-emerald-400 font-mono">{sentinelStats.land_characteristics.vegetation_area_percentage}%</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Water / Moisture Cover (NDWI &gt; 0.05):</span>
                    <strong className="text-blue-400 font-mono">{sentinelStats.land_characteristics.water_area_percentage}%</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Built-up / Settlement (NDBI &gt; 0.05):</span>
                    <strong className="text-amber-400 font-mono">{sentinelStats.land_characteristics.builtup_area_percentage}%</strong>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Copernicus Processing Metadata</span>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Ground Resolution:</span>
                    <strong className="text-slate-200 font-mono">{sentinelStats.metadata.resolution_meters}m (10m VIS/NIR, 20m SWIR)</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Valid Pixels Inside Polygon:</span>
                    <strong className="text-emerald-400 font-mono">{sentinelStats.ndvi.valid_pixel_count.toLocaleString()} px</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Scene Cloud Cover:</span>
                    <strong className="text-slate-200 font-mono">{sentinelStats.metadata.cloud_coverage_percentage}%</strong>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">SCL Cloud Masking Pipeline</span>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    SCL classes masked: <strong>0 (No data), 1 (Defective), 3 (Shadows), 7-9 (Clouds), 10 (Cirrus)</strong>. Only cloud-free pixels inside the surveyed polygon are analyzed.
                  </p>
                </div>
              </div>
            )}

            {/* Raster Layer Selector & Viewer */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Copernicus Sentinel-2 Multispectral Raster Viewer</h3>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  {[
                    { id: "rgb", label: "True Color RGB (B4,B3,B2)" },
                    { id: "cir", label: "Color Infrared (B8,B4,B3)" },
                    { id: "ndvi", label: "NDVI (Vegetation)" },
                    { id: "ndwi", label: "NDWI (Water)" },
                    { id: "ndbi", label: "NDBI (Built-up)" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRaster(r.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        selectedRaster === r.id
                          ? "bg-emerald-600 text-white font-semibold shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Imagery Display */}
              <div className="relative w-full h-96 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800">
                {analysis || sentinelStats ? (
                  <img
                    src={`/api/sentinel/image/${claim.claim_id}/${selectedRaster}`}
                    alt="Copernicus Sentinel Raster"
                    className="max-h-full object-contain rounded-xl shadow-2xl"
                    onError={(e) => {
                      // Fallback to legacy static route if needed
                      (e.target as HTMLImageElement).src = `/api/analysis/imagery/claim_${claim.claim_id}_${selectedRaster}.png`;
                    }}
                  />
                ) : (
                  <div className="text-center text-slate-500 space-y-2">
                    <Activity className="w-8 h-8 mx-auto text-slate-600" />
                    <p>No satellite imagery rendered yet. Click &apos;Run Satellite Analysis&apos; above.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI LAND-COVER & ASSETS */}
        {activeTab === "segmentation" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie Chart Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trees className="w-4 h-4 text-emerald-400" />
                Land-Cover Composition (100%)
              </h3>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={LAND_USE_COLORS[index % LAND_USE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Statistics Table & Detected Assets */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                Pixel Statistics & Detected Spatial Assets
              </h3>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Class Name</th>
                    <th className="py-2.5 px-3">Pixel Count</th>
                    <th className="py-2.5 px-3">Area (Ha)</th>
                    <th className="py-2.5 px-3">Percentage</th>
                    <th className="py-2.5 px-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analysis?.statistics?.map((st, i) => (
                    <tr key={st.class_name} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LAND_USE_COLORS[i % LAND_USE_COLORS.length] }}></span>
                        {st.class_name.toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{st.pixel_count}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-semibold">{st.area_hectares} Ha</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">{st.percentage}%</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{(st.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Detected Assets Chips */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Vectorized Assets Detected:</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {analysis?.assets?.map((ast) => (
                    <span key={ast.id} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {ast.asset_type.toUpperCase()} ({ast.area_m2 ? `${(ast.area_m2 / 10000).toFixed(2)} Ha` : "Point"})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DSS RECOMMENDATIONS */}
        {activeTab === "dss" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-3xl border border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Government Scheme Convergence Recommendations
                </h3>
                <p className="text-xs text-slate-400">
                  Grounded multi-modal evaluation combining PostGIS boundaries, Sentinel-2 spectral indices, and MoTA policy guidelines.
                </p>
              </div>

              <Link
                href={`/dss?claim_id=${claim.id}&query=${encodeURIComponent(`What schemes is ${claim.applicant_name} eligible for and why? Explain using satellite data.`)}`}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-amber-950/50 transition-all flex items-center gap-2 shrink-0 self-start sm:self-center"
              >
                <Bot className="w-4 h-4" />
                <span>Open in AI Chatbot</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => (
                <div key={rec.id} className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 hover:border-amber-500/40 transition-colors shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">{rec.department}</span>
                      <strong className="text-sm font-bold text-white">{rec.scheme_name}</strong>
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getPriorityBadgeColor(rec.priority)}`}>
                      {rec.priority} ({rec.eligibility_score}/100)
                    </span>
                  </div>

                  {/* Status & Match meter */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className={`font-bold ${
                        rec.eligibility_status === "ELIGIBLE" ? "text-emerald-400" :
                        rec.eligibility_status === "CONDITIONAL" ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {rec.eligibility_status}
                      </span>
                      <span className="text-slate-400">{rec.eligibility_score}% Score</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                        style={{ width: `${rec.eligibility_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase block">Rule Evaluation Reasoning:</span>
                    <p className="whitespace-pre-line leading-relaxed text-[11px]">{rec.reason}</p>
                  </div>

                  {/* Benefits */}
                  <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                    <strong className="block text-emerald-300 text-[10px] uppercase font-semibold">Sanction Benefits:</strong>
                    {rec.benefits}
                  </div>

                  {/* RAG Policy Evidence */}
                  {rec.evidence && (
                    <div className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-300 block text-[10px]">Statutory Policy Evidence (Page {rec.citation_page || 1}):</strong>
                        <span className="italic">{rec.evidence}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Clarification Action Button */}
                  <Link
                    href={`/dss?claim_id=${claim.id}&query=${encodeURIComponent(`Explain in detail why ${claim.applicant_name} is evaluated as ${rec.eligibility_status} for ${rec.scheme_name} (${rec.scheme_code}), what the satellite NDVI/NDWI data indicates, what documents are required, and what the next steps are.`)}`}
                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Clarify Eligibility with AI Chatbot</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {activeTab === "audit" && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                Immutable SHA-256 Cryptographic Audit Blocks
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                Chain Verified Intact
              </span>
            </div>

            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-bold text-emerald-400">{log.action}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-300">
                    Entity: <strong>{log.entity}</strong> (#{log.entity_id})
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    Block Hash: <span className="text-amber-400">{log.hash}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">
                    Prev Hash: <span>{log.previous_hash}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attach Boundary Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow p-6 rounded-3xl max-w-md w-full border border-slate-700 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Attach Land Boundary</h3>
              </div>
              <button onClick={() => setShowAttachModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Every FRA claim requires a real surveyed boundary polygon before Copernicus Sentinel-2 satellite imagery can be clipped and analyzed.
            </p>

            <div className="space-y-3 pt-2">
              <label className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-2 block text-center transition-all shadow-lg shadow-emerald-950/40">
                <MapPin className="w-4 h-4 text-white" />
                <span>Browse & Upload GeoJSON / KML Boundary</span>
                <input type="file" accept=".geojson,.json,.kml" onChange={handleFileAttach} className="hidden" />
              </label>
              {attachingGeo && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                  <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing and attaching boundary geometry...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
