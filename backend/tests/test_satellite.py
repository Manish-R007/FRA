from app.services.satellite_service import process_satellite_analysis
from app.services.segmentation_service import perform_semantic_segmentation, extract_detected_assets

def test_satellite_and_indices_pipeline():
    sample_poly = {
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

    sat_res = process_satellite_analysis(claim_id="TEST-001", geojson_geom=sample_poly)
    assert sat_res["satellite_source"] == "COPERNICUS/S2_HARMONIZED"
    assert "mean_ndvi" in sat_res
    assert "mean_ndwi" in sat_res
    assert "mean_ndbi" in sat_res
    assert -1.0 <= sat_res["mean_ndvi"] <= 1.0

    # Test Land Cover Segmentation & Exact 100% Sum
    seg_mask, stats = perform_semantic_segmentation(
        bands=sat_res["bands"],
        indices=sat_res["indices"],
        total_area_m2=24000.0
    )
    assert len(stats) == 8
    total_pct = sum(s["percentage"] for s in stats)
    assert round(total_pct, 1) == 100.0

    # Test Asset Extraction
    assets = extract_detected_assets(geojson_geom=sample_poly, seg_mask=seg_mask, statistics=stats)
    assert isinstance(assets, list)
    for a in assets:
        assert "asset_type" in a
        assert "geometry" in a
        assert a["confidence"] > 0.70
