import pytest
import os
from fastapi.testclient import TestClient
from app.main import app
from app.services.sentinel_hub_service import sentinel_hub_client, SCL_CLOUD_IDS, MASKED_SCL_CLASSES
from app.core.config import settings

client = TestClient(app)

SAMPLE_POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [86.745120, 21.932450],
            [86.746850, 21.933120],
            [86.747940, 21.931890],
            [86.746980, 21.930450],
            [86.745430, 21.930980],
            [86.745120, 21.932450]
        ]
    ]
}

def test_sentinel_hub_evalscripts():
    """Validates Evalscript generation for all 6 layer types."""
    for layer in ["true_color", "cir", "ndvi", "ndwi", "ndbi", "raw_indices"]:
        script = sentinel_hub_client._get_evalscript(layer)
        assert "//VERSION=3" in script
        assert "evaluatePixel" in script
        assert "SCL" in script
        assert "dataMask" in script

    with pytest.raises(ValueError):
        sentinel_hub_client._get_evalscript("invalid_layer")


def test_sentinel_hub_pixel_dimensions():
    """Validates dynamic pixel dimension calculation from ground coordinates."""
    w, h = sentinel_hub_client._calculate_pixel_dimensions(SAMPLE_POLYGON, resolution=10.0)
    assert 128 <= w <= 1024
    assert 128 <= h <= 1024


def test_sentinel_hub_process_and_compute_parcel():
    """Validates full Sentinel-2 spectral indices, statistics, and raster generation."""
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id="TEST-FRA-001",
        geojson_geom=SAMPLE_POLYGON,
        start_date="2026-01-01",
        end_date="2026-08-01",
        max_cloud_cover=20.0,
        resolution=10.0
    )

    assert "mean_ndvi" in res
    assert "mean_ndwi" in res
    assert "mean_ndbi" in res
    assert "statistics" in res
    assert "metadata" in res
    assert "raster_urls" in res

    stats = res["statistics"]
    # Check NDVI stats
    ndvi = stats["ndvi"]
    assert -1.0 <= ndvi["min"] <= 1.0
    assert -1.0 <= ndvi["max"] <= 1.0
    assert -1.0 <= ndvi["mean"] <= 1.0
    assert ndvi["valid_pixel_count"] > 0

    # Check NDWI stats
    ndwi = stats["ndwi"]
    assert -1.0 <= ndwi["min"] <= 1.0
    assert -1.0 <= ndwi["mean"] <= 1.0

    # Check NDBI stats
    ndbi = stats["ndbi"]
    assert -1.0 <= ndbi["min"] <= 1.0
    assert -1.0 <= ndbi["mean"] <= 1.0

    # Check Land Characteristics
    land = stats["land_characteristics"]
    assert 0.0 <= land["vegetation_area_percentage"] <= 100.0
    assert 0.0 <= land["water_area_percentage"] <= 100.0
    assert 0.0 <= land["builtup_area_percentage"] <= 100.0

    # Check that rasters were saved
    out_dir = settings.SATELLITE_DIR
    for key in ["rgb", "cir", "ndvi", "ndwi", "ndbi"]:
        fpath = os.path.join(out_dir, f"claim_TEST-FRA-001_{key}.png")
        assert os.path.exists(fpath), f"Expected raster file {fpath} not found"


def test_sentinel_api_statistics_endpoint():
    """Tests GET /api/sentinel/statistics/{parcel_id} with seeded claim."""
    # Seeded claim ID 1 is FRA-OD-MAY-001
    resp = client.get("/api/sentinel/statistics/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["claim_id"] == "FRA-OD-MAY-001"
    assert "ndvi" in data
    assert "ndwi" in data
    assert "ndbi" in data
    assert "land_characteristics" in data
    assert "metadata" in data
    assert data["metadata"]["cloud_masking_applied"] is True


def test_sentinel_api_layer_endpoints():
    """Tests True Color, CIR, NDVI, NDWI, NDBI endpoints."""
    # 1. True Color
    resp_rgb = client.get("/api/sentinel/true-color/1")
    assert resp_rgb.status_code == 200
    assert resp_rgb.json()["layer_type"] == "true_color"

    # 2. CIR
    resp_cir = client.get("/api/sentinel/cir/1")
    assert resp_cir.status_code == 200
    assert resp_cir.json()["layer_type"] == "cir"

    # 3. NDVI
    resp_ndvi = client.get("/api/sentinel/ndvi/1")
    assert resp_ndvi.status_code == 200
    assert resp_ndvi.json()["layer_type"] == "ndvi"

    # 4. NDWI
    resp_ndwi = client.get("/api/sentinel/ndwi/1")
    assert resp_ndwi.status_code == 200
    assert resp_ndwi.json()["layer_type"] == "ndwi"

    # 5. NDBI
    resp_ndbi = client.get("/api/sentinel/ndbi/1")
    assert resp_ndbi.status_code == 200
    assert resp_ndbi.json()["layer_type"] == "ndbi"

    # 6. Direct image serving
    resp_img = client.get("/api/sentinel/image/1/rgb")
    assert resp_img.status_code == 200
    assert resp_img.headers["content-type"] == "image/png"

    resp_img_ndvi = client.get("/api/sentinel/image/1/ndvi")
    assert resp_img_ndvi.status_code == 200
    assert resp_img_ndvi.headers["content-type"] == "image/png"


def test_sentinel_api_error_handling():
    """Tests error responses for non-existent parcel and invalid layer."""
    # 1. Parcel not found
    resp_404 = client.get("/api/sentinel/statistics/999999")
    assert resp_404.status_code == 404

    # 2. Invalid layer image
    resp_bad_layer = client.get("/api/sentinel/image/1/unknown_layer")
    assert resp_bad_layer.status_code == 400
