"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2, 
  MapPin, 
  Sparkles, 
  AlertTriangle, 
  Activity, 
  Droplets, 
  Trees, 
  Wheat, 
  Home, 
  Navigation,
  Upload,
  Download,
  Info,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { formatArea, getStatusBadgeColor } from "@/lib/utils";

// Dynamically import Leaflet components to avoid SSR window error
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
);
const FeatureGroup = dynamic(
  () => import("react-leaflet").then((mod) => mod.FeatureGroup),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface WebGISMapProps {
  initialGeometries?: any;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  height?: string;
  enableDrawing?: boolean;
  onGeometrySaved?: (geometry: any) => void;
}

export default function WebGISMap({
  initialGeometries,
  selectedClaimId,
  onSelectClaim,
  height = "h-[calc(100vh-64px)]",
  enableDrawing = true,
  onGeometrySaved,
}: WebGISMapProps) {
  const [geometries, setGeometries] = useState<any>(initialGeometries || null);
  const [activeBasemap, setActiveBasemap] = useState<"osm" | "dark" | "satellite">("dark");
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<"ALL" | "IFR" | "CR" | "CFR" | "FLAGGED">("ALL");
  const [showSatelliteOverlay, setShowSatelliteOverlay] = useState(true);
  const [showAssetsOverlay, setShowAssetsOverlay] = useState(true);
  const [activeIndicesOverlay, setActiveIndicesOverlay] = useState<"none" | "ndvi" | "ndwi" | "ndbi">("none");
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mapRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
    if (!initialGeometries) {
      fetch("/api/geometries")
        .then((res) => res.json())
        .then((data) => setGeometries(data))
        .catch(() => {});
    }
  }, [initialGeometries]);

  // Styling rule per claim type and discrepancy flag
  const getFeatureStyle = (feature: any) => {
    const props = feature.properties || {};
    const claimType = props.claim_type;
    const isFlagged = props.flag_for_review;
    const isSelected = selectedClaimId && props.claim_id === selectedClaimId;

    if (isFlagged) {
      return {
        fillColor: "#ef4444",
        weight: isSelected ? 3 : 2,
        opacity: 1,
        color: "#f87171",
        dashArray: "4, 4",
        fillOpacity: isSelected ? 0.65 : 0.45,
      };
    }

    if (isSelected) {
      return {
        fillColor: "#38bdf8",
        weight: 3,
        opacity: 1,
        color: "#0284c7",
        fillOpacity: 0.7,
      };
    }

    switch (claimType) {
      case "IFR":
        return {
          fillColor: "#10b981", // Emerald
          weight: 2,
          opacity: 0.9,
          color: "#059669",
          fillOpacity: 0.45,
        };
      case "CR":
        return {
          fillColor: "#f59e0b", // Amber
          weight: 2,
          opacity: 0.9,
          color: "#d97706",
          fillOpacity: 0.45,
        };
      case "CFR":
        return {
          fillColor: "#8b5cf6", // Purple
          weight: 2,
          opacity: 0.9,
          color: "#7c3aed",
          fillOpacity: 0.45,
        };
      default:
        return {
          fillColor: "#22c55e",
          weight: 2,
          opacity: 0.8,
          color: "#16a34a",
          fillOpacity: 0.4,
        };
    }
  };

  const onEachFeature = (feature: any, layer: any) => {
    layer.on({
      click: () => {
        setSelectedFeature(feature.properties);
        if (onSelectClaim && feature.properties?.claim_id) {
          onSelectClaim(feature.properties.claim_id);
        }
      },
      mouseover: (e: any) => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          fillOpacity: 0.65,
        });
      },
      mouseout: (e: any) => {
        const l = e.target;
        l.setStyle(getFeatureStyle(feature));
      },
    });
  };

  // Filter features by active layer
  const filteredFeatures = geometries?.features?.filter((f: any) => {
    if (activeLayer === "ALL") return true;
    if (activeLayer === "FLAGGED") return f.properties?.flag_for_review;
    return f.properties?.claim_type === activeLayer;
  });

  const filteredGeoJSON = geometries
    ? { ...geometries, features: filteredFeatures || [] }
    : null;

  if (!isMounted) {
    return (
      <div className={`w-full ${height} bg-slate-950 flex items-center justify-center text-slate-400`}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading FRA WebGIS Atlas...</span>
        </div>
      </div>
    );
  }

  // Base tile URLs
  const basemapUrls = {
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  };

  return (
    <div className={`relative w-full ${height} overflow-hidden`}>
      {/* Map Component */}
      <MapContainer
        center={[21.93245, 86.74512]}
        zoom={13}
        className="w-full h-full z-0"
        ref={mapRef}
      >
        <TileLayer
          url={basemapUrls[activeBasemap]}
          attribution='&copy; <a href="https://carto.com/">CARTO</a> | Sentinel-2 MoTA WebGIS'
        />

        {filteredGeoJSON && (
          <GeoJSON
            key={`${activeLayer}-${activeBasemap}-${filteredGeoJSON.features.length}`}
            data={filteredGeoJSON}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Floating Layer Controls Panel (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {/* Layer Toggles Card */}
        <div className="glass-panel p-3 rounded-xl shadow-xl w-64 text-xs space-y-3">
          <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-500" />
              FRA Atlas Layers
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              {filteredFeatures?.length || 0} Parcels
            </span>
          </div>

          {/* Filter By Claim Type */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Boundary Category</label>
            <div className="grid grid-cols-3 gap-1">
              {(["ALL", "IFR", "CR", "CFR", "FLAGGED"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setActiveLayer(l)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    activeLayer === l
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  } ${l === "FLAGGED" ? "col-span-2 text-rose-400 border border-rose-500/30" : ""}`}
                >
                  {l === "FLAGGED" ? "⚠️ Discrepancies" : l}
                </button>
              ))}
            </div>
          </div>

          {/* Basemap Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Basemap Style</label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: "dark", label: "Dark Carto" },
                { id: "osm", label: "OSM Standard" },
                { id: "satellite", label: "Satellite" },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setActiveBasemap(b.id as any)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    activeBasemap === b.id
                      ? "bg-slate-900 dark:bg-slate-700 text-white font-semibold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spectral Remote Sensing Layer Overlays */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <label className="text-[10px] font-semibold text-slate-400 uppercase flex items-center justify-between">
              <span>Sentinel-2 Spectral Indices</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </label>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {[
                { id: "none", label: "Standard" },
                { id: "ndvi", label: "NDVI", color: "text-emerald-400" },
                { id: "ndwi", label: "NDWI", color: "text-blue-400" },
                { id: "ndbi", label: "NDBI", color: "text-amber-400" },
              ].map((idx) => (
                <button
                  key={idx.id}
                  onClick={() => setActiveIndicesOverlay(idx.id as any)}
                  className={`px-1.5 py-1 rounded font-mono ${
                    activeIndicesOverlay === idx.id
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  {idx.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* WebGIS Legend Card */}
        <div className="glass-panel p-2.5 rounded-xl shadow-lg w-64 text-[11px] space-y-1.5">
          <span className="font-semibold text-slate-300 text-[10px] uppercase">Legend</span>
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-400"></span>
              <span>IFR (Individual)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/80 border border-amber-400"></span>
              <span>CR (Community)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-500/80 border border-purple-400"></span>
              <span>CFR (Resource)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500/80 border border-rose-400 border-dashed"></span>
              <span>Area Discrepancy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Parcel Inspector Floating Drawer (Right Side) */}
      {selectedFeature && (
        <div className="absolute top-4 right-4 z-10 w-96 glass-panel-glow p-5 rounded-2xl shadow-2xl space-y-4 animate-in slide-in-from-right-4 duration-200">
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                  {selectedFeature.claim_id}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getStatusBadgeColor(selectedFeature.status)}`}>
                  {selectedFeature.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedFeature.village}, {selectedFeature.district}, {selectedFeature.state}
              </p>
            </div>
            <button
              onClick={() => setSelectedFeature(null)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-md hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Area Discrepancy Warning if Flagged */}
          {selectedFeature.flag_for_review && (
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-rose-200 font-semibold">Area Discrepancy Flagged</strong>
                Claimed: {selectedFeature.area_claimed_hectares} Ha vs GIS Boundary: {selectedFeature.calculated_area_hectares} Ha ({selectedFeature.area_difference_percentage}% difference). Field verification required.
              </div>
            </div>
          )}

          {/* Key Claimant & Spatial Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Applicant</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm">{selectedFeature.applicant_name}</strong>
              <span className="text-[10px] text-slate-500 block">S/o {selectedFeature.father_or_husband_name || "N/A"}</span>
            </div>

            <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">GIS Calculated Area</span>
              <strong className="text-emerald-500 text-sm">{selectedFeature.calculated_area_hectares} Ha</strong>
              <span className="text-[10px] text-slate-500 block">({(selectedFeature.calculated_area_m2 || 0).toLocaleString()} m²)</span>
            </div>
          </div>

          {/* Sentinel-2 Land Cover Segmentation Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                AI Land-Cover Segmentation
              </span>
              <span className="text-[10px] text-slate-500">
                Confidence: {(selectedFeature.ai_confidence * 100).toFixed(0)}%
              </span>
            </div>

            {/* Progress Bars */}
            <div className="space-y-1.5 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span className="flex items-center gap-1"><Trees className="w-3 h-3 text-emerald-500" /> Forest Canopy</span>
                  <span className="font-mono text-emerald-400">{selectedFeature.forest_percentage || 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedFeature.forest_percentage || 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span className="flex items-center gap-1"><Wheat className="w-3 h-3 text-lime-500" /> Cultivated Crop</span>
                  <span className="font-mono text-lime-400">{selectedFeature.crop_percentage || 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-lime-500 h-full rounded-full" style={{ width: `${selectedFeature.crop_percentage || 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-500" /> Water Body</span>
                  <span className="font-mono text-blue-400">{selectedFeature.water_percentage || 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${selectedFeature.water_percentage || 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span className="flex items-center gap-1"><Home className="w-3 h-3 text-rose-500" /> Homestead / Built-up</span>
                  <span className="font-mono text-rose-400">{selectedFeature.building_percentage || 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${selectedFeature.building_percentage || 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Drilldown Button */}
          <Link
            href={`/claims/${selectedFeature.db_claim_id || selectedFeature.claim_id}`}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
          >
            <span>Open Claim Workspace</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
