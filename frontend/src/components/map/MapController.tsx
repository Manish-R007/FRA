"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface MapControllerProps {
  selectedClaimId?: string | null;
  geometries?: any;
  onFeatureFound?: (featureProperties: any) => void;
  autoFitAll?: boolean;
}

export default function MapController({
  selectedClaimId,
  geometries,
  onFeatureFound,
  autoFitAll = true,
}: MapControllerProps) {
  const map = useMap();
  const lastFittedTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !geometries?.features?.length) return;

    // 1. Target specific claim if selectedClaimId is provided
    if (selectedClaimId) {
      const match = geometries.features.find(
        (f: any) =>
          f.properties?.claim_id?.trim().toLowerCase() === selectedClaimId.trim().toLowerCase() ||
          String(f.properties?.db_claim_id) === String(selectedClaimId)
      );

      if (match && match.geometry) {
        try {
          const geoLayer = L.geoJSON(match.geometry);
          const bounds = geoLayer.getBounds();
          if (bounds.isValid()) {
            map.flyToBounds(bounds, {
              padding: [60, 60],
              maxZoom: 16,
              duration: 1.2,
            });
            lastFittedTarget.current = selectedClaimId;
            if (onFeatureFound) {
              onFeatureFound(match.properties);
            }
            return;
          }
        } catch (err) {
          console.warn("MapController: failed to fit bounds for claim", selectedClaimId, err);
        }
      }
    }

    // 2. If no specific claim is selected, auto-fit to all available features
    if (autoFitAll && !lastFittedTarget.current) {
      try {
        const geoLayer = L.geoJSON(geometries);
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
          });
          lastFittedTarget.current = "ALL";
        }
      } catch (err) {
        console.warn("MapController: failed to fit bounds for all geometries", err);
      }
    }
  }, [map, selectedClaimId, geometries, autoFitAll, onFeatureFound]);

  return null;
}
