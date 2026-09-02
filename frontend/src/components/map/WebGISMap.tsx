"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  // Next.js does not emit MapLibre's worker + shared sibling, so GeoJSON
  // polygons never tessellate while raster tiles still appear.
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
import { AlertTriangle, Layers, MapPin, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { formatArea, getStatusBadgeColor } from "@/lib/utils";
import { api } from "@/lib/api";
import type { FRAClaim } from "@/lib/types";

interface WebGISMapProps {
  initialGeometries?: any;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  height?: string;
  enableDrawing?: boolean;
  onGeometrySaved?: (geometry: any) => void;
  claims?: FRAClaim[];
  showClaimMarkers?: boolean;
}

type SpectralLayer = "none" | "rgb" | "cir" | "ndvi" | "ndwi" | "ndbi";
type BoundaryFilter = "ALL" | "IFR" | "CR" | "CFR" | "FLAGGED";

const EMPTY_COLLECTION: any = { type: "FeatureCollection", features: [] };

function unwrapGeometry(geom: any): any {
  if (!geom) return geom;
  if (typeof geom === "string") {
    try { geom = JSON.parse(geom); } catch { return geom; }
  }
  if (geom.type === "Feature") return unwrapGeometry(geom.geometry);
  if (geom.type === "FeatureCollection") return unwrapGeometry(geom.features?.[0]?.geometry);
  if (geom.type === "GeometryCollection") {
    const polys = (geom.geometries || []).filter((item: any) => item?.type === "Polygon" || item?.type === "MultiPolygon");
    if (polys.length === 1) return unwrapGeometry(polys[0]);
    if (polys.length > 1) {
      return {
        type: "MultiPolygon",
        coordinates: polys.flatMap((item: any) => item.type === "Polygon" ? [item.coordinates] : item.coordinates || []),
      };
    }
  }
  return geom;
}

function asFeatureCollection(data: any): any {
  const features = (data?.features || []).map((feature: any) => ({
    ...feature,
    type: "Feature",
    geometry: unwrapGeometry(feature?.geometry),
    properties: feature?.properties || {},
  })).filter((feature: any) => feature.geometry?.type && feature.geometry?.coordinates);
  return { type: "FeatureCollection", features };
}

function featureCentroid(feature: any): [number, number] | null {
  const bounds = featureBounds(feature);
  if (!bounds) return null;
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

const PLACE_COORDS: Record<string, [number, number]> = {
  mayurbhanj: [86.73, 21.93],
  baripada: [86.73, 21.93],
  bhopal: [77.41, 23.26],
  "madhya pradesh": [78.0, 23.47],
  odisha: [85.1, 20.95],
  karnataka: [76.86, 15.32],
  telangana: [79.02, 18.11],
  tripura: [91.75, 23.83],
  chhattisgarh: [81.63, 21.28],
  jharkhand: [85.28, 23.61],
  maharashtra: [78.66, 20.59],
};

function fallbackLngLat(claim: FRAClaim, index: number): [number, number] {
  const district = String(claim.district || "").toLowerCase();
  const state = String(claim.state || "").toLowerCase();
  const base = PLACE_COORDS[district] || PLACE_COORDS[state] || [80.0, 22.5];
  const n = Number(claim.id) || index + 1;
  return [base[0] + ((n % 7) - 3) * 0.035, base[1] + ((Math.floor(n / 7) % 7) - 3) * 0.035];
}

function markerColor(claimType?: string, flagged?: boolean) {
  if (flagged) return "#e11d48";
  if (claimType === "CR") return "#ca8a04";
  if (claimType === "CFR") return "#7c3aed";
  return "#059669";
}

function markerSvg(claimType?: string, flagged?: boolean) {
  const fill = markerColor(claimType, flagged);
  const glyph = claimType === "CFR" ? "🌲" : claimType === "CR" ? "👥" : "⌂";
  return `<svg viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 1.5c7.2 0 13 5.7 13 12.8 0 9.6-13 25.2-13 25.2S4 24 17 14.3 17 1.5 17 1.5z" fill="${fill}" stroke="#ffffff" stroke-width="1.6"/>
    <circle cx="17" cy="15" r="8.2" fill="#ffffff"/>
    <text x="17" y="19" text-anchor="middle" font-size="9" font-family="Arial, sans-serif" font-weight="700" fill="${fill}">${glyph === "⌂" ? "IFR" : claimType || "FRA"}</text>
  </svg>`;
}

function claimToProperties(claim: FRAClaim, extra: Record<string, any> = {}) {
  return {
    claim_id: claim.claim_id,
    db_claim_id: claim.id,
    applicant_name: claim.applicant_name,
    father_or_husband_name: claim.father_or_husband_name,
    claim_type: claim.claim_type,
    village: claim.village,
    block: claim.block,
    district: claim.district,
    state: claim.state,
    survey_number: claim.survey_number,
    area_claimed_hectares: claim.area_claimed,
    status: claim.status,
    verification_status: claim.verification_status,
    land_use: claim.land_use,
    has_geometry: claim.has_geometry,
    ...extra,
  };
}
function featureBounds(feature: any): [[number, number], [number, number]] | null {
  const geom = unwrapGeometry(feature?.geometry);
  if (geom?.type === "Point" && Array.isArray(geom.coordinates)) {
    const [lng, lat] = geom.coordinates;
    return [[lng - 0.015, lat - 0.015], [lng + 0.015, lat + 0.015]];
  }
  let bbox = feature?.properties?.bbox;
  if (typeof bbox === "string") {
    try { bbox = JSON.parse(bbox); } catch {}
  }
  if (Array.isArray(bbox) && bbox.length === 4) return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
  const coordinates: number[][] = [];
  const walk = (item: any) => {
    if (!Array.isArray(item)) return;
    if (typeof item[0] === "number" && typeof item[1] === "number") coordinates.push(item);
    else item.forEach(walk);
  };
  walk(unwrapGeometry(feature?.geometry)?.coordinates);
  if (!coordinates.length) return null;
  return coordinates.reduce(
    (bounds, [lng, lat]) => [[Math.min(bounds[0][0], lng), Math.min(bounds[0][1], lat)], [Math.max(bounds[1][0], lng), Math.max(bounds[1][1], lat)]],
    [[Infinity, Infinity], [-Infinity, -Infinity]] as [[number, number], [number, number]],
  );
}

export default function WebGISMap({ initialGeometries, selectedClaimId, onSelectClaim, height = "h-[calc(100vh-64px)]", claims: claimsProp, showClaimMarkers = false }: WebGISMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectClaimRef = useRef(onSelectClaim);
  const [geometries, setGeometries] = useState<any>(initialGeometries || null);
  const [claims, setClaims] = useState<FRAClaim[]>(claimsProp || []);
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
    let cancelled = false;
    api.getGeometries()
      .then((data) => { if (!cancelled) setGeometries(data); })
      .catch(() => { if (!cancelled) setGeometries(EMPTY_COLLECTION); });
    return () => { cancelled = true; };
  }, [initialGeometries]);

  useEffect(() => {
    if (claimsProp) { setClaims(claimsProp); return; }
    if (!showClaimMarkers) return;
    let cancelled = false;
    api.getClaims({ limit: 500 })
      .then((data) => { if (!cancelled) setClaims(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setClaims([]); });
    return () => { cancelled = true; };
  }, [claimsProp, showClaimMarkers]);

  const selectFeature = useCallback((feature: any, fly = true) => {
    if (!feature) return;
    setSelectedFeature(feature.properties);
    onSelectClaimRef.current?.(feature.properties?.claim_id);
    const bounds = featureBounds(feature);
    if (fly && bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 400 });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    
    let initialCenter: [number, number] = showClaimMarkers ? [78.96, 22.59] : [86.74512, 21.93245];
    let initialZoom = showClaimMarkers ? 5 : 12;
    if (initialGeometries?.features?.[0]) {
      const bounds = featureBounds(initialGeometries.features[0]);
      if (bounds) {
        initialCenter = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
        initialZoom = 15;
      }
    }

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
      center: initialCenter,
      zoom: initialZoom,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.on("load", () => {
      if (mapRef.current !== map) return;
      map.addSource("fra-parcels", { type: "geojson", data: EMPTY_COLLECTION });
      map.addSource("fra-selected-parcel", { type: "geojson", data: EMPTY_COLLECTION });
      // Fill layer with subtle red tint for selected parcel
      map.addLayer({
        id: "fra-selected-parcel-fill",
        type: "fill",
        source: "fra-selected-parcel",
        paint: {
          "fill-color": "#ff0000",
          "fill-opacity": 0.15,
        },
      });
      // Transparent fill layer for all parcels (click target)
      map.addLayer({
        id: "fra-parcels-fill",
        type: "fill",
        source: "fra-parcels",
        paint: { "fill-color": "#ff0000", "fill-opacity": 0.18 },
      });
      // White contrast halo around selected parcel boundary for visibility over dark/green terrain
      map.addLayer({
        id: "fra-selected-parcel-halo",
        type: "line",
        source: "fra-selected-parcel",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
      });
      // General parcel red boundary line
      map.addLayer({
        id: "fra-parcels-line",
        type: "line",
        source: "fra-parcels",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff0000",
          "line-width": 4,
          "line-opacity": 1,
        },
      });
      // Highlighted selected claim parcel red boundary line
      map.addLayer({
        id: "fra-selected-parcel-line",
        type: "line",
        source: "fra-selected-parcel",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff0000", "line-width": 5, "line-opacity": 1 },
      });
      map.on("click", "fra-parcels-fill", (event: any) => {
        const feature = event.features?.[0];
        if (feature) selectFeature(feature);
      });
      map.on("mouseenter", "fra-parcels-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fra-parcels-fill", () => { map.getCanvas().style.cursor = ""; });
      map.resize();
      setMapReady(true);
    });
    return () => {
      if (mapRef.current === map) mapRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
    };
  }, [selectFeature, showClaimMarkers]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const filtered = (geometries?.features || []).filter((feature: any) => activeLayer === "ALL" || (activeLayer === "FLAGGED" ? feature.properties?.flag_for_review : feature.properties?.claim_type === activeLayer));
    const parcelSource = map.getSource("fra-parcels") as maplibregl.GeoJSONSource | undefined;
    if (!parcelSource) return;
    parcelSource.setData(asFeatureCollection({ ...EMPTY_COLLECTION, features: filtered }));
    const normalizedSelectedId = String(selectedClaimId || "").trim().toLowerCase();
    const selected = (geometries?.features || []).find((feature: any) => String(feature.properties?.claim_id || "").trim().toLowerCase() === normalizedSelectedId || String(feature.properties?.db_claim_id) === String(selectedClaimId));
    if (selected) selectFeature(selected, true);
    else if (!showClaimMarkers && filtered.length && !selectedClaimId) {
      const allBounds = filtered.map(featureBounds).filter(Boolean) as [[number, number], [number, number]][];
      if (allBounds.length) map.fitBounds(allBounds.reduce((a, b) => [[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]]), { padding: 60, maxZoom: 15, duration: 0 });
    }
  }, [activeLayer, geometries, mapReady, selectedClaimId, selectFeature, showClaimMarkers]);

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
      ? asFeatureCollection({ type: "FeatureCollection", features: [selected] })
      : EMPTY_COLLECTION);
  }, [geometries, mapReady, selectedClaimId, selectedFeature]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !showClaimMarkers) return;
    const map = mapRef.current;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const geomByKey = new Map<string, any>();
    for (const feature of geometries?.features || []) {
      const claimKey = String(feature.properties?.claim_id || "").trim().toLowerCase();
      const dbKey = String(feature.properties?.db_claim_id || "").trim();
      if (claimKey) geomByKey.set(claimKey, feature);
      if (dbKey) geomByKey.set(`id:${dbKey}`, feature);
    }

    const visibleClaims = claims.filter((claim) => {
      if (activeLayer === "ALL") return true;
      if (activeLayer === "FLAGGED") {
        const feature = geomByKey.get(String(claim.claim_id || "").toLowerCase()) || geomByKey.get(`id:${claim.id}`);
        return Boolean(feature?.properties?.flag_for_review);
      }
      return claim.claim_type === activeLayer;
    });

    const positions: [number, number][] = [];
    visibleClaims.forEach((claim, index) => {
      const feature = geomByKey.get(String(claim.claim_id || "").toLowerCase()) || geomByKey.get(`id:${claim.id}`);
      const coords = featureCentroid(feature) || fallbackLngLat(claim, index);
      positions.push(coords);

      const selected = String(selectedFeature?.claim_id || selectedClaimId || "").toLowerCase() === String(claim.claim_id || "").toLowerCase()
        || String(selectedFeature?.db_claim_id || "") === String(claim.id);
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fra-claim-marker";
      el.setAttribute("aria-label", `${claim.claim_id} ${claim.applicant_name}`);
      el.title = `${claim.claim_id} · ${claim.applicant_name}`;
      el.innerHTML = markerSvg(claim.claim_type, feature?.properties?.flag_for_review);
      el.style.cssText = `width:36px;height:44px;border:0;padding:0;background:transparent;cursor:pointer;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45));transform:${selected ? "scale(1.18)" : "scale(1)"};z-index:${selected ? 4 : 2};`;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        selectFeature({
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: claimToProperties(claim, {
            calculated_area_hectares: feature?.properties?.calculated_area_hectares,
            calculated_area_m2: feature?.properties?.calculated_area_m2,
            flag_for_review: feature?.properties?.flag_for_review,
            satellite_date: feature?.properties?.satellite_date,
            geometry_source: feature?.properties?.geometry_source,
          }),
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(coords).addTo(map);
      markersRef.current.push(marker);
    });

    if (!selectedClaimId && !selectedFeature && positions.length) {
      const bounds = positions.reduce(
        (acc, [lng, lat]) => [[Math.min(acc[0][0], lng), Math.min(acc[0][1], lat)], [Math.max(acc[1][0], lng), Math.max(acc[1][1], lat)]],
        [[positions[0][0], positions[0][1]], [positions[0][0], positions[0][1]]] as [[number, number], [number, number]],
      );
      map.fitBounds(bounds, { padding: 90, maxZoom: positions.length === 1 ? 12 : 8, duration: 0 });
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [activeLayer, claims, geometries, mapReady, selectFeature, selectedClaimId, selectedFeature, showClaimMarkers]);

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

  const visibleParcels = (geometries?.features || []).filter((feature: any) => activeLayer === "ALL" || (activeLayer === "FLAGGED" ? feature.properties?.flag_for_review : feature.properties?.claim_type === activeLayer)).length;
  const visibleClaims = showClaimMarkers
    ? claims.filter((claim) => activeLayer === "ALL" || (activeLayer === "FLAGGED" ? false : claim.claim_type === activeLayer)).length
    : visibleParcels;
  const visibleCount = showClaimMarkers ? visibleClaims : visibleParcels;

  return <div className={`relative w-full ${height} overflow-hidden bg-slate-950`}>
    <div ref={containerRef} className="maplibre-container absolute inset-0" aria-label="Copernicus Sentinel-2 WebGIS map" />
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="glass-panel p-3 rounded-xl shadow-xl w-64 text-xs space-y-3">
        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2"><span className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-emerald-500" /> FRA Atlas Layers</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-mono">{visibleCount} {showClaimMarkers ? "Claims" : "Parcels"}</span></div>
        <div><label className="text-[10px] font-semibold text-slate-500 uppercase">Boundary Category</label><div className="grid grid-cols-3 gap-1 mt-1">{(["ALL", "IFR", "CR", "CFR", "FLAGGED"] as BoundaryFilter[]).map((item) => <button key={item} onClick={() => setActiveLayer(item)} className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${activeLayer === item ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"} ${item === "FLAGGED" ? "col-span-2 border border-rose-300" : ""}`}>{item === "FLAGGED" ? "⚠ Discrepancies" : item}</button>)}</div></div>
        <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800"><label className="text-[10px] font-semibold text-slate-500 uppercase flex items-center justify-between">Sentinel-2 spectral layers <Sparkles className="w-3 h-3 text-emerald-600" /></label><div className="grid grid-cols-3 gap-1">{([{ id: "none", label: "Vector only" }, { id: "rgb", label: "RGB (B4,B3,B2)" }, { id: "cir", label: "CIR (B8,B4,B3)" }, { id: "ndvi", label: "NDVI (Veg)" }, { id: "ndwi", label: "NDWI (Water)" }, { id: "ndbi", label: "NDBI (Built)" }] as { id: SpectralLayer; label: string }[]).map((item) => <button key={item.id} title={item.label} onClick={() => setActiveIndicesOverlay(item.id)} className={`px-1 py-1 rounded-lg font-mono text-[9px] truncate ${activeIndicesOverlay === item.id ? "bg-emerald-500/20 text-emerald-700 border border-emerald-500/40" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>{item.label}</button>)}</div></div>
      </div>
      <div className="glass-panel p-2.5 rounded-xl shadow-lg w-64 text-[11px]"><span className="font-semibold text-slate-500 text-[10px] uppercase">Legend</span><div className="grid grid-cols-2 gap-2 mt-1.5 text-slate-700 dark:text-slate-300"><span>🟩 IFR pin</span><span>🟨 CR pin</span><span>🟪 CFR pin</span><span>🟥 Flagged pin</span></div></div>
    </div>
    {selectedFeature && (
      <div className="absolute top-4 right-4 z-20 w-80 glass-panel-glow p-5 rounded-2xl shadow-2xl space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base text-emerald-600">{selectedFeature.claim_id}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getStatusBadgeColor(selectedFeature.status)}`}>{selectedFeature.status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{selectedFeature.village}{selectedFeature.block ? `, ${selectedFeature.block}` : ""}{selectedFeature.district ? `, ${selectedFeature.district}` : ""}{selectedFeature.state ? `, ${selectedFeature.state}` : ""}</p>
          </div>
          <button onClick={() => setSelectedFeature(null)} className="text-slate-500 text-lg leading-none">×</button>
        </div>
        {selectedFeature.flag_for_review && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 flex gap-2 text-xs text-rose-600">
            <AlertTriangle className="w-5 h-5 shrink-0" /> Area discrepancy flagged. Field verification required.
          </div>
        )}
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <User className="w-4 h-4 text-emerald-500" /> Claimant details
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl col-span-2">
            <span className="text-slate-500 block">Applicant</span>
            <strong>{selectedFeature.applicant_name || "—"}</strong>
          </div>
          {selectedFeature.father_or_husband_name && (
            <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl col-span-2">
              <span className="text-slate-500 block">Father / Husband</span>
              <strong>{selectedFeature.father_or_husband_name}</strong>
            </div>
          )}
          <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl">
            <span className="text-slate-500 block">Claim type</span>
            <strong>{selectedFeature.claim_type || "—"}</strong>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl">
            <span className="text-slate-500 block">Survey no.</span>
            <strong>{selectedFeature.survey_number || "—"}</strong>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl">
            <span className="text-slate-500 block">Claimed area</span>
            <strong>{formatArea(selectedFeature.area_claimed_hectares || 0)}</strong>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl">
            <span className="text-slate-500 block">GIS area</span>
            <strong className="text-emerald-600">{selectedFeature.calculated_area_hectares ? formatArea(selectedFeature.calculated_area_hectares) : "No polygon"}</strong>
          </div>
          {selectedFeature.land_use && (
            <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl col-span-2">
              <span className="text-slate-500 block">Land use</span>
              <strong>{selectedFeature.land_use}</strong>
            </div>
          )}
        </div>
        <Link href={`/claims/${selectedFeature.db_claim_id || selectedFeature.claim_id}`} className="block text-center rounded-xl bg-emerald-600 py-3 text-xs font-semibold text-white">Open Claim Workspace ↗</Link>
      </div>
    )}
    <div className="absolute bottom-2 right-3 z-10 text-[10px] bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded text-slate-600">Copernicus Sentinel-2 WebGIS · rendered with MapLibre GL</div>
  </div>;
}
