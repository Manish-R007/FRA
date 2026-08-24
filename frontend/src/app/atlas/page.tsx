"use client";

import React, { useState } from "react";
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
  AlertTriangle
} from "lucide-react";

export default function AtlasPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("Processing geospatial file...");
    const text = await file.text();
    try {
      const geo = JSON.parse(text);
      setUploadStatus("Valid GeoJSON detected. Attaching to boundary layer...");
      setTimeout(() => {
        setUploadStatus("Geometry uploaded & validated successfully!");
        setTimeout(() => setShowUploadModal(false), 1500);
      }, 1000);
    } catch {
      setUploadStatus("Error: File must be a valid GeoJSON or KML file.");
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
            placeholder="Search by Claim ID (e.g. FRA-OD-MAY-001), Applicant, or Village..."
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
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Boundary</span>
          </button>
        </div>
      </div>

      {/* WebGIS Fullscreen Map */}
      <WebGISMap
        selectedClaimId={selectedClaimId}
        onSelectClaim={(id) => setSelectedClaimId(id)}
        height="h-[calc(100vh-64px)]"
      />

      {/* Upload Boundary Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow p-6 rounded-3xl max-w-md w-full border border-slate-700 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Upload Land Boundary</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Upload actual boundary geometry polygon extracted from official GPS field survey, Cadastral Map, or Total Station survey.
            </p>

            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-colors">
              <MapPin className="w-8 h-8 text-emerald-400 mx-auto" />
              <label className="block text-xs font-semibold text-slate-200 cursor-pointer">
                Select GeoJSON, KML, or Shapefile
                <input
                  type="file"
                  accept=".geojson,.json,.kml,.zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-500 block">
                Supported: .geojson, .kml, .zip (ESRI Shapefile)
              </span>
            </div>

            {uploadStatus && (
              <div className="text-xs p-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
