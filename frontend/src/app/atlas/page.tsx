"use client";

import React, { useState, useEffect } from "react";
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
  Plus
} from "lucide-react";
import { api } from "@/lib/api";
import { FRAClaim } from "@/lib/types";

export default function AtlasPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [claimsList, setClaimsList] = useState<FRAClaim[]>([]);
  const [targetClaimId, setTargetClaimId] = useState<string>("");
  const [mapKey, setMapKey] = useState(Date.now());

  useEffect(() => {
    api.getClaims({ limit: 100 })
      .then((data) => setClaimsList(data))
      .catch(() => {});
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Reading and validating geospatial parcel file...");

    try {
      const claimIdNum = targetClaimId ? parseInt(targetClaimId) : undefined;
      const res = await api.uploadGeospatialFile(file, claimIdNum, "FIELD_SURVEY_UPLOAD");
      
      setUploadStatus(`✓ Success! ${res.message || "Boundary geometry uploaded and geodesic area calculated."}`);
      setIsUploading(false);
      
      // Refresh map layers
      setTimeout(() => {
        setMapKey(Date.now());
        api.getClaims({ limit: 100 })
          .then((data) => setClaimsList(data))
          .catch(() => {});
        setTimeout(() => setShowUploadModal(false), 1500);
      }, 1000);
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus(`Error: ${err.message || "Failed to process geospatial file. Must be valid GeoJSON or KML."}`);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-slate-950">
      {/* Top Search & Filter Bar Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
        <div className="glass-panel-glow p-2 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700/60">
          <Search className="w-4 h-4 text-emerald-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Claim ID, Applicant, or Village..."
            className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
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
      </div>

      {/* WebGIS Fullscreen Map */}
      <WebGISMap
        key={mapKey}
        selectedClaimId={selectedClaimId}
        onSelectClaim={(id) => setSelectedClaimId(id)}
        height="h-[calc(100vh-64px)]"
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
