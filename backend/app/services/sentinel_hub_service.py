import sys
# Bypass optional imagecodecs C-extension binary incompatibility in Python 3.12 so tifffile uses Python's native zlib
if "imagecodecs" not in sys.modules or sys.modules["imagecodecs"] is not None:
    sys.modules["imagecodecs"] = None
import os
import io
import json
import time
import math
import logging
import httpx
import numpy as np
import tifffile
from PIL import Image, ImageDraw
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime, timezone, timedelta
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, Point
import pyproj

from app.core.config import settings

logger = logging.getLogger("sentinel_hub")

# SCL (Scene Classification Layer) masked classes for cloud filtering
MASKED_SCL_CLASSES = [
    "0 - No Data",
    "1 - Saturated / Defective",
    "3 - Cloud Shadows",
    "7 - Cloud Low Probability / Unclassified",
    "8 - Cloud Medium Probability",
    "9 - Cloud High Probability",
    "10 - Thin Cirrus"
]

# SCL class IDs that indicate invalid/cloud pixels
SCL_CLOUD_IDS = {0, 1, 3, 7, 8, 9, 10}

# Geodesic calculator for accurate ground resolution & bounding box sizing
geod = pyproj.Geod(ellps="WGS84")


class LiveSentinelDataUnavailable(RuntimeError):
    """Raised when a request cannot be backed by live Sentinel-2 observations."""

