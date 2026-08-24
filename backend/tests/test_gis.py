from app.services.gis_service import calculate_geodesic_area, validate_and_process_geometry

def test_geodesic_area_calculation():
    # Sample polygon in Odisha (approx 2.38 hectares)
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

    area_m2, area_ha = calculate_geodesic_area(sample_poly)
    assert area_m2 > 10000.0  # Must be > 1 hectare in square meters
    assert 4.0 < area_ha < 7.0  # Geodesic area is approximately ~5.47 hectares

def test_area_discrepancy_and_flag_for_review():
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

    # Case 1: Match within 5% threshold (Claimed 5.47 ha vs GIS ~5.47 ha)
    res_normal = validate_and_process_geometry(sample_poly, claimed_area_hectares=5.47)
    assert res_normal["flag_for_review"] is False
    assert res_normal["geometry_status"] == "VALIDATED"

    # Case 2: Large discrepancy exceeding threshold (Claimed 10.00 ha vs GIS ~5.47 ha, diff > 40%)
    res_flagged = validate_and_process_geometry(sample_poly, claimed_area_hectares=10.00)
    assert res_flagged["flag_for_review"] is True
    assert res_flagged["geometry_status"] == "FLAGGED"
    assert res_flagged["area_difference_percentage"] > 40.0
