"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle, Layers, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatArea, getStatusBadgeColor } from "@/lib/utils";

interface WebGISMapProps {
  initialGeometries?: any;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  height?: string;
  enableDrawing?: boolean;
  onGeometrySaved?: (geometry: any) => void;
}

type SpectralLayer = "none" | "rgb" | "cir" | "ndvi" | "ndwi" | "ndbi";
type BoundaryFilter = "ALL" | "IFR" | "CR" | "CFR" | "FLAGGED";

const EMPTY_COLLECTION: any = { type: "FeatureCollection", features: [] };

function featureBounds(feature: any): [[number, number], [number, number]] | null {
  const bbox = feature?.properties?.bbox;
  if (Array.isArray(bbox) && bbox.length === 4) return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
  const coordinates: number[][] = [];
  const walk = (item: any) => {
    if (!Array.isArray(item)) return;
    if (typeof item[0] === "number" && typeof item[1] === "number") coordinates.push(item);
    else item.forEach(walk);
  };
  walk(feature?.geometry?.coordinates);
  if (!coordinates.length) return null;
  return coordinates.reduce(
    (bounds, [lng, lat]) => [[Math.min(bounds[0][0], lng), Math.min(bounds[0][1], lat)], [Math.max(bounds[1][0], lng), Math.max(bounds[1][1], lat)]],
    [[Infinity, Infinity], [-Infinity, -Infinity]] as [[number, number], [number, number]],
  );
}