class SentinelHubClient:
    """
    Client for Copernicus Data Space Ecosystem (CDSE) Sentinel Hub APIs.
    Retrieves and analyses live Copernicus Sentinel-2 L2A observations only.
    """
    _shared_last_auth_failure_timestamp: float = 0.0

    def __init__(self):
        self._cached_token: Optional[str] = None
        self._token_expiry_timestamp: float = 0.0
        self._stats_cache: Dict[str, Dict[str, Any]] = {}

    def has_credentials(self) -> bool:
        """Returns True if client credentials are non-empty."""
        return bool(settings.SENTINEL_HUB_CLIENT_ID and settings.SENTINEL_HUB_CLIENT_SECRET)

    def get_auth_token(self) -> Optional[str]:
        """
        Retrieves OAuth2 access token via Client Credentials Grant.
        Caches token in memory and automatically refreshes prior to expiration.
        """
        if not self.has_credentials():
            return None

        # Return cached token if valid with at least 60 seconds buffer
        now = time.time()
        if self._cached_token and now < (self._token_expiry_timestamp - 60):
            return self._cached_token

        # Backoff if recent failure across any instance (5s cooldown)
        if now < (SentinelHubClient._shared_last_auth_failure_timestamp + 5):
            return None

        token_url = settings.SENTINEL_HUB_TOKEN_URL
        client_id = settings.SENTINEL_HUB_CLIENT_ID
        client_secret = settings.SENTINEL_HUB_CLIENT_SECRET

        payload = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret
        }

        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }

        for attempt in range(2):
            try:
                with httpx.Client(timeout=25.0) as client:
                    resp = client.post(token_url, data=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        access_token = data.get("access_token")
                        expires_in = data.get("expires_in", 3600)
                        self._cached_token = access_token
                        self._token_expiry_timestamp = now + float(expires_in)
                        logger.info("Successfully acquired new Copernicus Sentinel Hub access token.")
                        return access_token
                    else:
                        SentinelHubClient._shared_last_auth_failure_timestamp = now
                        logger.warning(
                            f"Copernicus Sentinel Hub authentication failed with HTTP {resp.status_code}: {resp.text}"
                        )
                        return None
            except Exception as e:
                logger.warning(f"Error connecting to Copernicus Sentinel Hub token endpoint (attempt {attempt + 1}): {type(e).__name__}")
                if attempt == 0:
                    time.sleep(1.5)
                    continue
                SentinelHubClient._shared_last_auth_failure_timestamp = now
                return None

    def search_catalog(
        self,
        geojson_geom: Dict[str, Any],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        max_cloud_cover: float = 20.0
    ) -> Optional[Dict[str, Any]]:
        """
        Queries CDSE STAC Catalog for Sentinel-2 L2A scenes intersecting parcel within date range.
        Returns the least-cloud scene metadata.
        """
        end_date = end_date or datetime.now(timezone.utc).date().isoformat()
        start_date = start_date or (datetime.now(timezone.utc).date() - timedelta(days=365)).isoformat()
        token = self.get_auth_token()
        if not token:
            return None

        catalog_url = f"{settings.SENTINEL_HUB_CATALOG_URL.rstrip('/')}/search"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        payload = {
            "collections": ["sentinel-2-l2a"],
            "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
            "intersects": geojson_geom,
            "limit": 100
        }

        for attempt in range(2):
            try:
                with httpx.Client(timeout=45.0) as client:
                    resp = client.post(catalog_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        features = data.get("features", [])
                        if not features:
                            logger.info("No Sentinel-2 scenes matched catalog query.")
                            return None
                        # Prefer the newest scene within the requested threshold. If none
                        # exists, use the least-cloudy real scene and let SCL/dataMask
                        # determine whether this particular parcel has usable pixels.
                        valid_features = [
                            f for f in features
                            if f.get("properties", {}).get("eo:cloud_cover", 100.0) <= float(max_cloud_cover)
                        ]
                        if valid_features:
                            candidate_scenes = sorted(
                                valid_features,
                                key=lambda f: f.get("properties", {}).get("datetime", ""),
                                reverse=True,
                            )
                            threshold_met = True
                        else:
                            candidate_scenes = sorted(
                                features,
                                key=lambda f: (
                                    float(f.get("properties", {}).get("eo:cloud_cover", 100.0)),
                                    f.get("properties", {}).get("datetime", ""),
                                ),
                            )
                            threshold_met = False
                        best_scene = candidate_scenes[0]
                        props = best_scene.get("properties", {})
                        return {
                            "id": best_scene.get("id"),
                            "datetime": props.get("datetime", end_date),
                            "cloud_cover": props.get("eo:cloud_cover", 0.0),
                            "cloud_threshold_met": threshold_met,
                            "platform": props.get("platform", "Sentinel-2"),
                            "tile_id": props.get("sentinel:mgrs_tile", "UNKNOWN")
                        }
                    else:
                        logger.warning(f"Catalog search returned HTTP {resp.status_code}: {resp.text}")
                        return None
            except Exception as e:
                logger.warning(f"Catalog query attempt {attempt + 1} failed: {type(e).__name__}")
                if attempt == 0:
                    time.sleep(1.5)
                    continue
                return None

    def _get_evalscript(self, layer_type: str) -> str:
        """
        Returns Sentinel Hub Evalscript v3 for the requested layer.
        Strictly clips to parcel geometry using dataMask and masks SCL cloud classes.
        """
        if layer_type == "true_color":
            return """//VERSION=3
function setup() {
  return {
    input: ["B04", "B03", "B02", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  var factor = 2.5;
  var r = Math.min(Math.max(sample.B04 * factor * 255, 0), 255);
  var g = Math.min(Math.max(sample.B03 * factor * 255, 0), 255);
  var b = Math.min(Math.max(sample.B02 * factor * 255, 0), 255);
  return [r, g, b, 255];
}"""
        elif layer_type == "cir":
            return """//VERSION=3
function setup() {
  return {
    input: ["B08", "B04", "B03", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  var factor = 2.5;
  var r = Math.min(Math.max(sample.B08 * factor * 255, 0), 255);
  var g = Math.min(Math.max(sample.B04 * factor * 255, 0), 255);
  var b = Math.min(Math.max(sample.B03 * factor * 255, 0), 255);
  return [r, g, b, 255];
}"""
        elif layer_type == "ndvi":
            return """//VERSION=3
function setup() {
  return {
    input: ["B08", "B04", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  var denom = sample.B08 + sample.B04;
  var ndvi = denom > 0.0001 ? (sample.B08 - sample.B04) / denom : 0.0;
  if (ndvi < 0.1) return [215, 48, 39, 255];
  if (ndvi < 0.3) return [254, 224, 139, 255];
  if (ndvi < 0.5) return [166, 217, 106, 255];
  return [26, 150, 65, 255];
}"""
        elif layer_type == "ndwi":
            return """//VERSION=3
function setup() {
  return {
    input: ["B03", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  var denom = sample.B03 + sample.B08;
  var ndwi = denom > 0.0001 ? (sample.B03 - sample.B08) / denom : 0.0;
  if (ndwi > 0.1) return [43, 131, 186, 255];
  if (ndwi > -0.1) return [171, 221, 164, 255];
  return [215, 25, 28, 255];
}"""
        elif layer_type == "ndbi":
            return """//VERSION=3
function setup() {
  return {
    input: ["B11", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  var denom = sample.B11 + sample.B08;
  var ndbi = denom > 0.0001 ? (sample.B11 - sample.B08) / denom : 0.0;
  if (ndbi > 0.05) return [215, 25, 28, 255];
  if (ndbi > -0.05) return [254, 224, 139, 255];
  return [43, 131, 186, 255];
}"""
        elif layer_type == "raw_indices":
            return """//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "B08", "B11", "SCL", "dataMask"],
    output: { bands: 10, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  var ndviDenom = sample.B08 + sample.B04;
  var ndvi = ndviDenom > 0.0001 ? (sample.B08 - sample.B04) / ndviDenom : 0.0;
  var ndwiDenom = sample.B03 + sample.B08;
  var ndwi = ndwiDenom > 0.0001 ? (sample.B03 - sample.B08) / ndwiDenom : 0.0;
  var ndbiDenom = sample.B11 + sample.B08;
  var ndbi = ndbiDenom > 0.0001 ? (sample.B11 - sample.B08) / ndbiDenom : 0.0;
  return [sample.B02, sample.B03, sample.B04, sample.B08, sample.B11,
          ndvi, ndwi, ndbi, sample.SCL, sample.dataMask];
}"""
        else:
            raise ValueError(f"Unsupported layer_type: {layer_type}")

    def _calculate_pixel_dimensions(
        self,
        geojson_geom: Dict[str, Any],
        resolution: float = 10.0
    ) -> Tuple[int, int]:
        """
        Calculates appropriate pixel dimensions (width, height) maintaining aspect ratio,
        bounded between 128 and 1024 pixels.
        """
        geom = shape(geojson_geom)
        minx, miny, maxx, maxy = geom.bounds
        
        # Calculate ground span in meters
        mid_lat = (miny + maxy) / 2.0
        lat_m_per_deg = 111320.0
        lon_m_per_deg = 111320.0 * math.cos(math.radians(mid_lat))
        
        width_m = max((maxx - minx) * lon_m_per_deg, 50.0)
        height_m = max((maxy - miny) * lat_m_per_deg, 50.0)
        
        raw_w = int(width_m / resolution)
        raw_h = int(height_m / resolution)
        
        aspect = width_m / height_m if height_m > 0 else 1.0
        
        # Scale to optimal display resolution
        base_size = 512
        if aspect >= 1.0:
            w = base_size
            h = max(int(base_size / aspect), 128)
        else:
            h = base_size
            w = max(int(base_size * aspect), 128)
            
        return max(min(w, 1024), 128), max(min(h, 1024), 128)

    @staticmethod
    def _parcel_pixel_mask(geojson_geom: Dict[str, Any], width: int, height: int) -> np.ndarray:
        """Return the uploaded geometry mask at Process API pixel centers."""
        geom = shape(geojson_geom)
        minx, miny, maxx, maxy = geom.bounds
        xs = minx + (np.arange(width) + 0.5) * (maxx - minx) / width
        ys = maxy - (np.arange(height) + 0.5) * (maxy - miny) / height
        return np.array([[geom.covers(Point(x, y)) for x in xs] for y in ys], dtype=bool)

    def request_process_api(
        self,
        geojson_geom: Dict[str, Any],
        layer_type: str,
        start_date: str,
        end_date: str,
        max_cloud_cover: float = 20.0,
        resolution: float = 10.0
    ) -> Optional[bytes]:
        """
        Sends Process API request to Copernicus Sentinel Hub.
        Returns raw PNG or TIFF byte content if successful.
        """
        token = self.get_auth_token()
        if not token:
            return None

        # Public endpoints may pass YYYY-MM-DD while a catalog-selected scene
        # supplies a full ISO timestamp. Do not append a second time suffix.
        def as_utc_timestamp(value: str, end_of_day: bool) -> str:
            if "T" in value:
                return value.replace("+00:00", "Z")
            return f"{value}T23:59:59Z" if end_of_day else f"{value}T00:00:00Z"

        width, height = self._calculate_pixel_dimensions(geojson_geom, resolution=resolution)
        evalscript = self._get_evalscript(layer_type)
        output_format = "image/png" if layer_type != "raw_indices" else "image/tiff"

        # Validate geometry before sending
        geom = shape(geojson_geom)
        if not geom.is_valid:
            geom = geom.buffer(0)
        valid_geojson = mapping(geom)

        payload = {
            "input": {
                "bounds": {
                    "geometry": valid_geojson,
                    "properties": {
                        "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                    }
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {
                                "from": as_utc_timestamp(start_date, end_of_day=False),
                                "to": as_utc_timestamp(end_date, end_of_day=True)
                            },
                            "maxCloudCoverage": int(max_cloud_cover),
                            "mosaickingOrder": "mostRecent"
                        }
                    }
                ]
            },
            "output": {
                "width": width,
                "height": height,
                "responses": [
                    {
                        "identifier": "default",
                        "format": {
                            "type": output_format
                        }
                    }
                ]
            },
            "evalscript": evalscript
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": output_format
        }

        process_url = settings.SENTINEL_HUB_PROCESS_URL

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(process_url, json=payload, headers=headers)
                if resp.status_code == 200:
                    return resp.content
                else:
                    logger.warning(
                        f"Process API request for layer '{layer_type}' returned HTTP {resp.status_code}: {resp.text}"
                    )
                    return None
        except Exception as e:
            logger.warning(f"Process API request failed: {type(e).__name__}")
            return None

    def process_and_compute_parcel(
        self,
        claim_id: str,
        geojson_geom: Dict[str, Any],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        max_cloud_cover: float = 20.0,
        resolution: float = 10.0,
        veg_threshold: float = 0.20,
        water_threshold: float = 0.05,
        builtup_threshold: float = 0.05
    ) -> Dict[str, Any]:
        """Fetch current Sentinel-2 L2A scene from Copernicus Data Space Ecosystem and calculate parcel metrics from real pixels."""
        if not self.has_credentials():
            raise LiveSentinelDataUnavailable(
                "Problem in fetching real-time Sentinel-2 data: Credentials are not configured. "
                "Set SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET in backend/.env."
            )

        token = self.get_auth_token()
        if not token:
            raise LiveSentinelDataUnavailable(
                "Problem in fetching real-time Sentinel-2 data: Authentication failed with Copernicus Data Space Ecosystem. "
                "Unable to obtain OAuth2 access token. Please verify client ID and secret."
            )

        now = datetime.now(timezone.utc)
        end_date = end_date or now.date().isoformat()
        start_date = start_date or (now.date() - timedelta(days=365)).isoformat()
        geom = shape(geojson_geom)
        if not geom.is_valid:
            geom = geom.buffer(0)
        minx, miny, maxx, maxy = geom.bounds
        bounds = [round(minx, 6), round(miny, 6), round(maxx, 6), round(maxy, 6)]

        # Calculate geodesic area
        if isinstance(geom, Polygon):
            area_m2, _ = geod.geometry_area_perimeter(geom)
            total_area_m2 = abs(area_m2)
        elif isinstance(geom, MultiPolygon):
            total_area_m2 = sum(abs(geod.geometry_area_perimeter(p)[0]) for p in geom.geoms)
        else:
            total_area_m2 = 0.0
        parcel_ha = round(total_area_m2 / 10000.0, 4)

        scene_meta = self.search_catalog(geojson_geom, start_date, end_date, max_cloud_cover)
        if not scene_meta:
            raise LiveSentinelDataUnavailable(
                f"Problem in fetching real-time Sentinel-2 data: No Sentinel-2 L2A scene found for this parcel boundary "
                f"between {start_date} and {end_date} (max cloud cover: {max_cloud_cover}%)."
            )
        try:
            scene_time = datetime.fromisoformat(scene_meta["datetime"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            raise LiveSentinelDataUnavailable(
                "Problem in fetching real-time Sentinel-2 data: The Copernicus catalog returned a scene without a valid acquisition timestamp."
            )
        scene_start = (scene_time - timedelta(minutes=30)).isoformat().replace("+00:00", "Z")
        scene_end = (scene_time + timedelta(minutes=30)).isoformat().replace("+00:00", "Z")

        scene_cloud_cover = float(scene_meta.get("cloud_cover", 100.0))
        effective_cloud_limit = min(100.0, max(float(max_cloud_cover), scene_cloud_cover))
        # The float GeoTIFF is the authoritative science product from Copernicus CDSE
        # containing all 10 spectral bands and indices: B02, B03, B04, B08, B11, ndvi, ndwi, ndbi, SCL, dataMask.
        raw_content = self.request_process_api(
            geojson_geom, "raw_indices", scene_start, scene_end, effective_cloud_limit, resolution
        )
        if not raw_content:
            raise LiveSentinelDataUnavailable(
                f"Problem in fetching real-time Sentinel-2 data: Copernicus Process API did not return the analysis raster for scene {scene_meta['id']}."
            )

        try:
            raw = np.asarray(tifffile.imread(io.BytesIO(raw_content)), dtype=np.float32)
            if raw.ndim != 3 or raw.shape[-1] != 10:
                raise ValueError(f"expected 10 bands, received shape {raw.shape}")
        except Exception as exc:
            raise LiveSentinelDataUnavailable(
                f"Problem in fetching real-time Sentinel-2 data: Could not decode live Sentinel-2 analysis raster: {exc}"
            ) from exc

        b2, b3, b4, b8, b11, ndvi, ndwi, ndbi, scl, data_mask = (raw[..., i] for i in range(10))
        parcel_mask = self._parcel_pixel_mask(geojson_geom, raw.shape[1], raw.shape[0])
        valid = parcel_mask & (data_mask > 0) & ~np.isin(np.rint(scl).astype(np.int16), list(SCL_CLOUD_IDS))
        if not np.any(valid):
            raise LiveSentinelDataUnavailable(
                "Problem in fetching real-time Sentinel-2 data: The selected Sentinel-2 scene has no cloud-free observation pixels inside this parcel."
            )
        ndvi_vals, ndwi_vals, ndbi_vals = ndvi[valid], ndwi[valid], ndbi[valid]

        def compute_stats(arr: np.ndarray) -> Dict[str, Any]:
            if len(arr) == 0:
                return {"min": 0.0, "max": 0.0, "mean": 0.0, "median": 0.0, "std_dev": 0.0, "valid_pixel_count": 0}
            return {
                "min": round(float(np.min(arr)), 4),
                "max": round(float(np.max(arr)), 4),
                "mean": round(float(np.mean(arr)), 4),
                "median": round(float(np.median(arr)), 4),
                "std_dev": round(float(np.std(arr)), 4),
                "valid_pixel_count": int(len(arr))
            }

        ndvi_stats = compute_stats(ndvi_vals)
        ndwi_stats = compute_stats(ndwi_vals)
        ndbi_stats = compute_stats(ndbi_vals)

        # Multi-band ML land-cover inference across the valid parcel mask
        from app.services.ml_classifier import ml_classifier
        seg_mask, _ = ml_classifier.predict_land_cover(
            bands={"B2": b2, "B3": b3, "B4": b4, "B8": b8, "B11": b11, "mask": valid},
            indices={"ndvi": ndvi, "ndwi": ndwi, "ndbi": ndbi}
        )

        total_valid = max(int(np.sum(valid)), 1)
        # Class 0: Forest, 1: Crop, 5: Grassland (Living green vegetation)
        veg_pixels = int(np.sum(np.isin(seg_mask, [0, 1, 5]) & valid))
        dense_veg_pixels = int(np.sum((seg_mask == 0) & valid))
        water_pixels = int(np.sum((seg_mask == 2) & valid))
        built_pixels = int(np.sum((seg_mask == 3) & valid))
        bare_pixels = int(np.sum((seg_mask == 4) & valid))

        veg_pct = round((veg_pixels / total_valid) * 100.0, 2)
        dense_veg_pct = round((dense_veg_pixels / total_valid) * 100.0, 2)
        water_pct = round((water_pixels / total_valid) * 100.0, 2)
        built_pct = round((built_pixels / total_valid) * 100.0, 2)
        bare_pct = round((bare_pixels / total_valid) * 100.0, 2)

        # Render and persist all 5 multispectral preview rasters directly from authoritative reflectance data
        out_dir = settings.SATELLITE_DIR
        os.makedirs(out_dir, exist_ok=True)
        alpha = np.where(parcel_mask & (data_mask > 0), 255, 0).astype(np.uint8)

        # 1. True Color RGB: B04 (Red), B03 (Green), B02 (Blue) with standard 2.5x gain
        r_rgb = np.clip(b4 * 2.5 * 255.0, 0, 255).astype(np.uint8)
        g_rgb = np.clip(b3 * 2.5 * 255.0, 0, 255).astype(np.uint8)
        b_rgb = np.clip(b2 * 2.5 * 255.0, 0, 255).astype(np.uint8)
        rgba_rgb = np.stack([r_rgb, g_rgb, b_rgb, alpha], axis=-1)
        Image.fromarray(rgba_rgb, "RGBA").save(os.path.join(out_dir, f"claim_{claim_id}_rgb.png"))

        # 2. Color Infrared CIR: B08 (NIR -> Red), B04 (Red -> Green), B03 (Green -> Blue)
        r_cir = np.clip(b8 * 2.5 * 255.0, 0, 255).astype(np.uint8)
        g_cir = np.clip(b4 * 2.5 * 255.0, 0, 255).astype(np.uint8)
        b_cir = np.clip(b3 * 2.5 * 255.0, 0, 255).astype(np.uint8)
        rgba_cir = np.stack([r_cir, g_cir, b_cir, alpha], axis=-1)
        Image.fromarray(rgba_cir, "RGBA").save(os.path.join(out_dir, f"claim_{claim_id}_cir.png"))

        # 3. NDVI Vegetation Map: standard 4-class remote sensing gradient
        rgba_ndvi = np.zeros((*ndvi.shape, 4), dtype=np.uint8)
        rgba_ndvi[ndvi < 0.1] = [215, 48, 39, 255]
        rgba_ndvi[(ndvi >= 0.1) & (ndvi < 0.3)] = [254, 224, 139, 255]
        rgba_ndvi[(ndvi >= 0.3) & (ndvi < 0.5)] = [166, 217, 106, 255]
        rgba_ndvi[ndvi >= 0.5] = [26, 150, 65, 255]
        rgba_ndvi[:, :, 3] = alpha
        Image.fromarray(rgba_ndvi, "RGBA").save(os.path.join(out_dir, f"claim_{claim_id}_ndvi.png"))

        # 4. NDWI Moisture Map: standard moisture/water gradient
        rgba_ndwi = np.zeros((*ndwi.shape, 4), dtype=np.uint8)
        rgba_ndwi[ndwi > 0.1] = [43, 131, 186, 255]
        rgba_ndwi[(ndwi >= -0.1) & (ndwi <= 0.1)] = [171, 221, 164, 255]
        rgba_ndwi[ndwi < -0.1] = [215, 25, 28, 255]
        rgba_ndwi[:, :, 3] = alpha
        Image.fromarray(rgba_ndwi, "RGBA").save(os.path.join(out_dir, f"claim_{claim_id}_ndwi.png"))

        # 5. NDBI Built-up Map: standard settlement/built-up gradient
        rgba_ndbi = np.zeros((*ndbi.shape, 4), dtype=np.uint8)
        rgba_ndbi[ndbi > 0.05] = [215, 25, 28, 255]
        rgba_ndbi[(ndbi >= -0.05) & (ndbi <= 0.05)] = [254, 224, 139, 255]
        rgba_ndbi[ndbi < -0.05] = [43, 131, 186, 255]
        rgba_ndbi[:, :, 3] = alpha
        Image.fromarray(rgba_ndbi, "RGBA").save(os.path.join(out_dir, f"claim_{claim_id}_ndbi.png"))

        urls = {
            "rgb_url": f"/api/analysis/imagery/claim_{claim_id}_rgb.png",
            "cir_url": f"/api/analysis/imagery/claim_{claim_id}_cir.png",
            "ndvi_url": f"/api/analysis/imagery/claim_{claim_id}_ndvi.png",
            "ndwi_url": f"/api/analysis/imagery/claim_{claim_id}_ndwi.png",
            "ndbi_url": f"/api/analysis/imagery/claim_{claim_id}_ndbi.png",
        }

        metadata = {
            "satellite_source": "Copernicus Sentinel-2 L2A (Surface Reflectance / CDSE)",
            "platform": "Sentinel-2A/B (Harmonized L2A)",
            "acquisition_date": scene_time.date().isoformat(),
            "cloud_coverage_percentage": round(float(scene_meta.get("cloud_cover", 0.0)), 2),
            "processing_date": datetime.now(timezone.utc).isoformat(),
            "resolution_meters": float(resolution),
            "bands_used": ["B02 (Blue)", "B03 (Green)", "B04 (Red)", "B08 (NIR)", "B11 (SWIR-1)", "SCL (Scene Classification)"],
            "cloud_masking_applied": True,
            "masked_scl_classes": MASKED_SCL_CLASSES,
            "parcel_area_hectares": parcel_ha,
            "bounds": bounds,
            "available_preview_layers": ["rgb", "cir", "ndvi", "ndwi", "ndbi"]
        }

        result = {
            "satellite_source": metadata["satellite_source"],
            "acquisition_date": metadata["acquisition_date"],
            "cloud_percentage": metadata["cloud_coverage_percentage"],
            "mean_ndvi": ndvi_stats["mean"],
            "mean_ndwi": ndwi_stats["mean"],
            "mean_ndbi": ndbi_stats["mean"],
            "raster_urls": urls,
            "bands": {"B2": b2, "B3": b3, "B4": b4, "B8": b8, "B11": b11, "mask": valid},
            "indices": {"ndvi": ndvi, "ndwi": ndwi, "ndbi": ndbi},
            "pixel_area_m2": total_area_m2 / total_valid,
            "statistics": {
                "ndvi": ndvi_stats,
                "ndwi": ndwi_stats,
                "ndbi": ndbi_stats,
                "land_characteristics": {
                    "vegetation_area_percentage": veg_pct,
                    "dense_vegetation_percentage": dense_veg_pct,
                    "bare_area_percentage": bare_pct,
                    "water_area_percentage": water_pct,
                    "builtup_area_percentage": built_pct,
                    "total_area_percentage": 100.0
                },
                "metadata": metadata
            },
            "metadata": metadata,
            "bounds": bounds,
            "parcel_area_hectares": parcel_ha
        }

        self._stats_cache[claim_id] = result
        return result

    def get_cached_statistics(self, claim_id: str) -> Optional[Dict[str, Any]]:
        """Returns in-memory cached statistics if available."""
        return self._stats_cache.get(claim_id)


# Singleton Sentinel Hub client instance
sentinel_hub_client = SentinelHubClient()
