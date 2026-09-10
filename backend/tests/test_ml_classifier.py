import numpy as np
import pytest
from app.services.ml_classifier import ml_classifier, LAND_COVER_CLASSES
from app.services.segmentation_service import perform_semantic_segmentation, extract_detected_assets

def test_ml_classifier_feature_dimensions():
    """Verify that model predicts correct classes and confidences across known endmember profiles."""
    # 1. Concrete / Tile Roof (Building): High SWIR B11, moderate NIR B8, positive NDBI
    b2 = np.array([[0.15, 0.03]], dtype=np.float32)
    b3 = np.array([[0.16, 0.05]], dtype=np.float32)
    b4 = np.array([[0.18, 0.04]], dtype=np.float32)
    b8 = np.array([[0.23, 0.38]], dtype=np.float32)
    b11 = np.array([[0.29, 0.17]], dtype=np.float32)
    mask = np.array([[True, True]], dtype=bool)

    ndvi = (b8 - b4) / (b8 + b4 + 1e-6)
    ndwi = (b3 - b8) / (b3 + b8 + 1e-6)
    ndbi = (b11 - b8) / (b11 + b8 + 1e-6)

    bands = {"B2": b2, "B3": b3, "B4": b4, "B8": b8, "B11": b11, "mask": mask}
    indices = {"ndvi": ndvi, "ndwi": ndwi, "ndbi": ndbi}

    seg_mask, conf_map = ml_classifier.predict_land_cover(bands, indices)

    # Pixel 0 should be building (class 3)
    assert seg_mask[0, 0] == 3, f"Expected building (3), got {seg_mask[0, 0]}"
    # Pixel 1 should be forest (class 0)
    assert seg_mask[0, 1] == 0, f"Expected forest (0), got {seg_mask[0, 1]}"

    assert conf_map[0, 0] > 0.35
    assert conf_map[0, 1] > 0.35

def test_semantic_segmentation_normalization():
    """Verify that semantic segmentation always sums to strictly 100.0% with valid statistics."""
    H, W = 50, 50
    mask = np.ones((H, W), dtype=bool)
    rng = np.random.default_rng(42)

    bands = {
        "B2": rng.uniform(0.02, 0.20, (H, W)).astype(np.float32),
        "B3": rng.uniform(0.05, 0.20, (H, W)).astype(np.float32),
        "B4": rng.uniform(0.03, 0.22, (H, W)).astype(np.float32),
        "B8": rng.uniform(0.10, 0.45, (H, W)).astype(np.float32),
        "B11": rng.uniform(0.05, 0.35, (H, W)).astype(np.float32),
        "mask": mask
    }

    ndvi = (bands["B8"] - bands["B4"]) / (bands["B8"] + bands["B4"] + 1e-6)
    ndwi = (bands["B3"] - bands["B8"]) / (bands["B3"] + bands["B8"] + 1e-6)
    ndbi = (bands["B11"] - bands["B8"]) / (bands["B11"] + bands["B8"] + 1e-6)
    indices = {"ndvi": ndvi, "ndwi": ndwi, "ndbi": ndbi}

    seg_mask, stats = perform_semantic_segmentation(bands, indices, total_area_m2=100000.0)

    assert len(stats) == 8
    total_pct = sum(s["percentage"] for s in stats)
    assert round(total_pct, 1) == 100.0

    # Ensure each stat has a formatted confidence
    for s in stats:
        assert "confidence" in s
        assert "area_hectares" in s
        assert "pixel_count" in s
