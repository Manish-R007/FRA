"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WebGISMap from "@/components/map/WebGISMap";
import { 
  Search, 
  Layers, 
  Upload, 
  Filter, 
  MapPin, 
  Compass, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Plus,
  User,
  ChevronRight
} from "lucide-react";
import { api } from "@/lib/api";
import { FRAClaim } from "@/lib/types";

function AtlasContent() {
  const searchParams = useSearchParams();
  const initialParamClaim = searchParams.get("claim_id") || searchParams.get("id") || searchParams.get("selected") || null;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(initialParamClaim);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [claimsList, setClaimsList] = useState<FRAClaim[]>([]);
  const [targetClaimId, setTargetClaimId] = useState<string>("");
  const [mapKey, setMapKey] = useState(Date.now());
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    api.getClaims({ limit: 100 })
      .then((data) => setClaimsList(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialParamClaim) {
      setSelectedClaimId(initialParamClaim);
    }
  }, [initialParamClaim]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Reading and validating geospatial parcel file...");

    try {
      const claimIdNum = targetClaimId ? parseInt(targetClaimId) : undefined;
      const res = await api.uploadGeospatialFile(file, claimIdNum, "FIELD_SURVEY_UPLOAD");
      
      const newClaimId = res.parcels?.[0]?.claim_id || (claimIdNum ? claimsList.find(c => c.id === claimIdNum)?.claim_id : undefined);

      setUploadStatus(`✓ Success! ${res.message || "Boundary geometry uploaded and geodesic area calculated."}`);
      setIsUploading(false);
      
      if (newClaimId) {
        setSelectedClaimId(newClaimId);
      }

      // Refresh map layers & zoom into newly uploaded parcel
      setTimeout(() => {
        setMapKey(Date.now());
        if (newClaimId) {
          setSelectedClaimId(newClaimId);
        }
        api.getClaims({ limit: 100 })
          .then((data) => setClaimsList(data))
          .catch(() => {});
        setTimeout(() => setShowUploadModal(false), 1200);
      }, 800);
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus(`Error: ${err.message || "Failed to process geospatial file. Must be valid GeoJSON or KML."}`);
    }
  };

  const filteredSearchResults = searchQuery.trim()
    ? claimsList.filter(
        (c) =>
          c.claim_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.applicant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.district && c.district.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 6)
    : [];

  return (
    <div className="relative w-full h-[calc(100dvh-var(--header-height))] overflow-hidden bg-slate-950">
      {/* Top Search & Filter Bar Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
        <div className="relative">
          <div className="glass-panel-glow p-2 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700/60">
            <Search className="w-4 h-4 text-emerald-400 ml-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by Claim ID, Applicant, or Village..."
              className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowDropdown(false);
                }}
                className="text-xs text-slate-400 hover:text-white px-2"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => {
                setUploadStatus(null);
                setShowUploadModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Boundary</span>
            </button>
          </div>

          {/* Live Search Suggestions Dropdown */}
          {showDropdown && filteredSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 glass-panel-glow rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl overflow-hidden z-30 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSearchResults.map((claim) => (
                <button
                  key={claim.id}
                  onClick={() => {
                    setSelectedClaimId(claim.claim_id);
                    setSearchQuery(claim.claim_id);
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-emerald-50/90 dark:hover:bg-slate-800/80 flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 block">{claim.claim_id}</span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{claim.applicant_name} • {claim.village}, {claim.district}</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-slate-300 font-mono font-semibold">
                    {claim.claim_type} Title
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* WebGIS Fullscreen Map */}
      <WebGISMap
        key={mapKey}
        selectedClaimId={selectedClaimId}
        onSelectClaim={(id) => setSelectedClaimId(id)}
        height="h-[calc(100dvh-var(--header-height))]"
      />

      {/* Upload Boundary Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-glow p-6 rounded-3xl max-w-md w-full border border-slate-700 space-y-4 animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Upload Real Parcel Boundary</h3>
                  <p className="text-xs text-slate-400">Attach surveyed GPS polygon or multi-parcel GeoJSON</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Claim Selector (Optional) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Assign to Claim (Optional):</label>
              <select
                value={targetClaimId}
                onChange={(e) => setTargetClaimId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Auto-Detect / Multi-Parcel FeatureCollection</option>
                {claimsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.claim_id} - {c.applicant_name} ({c.village})
                  </option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-colors bg-slate-900/40">
              <MapPin className="w-8 h-8 text-emerald-400 mx-auto" />
              <label className="block text-xs font-semibold text-slate-200 cursor-pointer">
                Select GeoJSON or KML File
                <input
                  type="file"
                  accept=".geojson,.json,.kml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-500 block">
                Supported: .geojson, .json, .kml (WGS84 EPSG:4326)
              </span>
            </div>

            {isUploading && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Uploading and computing geodesic area...</span>
              </div>
            )}

            {uploadStatus && !isUploading && (
              <div className={`text-xs p-3 rounded-xl border flex items-start gap-2 ${
                uploadStatus.startsWith("✓") 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadStatus}</span>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AtlasPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-[calc(100dvh-var(--header-height))] bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading FRA WebGIS Atlas...</span>
        </div>
      </div>
    }>
      <AtlasContent />
    </Suspense>
  );
}
