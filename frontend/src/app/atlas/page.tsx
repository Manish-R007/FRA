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
  ChevronRight,
  Map
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import { FRAClaim } from "@/lib/types";

function AtlasContent() {
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
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
    api.getClaims({ limit: 500 })
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
        api.getClaims({ limit: 500 })
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
    <div className="relative w-full h-[calc(100dvh-var(--header-height))] overflow-hidden bg-[#06140f]">
      {/* Top Search & Filter Bar Overlay */}
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="relative">
          <div className="glass-panel-glow p-2 rounded-2xl shadow-xl flex items-center gap-2">
            <Search className="w-4 h-4 text-[#4a9460] ml-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by Claim ID, Applicant, or Village..."
              className="w-full bg-transparent border-none text-xs text-[#1a2f23] focus:outline-none placeholder-[#8c9d8f]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowDropdown(false);
                }}
                className="text-xs text-[#8c9d8f] hover:text-[#3d5a46] px-2 transition-colors"
              >
                <X size={14} />
              </button>
            )}
            <motion.button
              onClick={() => {
                setUploadStatus(null);
                setShowUploadModal(true);
              }}
              className="btn-gold !py-2 !px-3.5 text-xs shrink-0"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Boundary</span>
            </motion.button>
          </div>

          {/* Live Search Suggestions Dropdown */}
          <AnimatePresence>
            {showDropdown && filteredSearchResults.length > 0 && (
              <motion.div
                className="absolute top-full left-0 right-0 mt-2 glass-panel-glow rounded-2xl shadow-xl overflow-hidden z-30 divide-y divide-[#f0f1e9]"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {filteredSearchResults.map((claim) => (
                  <button
                    key={claim.id}
                    onClick={() => {
                      setSelectedClaimId(claim.claim_id);
                      setSearchQuery(claim.claim_id);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-[#f0f8f1] flex items-center justify-between text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e4ede0] text-[#3d7a4f] group-hover:bg-[#d8e6d0] transition-colors">
                        <MapPin className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <span className="font-mono font-bold text-[#3d7a4f] block">{claim.claim_id}</span>
                        <span className="text-[11px] text-[#68806e]">{claim.applicant_name} • {claim.village}, {claim.district}</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e4ede0] text-[#3d7a4f] font-mono font-semibold">
                      {claim.claim_type}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* WebGIS Fullscreen Map */}
      <WebGISMap
        key={mapKey}
        selectedClaimId={selectedClaimId}
        claims={claimsList}
        showClaimMarkers
        onSelectClaim={(id) => setSelectedClaimId(id)}
        height="h-[calc(100dvh-var(--header-height))]"
      />

      {/* Upload Boundary Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            className="fixed inset-0 z-50 fra-modal-backdrop flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-panel-glow p-6 rounded-[1.6rem] max-w-md w-full space-y-4 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 6 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="flex items-center justify-between border-b border-[#e5ebe5] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="icon-chip">
                    <Upload className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-base text-[#1a2f23]">Upload Real Parcel Boundary</h3>
                    <p className="text-xs text-[#68806e]">Attach surveyed GPS polygon or multi-parcel GeoJSON</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-[#8c9d8f] hover:text-[#3d5a46] p-1.5 rounded-lg hover:bg-[#f0f1e9] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Claim Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#3d5a46]">Assign to Claim (Optional):</label>
                <select
                  value={targetClaimId}
                  onChange={(e) => setTargetClaimId(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#dce6e0] text-xs text-[#1a2f23] focus:outline-none focus:border-[#68b07a]"
                >
                  <option value="">Auto-Detect / Multi-Parcel FeatureCollection</option>
                  {claimsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.claim_id} - {c.applicant_name} ({c.village})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-[#d5dec9] hover:border-[#8cc99a] rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-colors bg-[#faf9f4]">
                <MapPin className="w-8 h-8 text-[#4a9460] mx-auto" />
                <label className="block text-xs font-semibold text-[#1a2f23] cursor-pointer">
                  Select GeoJSON or KML File
                  <input
                    type="file"
                    accept=".geojson,.json,.kml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-[#8c9d8f] block">
                  Supported: .geojson, .json, .kml (WGS84 EPSG:4326)
                </span>
              </div>

              {isUploading && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#f0f8f1] border border-[#c5d4b8] text-xs text-[#3d7a4f]">
                  <div className="w-4 h-4 border-2 border-[#4a9460] border-t-transparent rounded-full animate-spin"></div>
                  <span>Uploading and computing geodesic area...</span>
                </div>
              )}

              {uploadStatus && !isUploading && (
                <div className={`text-xs p-3 rounded-xl border flex items-start gap-2 ${
                  uploadStatus.startsWith("✓")
                    ? "bg-[#f0f8f1] border-[#c5d4b8] text-[#2a4e34]"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadStatus}</span>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#e5ebe5]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#f0f1e9] text-[#3d5a46] border border-[#dce6e0] text-xs font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AtlasPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-[calc(100dvh-var(--header-height))] bg-[#f0f1e9] flex items-center justify-center text-[#68806e]">
        <div className="flex flex-col items-center gap-3">
          <span className="icon-chip !h-12 !w-12">
            <Map className="w-6 h-6" />
          </span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#4a9460] border-t-transparent rounded-full animate-spin"></div>
            <span>Loading FRA WebGIS Atlas...</span>
          </div>
        </div>
      </div>
    }>
      <AtlasContent />
    </Suspense>
  );
}