export default function WebGISMap({ initialGeometries, selectedClaimId, onSelectClaim, height = "h-[calc(100vh-64px)]" }: WebGISMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectClaimRef = useRef(onSelectClaim);
  const [geometries, setGeometries] = useState<any>(initialGeometries || null);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<BoundaryFilter>("ALL");
  // Keep the uploaded survey boundary unobscured on first load.  Spectral
  // rasters remain available through the existing layer controls.
  const [activeIndicesOverlay, setActiveIndicesOverlay] = useState<SpectralLayer>("none");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectClaimRef.current = onSelectClaim;
  }, [onSelectClaim]);

  useEffect(() => {
    if (initialGeometries) { setGeometries(initialGeometries); return; }
    fetch("/api/geometries", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load parcel boundaries");
        return res.json();
      })
      .then(setGeometries)
      .catch(() => setGeometries(EMPTY_COLLECTION));
  }, [initialGeometries]);

  const selectFeature = useCallback((feature: any, fly = true) => {
    if (!feature) return;
    setSelectedFeature(feature.properties);
    onSelectClaimRef.current?.(feature.properties?.claim_id);
    const bounds = featureBounds(feature);
    if (fly && bounds && mapRef.current) mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 900 });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "sentinel-basemap": { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "© Esri, Maxar, Earthstar Geographics" },
        },
        layers: [
          { id: "sentinel-basemap", type: "raster", source: "sentinel-basemap" },
        ],
      },
      center: [86.74512, 21.93245], zoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.on("load", () => {
      if (mapRef.current !== map) return;
      map.addSource("fra-parcels", { type: "geojson", data: EMPTY_COLLECTION });
      map.addSource("fra-selected-parcel", { type: "geojson", data: EMPTY_COLLECTION });
      // The fill layer remains solely as a transparent interaction target;
      // it never masks the satellite basemap or the uploaded boundary.
      map.addLayer({
        id: "fra-parcels-fill",
        type: "fill",
        source: "fra-parcels",
        paint: { "fill-color": "#000000", "fill-opacity": 0 },
      });
      map.addLayer({
        id: "fra-parcels-line",
        type: "line",
        source: "fra-parcels",
        paint: {
          "line-color": ["case", ["boolean", ["get", "flag_for_review"], false], "#ef4444", ["match", ["get", "claim_type"], "CR", "#facc15", "CFR", "#a78bfa", "#10b981"]],
          "line-width": 3,
          "line-opacity": 1,
        },
      });
      // The currently opened claim is always distinguished by a clear red
      // outline, while its polygon interior stays transparent.
      map.addLayer({
        id: "fra-selected-parcel-line",
        type: "line",
        source: "fra-selected-parcel",
        paint: { "line-color": "#ff0000", "line-width": 6, "line-opacity": 1 },
      });
      map.on("click", "fra-parcels-fill", (event: any) => {
        const feature = event.features?.[0];
        if (feature) selectFeature(feature);
      });
      map.on("mouseenter", "fra-parcels-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fra-parcels-fill", () => { map.getCanvas().style.cursor = ""; });
      setMapReady(true);
    });
    return () => {
      if (mapRef.current === map) mapRef.current = null;
      map.remove();
    };
  }, [selectFeature]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const filtered = (geometries?.features || []).filter((feature: any) => activeLayer === "ALL" || (activeLayer === "FLAGGED" ? feature.properties?.flag_for_review : feature.properties?.claim_type === activeLayer));
    const parcelSource = map.getSource("fra-parcels") as maplibregl.GeoJSONSource | undefined;
    if (!parcelSource) return;
    parcelSource.setData({ ...EMPTY_COLLECTION, features: filtered } as any);
    const normalizedSelectedId = String(selectedClaimId || "").trim().toLowerCase();
    const selected = (geometries?.features || []).find((feature: any) => String(feature.properties?.claim_id || "").trim().toLowerCase() === normalizedSelectedId || String(feature.properties?.db_claim_id) === String(selectedClaimId));
    if (selected) selectFeature(selected, true);
    else if (filtered.length && !selectedClaimId) {
      const allBounds = filtered.map(featureBounds).filter(Boolean) as [[number, number], [number, number]][];
      if (allBounds.length) map.fitBounds(allBounds.reduce((a, b) => [[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]]), { padding: 60, maxZoom: 15, duration: 0 });
    }
  }, [activeLayer, geometries, mapReady, selectedClaimId, selectFeature]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const selectedSource = mapRef.current.getSource("fra-selected-parcel") as maplibregl.GeoJSONSource | undefined;
    if (!selectedSource) return;

    const selectedClaimKey = String(selectedFeature?.claim_id || selectedClaimId || "").trim().toLowerCase();
    const selectedDbId = String(selectedFeature?.db_claim_id || "").trim();
    const selected = (geometries?.features || []).find((feature: any) => {
      const featureClaimKey = String(feature.properties?.claim_id || "").trim().toLowerCase();
      const featureDbId = String(feature.properties?.db_claim_id || "").trim();
      return (selectedClaimKey !== "" && featureClaimKey === selectedClaimKey)
        || (selectedDbId !== "" && featureDbId === selectedDbId);
    });
    selectedSource.setData(selected
      ? { type: "FeatureCollection", features: [selected] }
      : EMPTY_COLLECTION);
  }, [geometries, mapReady, selectedClaimId, selectedFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (map.getLayer("sentinel-2-raster")) map.removeLayer("sentinel-2-raster");
    if (map.getSource("sentinel-2-raster")) map.removeSource("sentinel-2-raster");
    const feature = (geometries?.features || []).find((item: any) => item.properties?.claim_id === selectedFeature?.claim_id || String(item.properties?.db_claim_id) === String(selectedFeature?.db_claim_id));
    const bounds = featureBounds(feature);
    if (!feature || !bounds || activeIndicesOverlay === "none") return;
    const id = feature.properties?.db_claim_id || feature.properties?.claim_id;
    const image = `/api/sentinel/image/${id}/${activeIndicesOverlay}?refresh=true&v=${encodeURIComponent(feature.properties?.satellite_date || "latest")}`;
    map.addSource("sentinel-2-raster", { type: "image", url: image, coordinates: [[bounds[0][0], bounds[1][1]], [bounds[1][0], bounds[1][1]], [bounds[1][0], bounds[0][1]], [bounds[0][0], bounds[0][1]]] });
    map.addLayer({ id: "sentinel-2-raster", type: "raster", source: "sentinel-2-raster", paint: { "raster-opacity": 0.94 } }, "fra-parcels-fill");
  }, [activeIndicesOverlay, geometries, mapReady, selectedFeature]);

  const visibleCount = (geometries?.features || []).filter((feature: any) => activeLayer === "ALL" || (activeLayer === "FLAGGED" ? feature.properties?.flag_for_review : feature.properties?.claim_type === activeLayer)).length;

  return <div className={`relative w-full ${height} overflow-hidden bg-slate-950`}>
    <div ref={containerRef} className="maplibre-container absolute inset-0" aria-label="Copernicus Sentinel-2 WebGIS map" />
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="glass-panel p-3 rounded-xl shadow-xl w-64 text-xs space-y-3">
        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2"><span className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-emerald-500" /> FRA Atlas Layers</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-mono">{visibleCount} Parcels</span></div>
        <div><label className="text-[10px] font-semibold text-slate-500 uppercase">Boundary Category</label><div className="grid grid-cols-3 gap-1 mt-1">{(["ALL", "IFR", "CR", "CFR", "FLAGGED"] as BoundaryFilter[]).map((item) => <button key={item} onClick={() => setActiveLayer(item)} className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${activeLayer === item ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"} ${item === "FLAGGED" ? "col-span-2 border border-rose-300" : ""}`}>{item === "FLAGGED" ? "⚠ Discrepancies" : item}</button>)}</div></div>
        <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800"><label className="text-[10px] font-semibold text-slate-500 uppercase flex items-center justify-between">Sentinel-2 spectral layers <Sparkles className="w-3 h-3 text-emerald-600" /></label><div className="grid grid-cols-3 gap-1">{([{ id: "none", label: "Vector only" }, { id: "rgb", label: "RGB (B4,B3,B2)" }, { id: "cir", label: "CIR (B8,B4,B3)" }, { id: "ndvi", label: "NDVI (Veg)" }, { id: "ndwi", label: "NDWI (Water)" }, { id: "ndbi", label: "NDBI (Built)" }] as { id: SpectralLayer; label: string }[]).map((item) => <button key={item.id} title={item.label} onClick={() => setActiveIndicesOverlay(item.id)} className={`px-1 py-1 rounded-lg font-mono text-[9px] truncate ${activeIndicesOverlay === item.id ? "bg-emerald-500/20 text-emerald-700 border border-emerald-500/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>{item.label}</button>)}</div></div>
      </div>
      <div className="glass-panel p-2.5 rounded-xl shadow-lg w-64 text-[11px]"><span className="font-semibold text-slate-500 text-[10px] uppercase">Legend</span><div className="grid grid-cols-2 gap-2 mt-1.5 text-slate-700 dark:text-slate-300"><span>🟩 IFR (Individual)</span><span>🟨 CR (Community)</span><span>🟪 CFR (Resource)</span><span>🟥 Area Discrepancy</span></div></div>
    </div>
    {selectedFeature && <div className="absolute top-4 right-4 z-10 w-80 glass-panel-glow p-5 rounded-2xl shadow-2xl space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto"><div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3"><div><div className="flex items-center gap-2"><span className="font-mono font-bold text-base text-emerald-600">{selectedFeature.claim_id}</span><span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getStatusBadgeColor(selectedFeature.status)}`}>{selectedFeature.status}</span></div><p className="text-xs text-slate-500">{selectedFeature.village}, {selectedFeature.district}, {selectedFeature.state}</p></div><button onClick={() => setSelectedFeature(null)} className="text-slate-500 text-lg">×</button></div>{selectedFeature.flag_for_review && <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 flex gap-2 text-xs text-rose-600"><AlertTriangle className="w-5 h-5 shrink-0" /> Area discrepancy flagged. Field verification required.</div>}<div className="grid grid-cols-2 gap-3 text-xs"><div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl"><span className="text-slate-500 block">Applicant</span><strong>{selectedFeature.applicant_name}</strong></div><div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl"><span className="text-slate-500 block">GIS area</span><strong className="text-emerald-600">{formatArea(selectedFeature.calculated_area_hectares || 0)}</strong></div></div><div className="rounded-xl border border-emerald-500/20 p-3 text-xs"><div className="font-semibold flex gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> Copernicus Sentinel-2</div><p className="mt-1 text-slate-500">Acquisition: {selectedFeature.satellite_date || "loading latest observation"}</p><p className="mt-1 text-slate-500">Active visualization: {activeIndicesOverlay.toUpperCase()}</p></div><Link href={`/claims/${selectedFeature.db_claim_id || selectedFeature.claim_id}`} className="block text-center rounded-xl bg-emerald-600 py-3 text-xs font-semibold text-white">Open Claim Workspace ↗</Link></div>}
    <div className="absolute bottom-2 right-3 z-10 text-[10px] bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded text-slate-600">Copernicus Sentinel-2 WebGIS · rendered with MapLibre GL</div>
  </div>;
}
