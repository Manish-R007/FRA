from typing import Dict, Any, Optional
from app.services.sentinel_hub_service import sentinel_hub_client

def process_satellite_analysis(
    claim_id: str,
    geojson_geom: Dict[str, Any],
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    max_cloud_cover: float = 20.0,
    resolution: float = 10.0
) -> Dict[str, Any]:
    """
    Real-Time Copernicus Sentinel-2 Remote Sensing Pipeline:
    1. Geometrical validation & exact parcel polygon boundary clipping
    2. Copernicus Data Space Ecosystem (CDSE) Process API retrieval of real multispectral pixels
    3. Live Spectral indices (NDVI, NDWI, NDBI) numerical calculation
    4. Exact parcel-level statistics and SCL cloud masking
    """
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud_cover,
        resolution=resolution
    )

    return {
        "satellite_source": res["satellite_source"],
        "acquisition_date": res["acquisition_date"],
        "cloud_percentage": res["cloud_percentage"],
        "mean_ndvi": res["mean_ndvi"],
        "mean_ndwi": res["mean_ndwi"],
        "mean_ndbi": res["mean_ndbi"],
        "raster_urls": res["raster_urls"],
        "bands": res["bands"],
        "indices": res["indices"],
        "statistics": res.get("statistics"),
        "metadata": res.get("metadata"),
        "pixel_area_m2": res.get("pixel_area_m2")
    }
