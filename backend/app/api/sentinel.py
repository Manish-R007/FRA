import os
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.schemas.sentinel import (
    SentinelStatisticsResponse,
    SentinelLayerResponse,
    SentinelProcessResponse,
    SentinelLayerMetadata,
    IndexStatistics,
    LandPercentages
)
from app.services.sentinel_hub_service import sentinel_hub_client
from app.services.segmentation_service import perform_semantic_segmentation, extract_detected_assets
from app.services.dss_service import run_dss_for_claim
from app.services.audit_service import record_audit

router = APIRouter(prefix="/sentinel", tags=["Copernicus Sentinel Hub"])

def _resolve_claim_and_geometry(parcel_id_or_code: str, db: Session) -> tuple[FRAClaim, FRAGeometry, Dict[str, Any]]:
    """Helper to resolve claim, geometry record, and GeoJSON dictionary from ID or claim_code."""
    claim = None
    if parcel_id_or_code.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(parcel_id_or_code)).first()
    if not claim:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == parcel_id_or_code).first()
        
    if not claim:
        # Check if parcel_id corresponds to a geometry directly
        if parcel_id_or_code.isdigit():
            geom = db.query(FRAGeometry).filter(FRAGeometry.id == int(parcel_id_or_code)).first()
            if geom:
                claim = db.query(FRAClaim).filter(FRAClaim.id == geom.claim_id).first()

    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parcel / Claim with identifier '{parcel_id_or_code}' not found."
        )

    geom_rec = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first()
    if not geom_rec:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No land boundary geometry attached to claim '{claim.claim_id}'. Please attach a valid polygon before requesting Sentinel-2 imagery."
        )

    try:
        geojson_geom = json.loads(geom_rec.geometry)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or invalid GeoJSON geometry stored for claim '{claim.claim_id}'."
        )

    return claim, geom_rec, geojson_geom


@router.get("/statistics/{parcel_id}", response_model=SentinelStatisticsResponse)
def get_sentinel_statistics(
    parcel_id: str,
    start_date: str = Query(default="2026-01-01", description="Observation start date (YYYY-MM-DD)"),
    end_date: str = Query(default="2026-08-01", description="Observation end date (YYYY-MM-DD)"),
    max_cloud: float = Query(default=20.0, description="Max cloud cover threshold percentage"),
    resolution: float = Query(default=10.0, description="Spatial resolution in meters (10m default)"),
    veg_threshold: float = Query(default=0.40, description="NDVI threshold for vegetation cover"),
    water_threshold: float = Query(default=0.05, description="NDWI threshold for water cover"),
    builtup_threshold: float = Query(default=0.05, description="NDBI threshold for built-up cover"),
    db: Session = Depends(get_db)
):
    """
    Computes parcel-level numerical remote sensing statistics (NDVI, NDWI, NDBI) and land characteristics
    from Copernicus Sentinel-2 L2A Surface Reflectance data for the specified FRA parcel.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)

    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud,
        resolution=resolution,
        veg_threshold=veg_threshold,
        water_threshold=water_threshold,
        builtup_threshold=builtup_threshold
    )

    stats = res["statistics"]
    return SentinelStatisticsResponse(
        claim_id=claim.claim_id,
        parcel_id=claim.id,
        ndvi=IndexStatistics(**stats["ndvi"]),
        ndwi=IndexStatistics(**stats["ndwi"]),
        ndbi=IndexStatistics(**stats["ndbi"]),
        land_characteristics=LandPercentages(**stats["land_characteristics"]),
        metadata=SentinelLayerMetadata(**stats["metadata"])
    )


@router.get("/true-color/{parcel_id}")
def get_sentinel_true_color(
    parcel_id: str,
    format: str = Query(default="json", description="Response format: 'json' with URL/metadata or 'png' raw image"),
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-08-01"),
    max_cloud: float = Query(default=20.0),
    resolution: float = Query(default=10.0),
    db: Session = Depends(get_db)
):
    """
    Retrieves Copernicus Sentinel-2 L2A True Color RGB (Red=B04, Green=B03, Blue=B02)
    display-ready raster strictly clipped to the parcel polygon.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud,
        resolution=resolution
    )

    rgb_file = os.path.join(settings.SATELLITE_DIR, f"claim_{claim.claim_id}_rgb.png")
    if format.lower() == "png":
        if os.path.exists(rgb_file):
            return FileResponse(rgb_file, media_type="image/png")
        raise HTTPException(status_code=404, detail="True Color raster not found.")

    return SentinelLayerResponse(
        claim_id=claim.claim_id,
        parcel_id=claim.id,
        layer_type="true_color",
        layer_name="True Color RGB (B04, B03, B02)",
        image_url=res["raster_urls"]["rgb_url"],
        metadata=SentinelLayerMetadata(**res["metadata"])
    )


@router.get("/cir/{parcel_id}")
def get_sentinel_cir(
    parcel_id: str,
    format: str = Query(default="json", description="Response format: 'json' or 'png'"),
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-08-01"),
    max_cloud: float = Query(default=20.0),
    resolution: float = Query(default=10.0),
    db: Session = Depends(get_db)
):
    """
    Retrieves Copernicus Sentinel-2 L2A Color Infrared CIR (Red=B08 NIR, Green=B04 Red, Blue=B03 Green)
    false-color raster generated from numerical band values and strictly clipped to parcel.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud,
        resolution=resolution
    )

    cir_file = os.path.join(settings.SATELLITE_DIR, f"claim_{claim.claim_id}_cir.png")
    if format.lower() == "png":
        if os.path.exists(cir_file):
            return FileResponse(cir_file, media_type="image/png")
        raise HTTPException(status_code=404, detail="Color Infrared raster not found.")

    return SentinelLayerResponse(
        claim_id=claim.claim_id,
        parcel_id=claim.id,
        layer_type="cir",
        layer_name="Color Infrared CIR (B08, B04, B03)",
        image_url=res["raster_urls"]["cir_url"],
        metadata=SentinelLayerMetadata(**res["metadata"])
    )


@router.get("/ndvi/{parcel_id}")
def get_sentinel_ndvi(
    parcel_id: str,
    format: str = Query(default="json", description="Response format: 'json' or 'png'"),
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-08-01"),
    max_cloud: float = Query(default=20.0),
    resolution: float = Query(default=10.0),
    db: Session = Depends(get_db)
):
    """
    Retrieves Normalized Difference Vegetation Index (NDVI = (B08 - B04)/(B08 + B04))
    raster colorized and clipped strictly to the parcel polygon boundary.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud,
        resolution=resolution
    )

    ndvi_file = os.path.join(settings.SATELLITE_DIR, f"claim_{claim.claim_id}_ndvi.png")
    if format.lower() == "png":
        if os.path.exists(ndvi_file):
            return FileResponse(ndvi_file, media_type="image/png")
        raise HTTPException(status_code=404, detail="NDVI raster not found.")

    return SentinelLayerResponse(
        claim_id=claim.claim_id,
        parcel_id=claim.id,
        layer_type="ndvi",
        layer_name="NDVI Vegetation Index (B08, B04)",
        image_url=res["raster_urls"]["ndvi_url"],
        metadata=SentinelLayerMetadata(**res["metadata"])
    )


@router.get("/ndwi/{parcel_id}")
def get_sentinel_ndwi(
    parcel_id: str,
    format: str = Query(default="json", description="Response format: 'json' or 'png'"),
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-08-01"),
    max_cloud: float = Query(default=20.0),
    resolution: float = Query(default=10.0),
    db: Session = Depends(get_db)
):
    """
    Retrieves Normalized Difference Water Index (NDWI = (B03 - B08)/(B03 + B08))
    raster colorized and clipped strictly to the parcel polygon boundary.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud,
        resolution=resolution
    )

    ndwi_file = os.path.join(settings.SATELLITE_DIR, f"claim_{claim.claim_id}_ndwi.png")
    if format.lower() == "png":
        if os.path.exists(ndwi_file):
            return FileResponse(ndwi_file, media_type="image/png")
        raise HTTPException(status_code=404, detail="NDWI raster not found.")

    return SentinelLayerResponse(
        claim_id=claim.claim_id,
        parcel_id=claim.id,
        layer_type="ndwi",
        layer_name="NDWI Water Index (B03, B08)",
        image_url=res["raster_urls"]["ndwi_url"],
        metadata=SentinelLayerMetadata(**res["metadata"])
    )


@router.get("/ndbi/{parcel_id}")
def get_sentinel_ndbi(
    parcel_id: str,
    format: str = Query(default="json", description="Response format: 'json' or 'png'"),
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-08-01"),
    max_cloud: float = Query(default=20.0),
    resolution: float = Query(default=20.0),  # Handled: B11 is a 20m native band
    db: Session = Depends(get_db)
):
    """
    Retrieves Normalized Difference Built-up Index (NDBI = (B11 - B08)/(B11 + B08))
    raster colorized and clipped strictly to the parcel polygon boundary.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)
    res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud,
        resolution=resolution
    )

    ndbi_file = os.path.join(settings.SATELLITE_DIR, f"claim_{claim.claim_id}_ndbi.png")
    if format.lower() == "png":
        if os.path.exists(ndbi_file):
            return FileResponse(ndbi_file, media_type="image/png")
        raise HTTPException(status_code=404, detail="NDBI raster not found.")

    return SentinelLayerResponse(
        claim_id=claim.claim_id,
        parcel_id=claim.id,
        layer_type="ndbi",
        layer_name="NDBI Built-up Index (B11, B08)",
        image_url=res["raster_urls"]["ndbi_url"],
        metadata=SentinelLayerMetadata(**res["metadata"])
    )


@router.get("/image/{parcel_id}/{layer_type}")
def get_sentinel_raster_image(
    parcel_id: str,
    layer_type: str,
    db: Session = Depends(get_db)
):
    """
    Direct image serving endpoint for WebGIS map raster overlays and preview images.
    layer_type: 'rgb' | 'cir' | 'ndvi' | 'ndwi' | 'ndbi'
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)

    valid_layers = {"rgb": "rgb", "true_color": "rgb", "cir": "cir", "ndvi": "ndvi", "ndwi": "ndwi", "ndbi": "ndbi"}
    if layer_type.lower() not in valid_layers:
        raise HTTPException(status_code=400, detail=f"Invalid layer_type '{layer_type}'. Supported: rgb, cir, ndvi, ndwi, ndbi")

    mapped_type = valid_layers[layer_type.lower()]
    file_path = os.path.join(settings.SATELLITE_DIR, f"claim_{claim.claim_id}_{mapped_type}.png")

    if not os.path.exists(file_path):
        # Auto-generate if not yet rendered
        sentinel_hub_client.process_and_compute_parcel(
            claim_id=claim.claim_id,
            geojson_geom=geojson_geom
        )

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested Sentinel raster could not be generated.")

    return FileResponse(
        file_path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@router.post("/process/{parcel_id}", response_model=SentinelProcessResponse)
def run_sentinel_process_pipeline(
    parcel_id: str,
    start_date: str = Query(default="2026-01-01"),
    end_date: str = Query(default="2026-08-01"),
    max_cloud: float = Query(default=20.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "ANALYST"]))
):
    """
    Triggers complete Copernicus Sentinel-2 L2A processing pipeline:
    1. Retrieves/generates True Color RGB, CIR, NDVI, NDWI, NDBI rasters.
    2. Strict polygon clipping and cloud masking.
    3. Calculates parcel numerical statistics.
    4. Performs semantic segmentation & spatial asset extraction.
    5. Evaluates DSS government scheme convergence rules (consuming purely numerical metrics).
    6. Updates database records and records cryptographic audit log.
    """
    claim, geom_rec, geojson_geom = _resolve_claim_and_geometry(parcel_id, db)

    sat_res = sentinel_hub_client.process_and_compute_parcel(
        claim_id=claim.claim_id,
        geojson_geom=geojson_geom,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=max_cloud
    )

    # 1. Update or create SatelliteAnalysis record
    sat_analysis = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).first()
    if not sat_analysis:
        sat_analysis = SatelliteAnalysis(
            claim_id=claim.id,
            geometry_id=geom_rec.id,
            satellite_source=sat_res["satellite_source"],
            acquisition_date=sat_res["acquisition_date"],
            cloud_percentage=sat_res["cloud_percentage"],
            image_url=sat_res["raster_urls"]["rgb_url"],
            false_color_url=sat_res["raster_urls"]["cir_url"],
            ndvi_url=sat_res["raster_urls"]["ndvi_url"],
            ndwi_url=sat_res["raster_urls"]["ndwi_url"],
            ndbi_url=sat_res["raster_urls"]["ndbi_url"],
            mean_ndvi=sat_res["mean_ndvi"],
            mean_ndwi=sat_res["mean_ndwi"],
            mean_ndbi=sat_res["mean_ndbi"],
            processing_status="COMPLETED",
            model_name="Copernicus-Sentinel-2-L2A",
            model_version="v2.1.0",
            confidence=0.92
        )
        db.add(sat_analysis)
        db.commit()
        db.refresh(sat_analysis)
    else:
        sat_analysis.satellite_source = sat_res["satellite_source"]
        sat_analysis.acquisition_date = sat_res["acquisition_date"]
        sat_analysis.cloud_percentage = sat_res["cloud_percentage"]
        sat_analysis.image_url = sat_res["raster_urls"]["rgb_url"]
        sat_analysis.false_color_url = sat_res["raster_urls"]["cir_url"]
        sat_analysis.ndvi_url = sat_res["raster_urls"]["ndvi_url"]
        sat_analysis.ndwi_url = sat_res["raster_urls"]["ndwi_url"]
        sat_analysis.ndbi_url = sat_res["raster_urls"]["ndbi_url"]
        sat_analysis.mean_ndvi = sat_res["mean_ndvi"]
        sat_analysis.mean_ndwi = sat_res["mean_ndwi"]
        sat_analysis.mean_ndbi = sat_res["mean_ndbi"]
        sat_analysis.processing_status = "COMPLETED"
        db.commit()
        db.refresh(sat_analysis)

    # 2. Semantic segmentation & land cover breakdown
    db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat_analysis.id).delete()
    db.commit()

    seg_mask, stats_list = perform_semantic_segmentation(
        bands=sat_res["bands"],
        indices=sat_res["indices"],
        total_area_m2=geom_rec.calculated_area_m2
    )

    for st in stats_list:
        stat_rec = LandCoverStatistic(
            analysis_id=sat_analysis.id,
            class_name=st["class_name"],
            pixel_count=st["pixel_count"],
            area_m2=st["area_m2"],
            area_hectares=st["area_hectares"],
            percentage=st["percentage"],
            confidence=st["confidence"]
        )
        db.add(stat_rec)
    db.commit()

    # 3. Extract assets
    db.query(Asset).filter(Asset.claim_id == claim.id).delete()
    db.commit()

    detected_assets = extract_detected_assets(
        geojson_geom=geojson_geom,
        seg_mask=seg_mask,
        statistics=stats_list
    )

    for ast in detected_assets:
        asset_rec = Asset(
            claim_id=claim.id,
            analysis_id=sat_analysis.id,
            asset_type=ast["asset_type"],
            geometry=json.dumps(ast["geometry"]),
            area_m2=ast.get("area_m2"),
            confidence=ast.get("confidence", 0.88),
            model_name="Copernicus-SAM2"
        )
        db.add(asset_rec)
    db.commit()

    # 4. Trigger DSS decision support (rule-based + RAG on numerical indices)
    run_dss_for_claim(db, claim.id)

    # 5. Update claim pipeline status
    if claim.status in ["UPLOADED", "OCR_PROCESSED", "GIS_VALIDATED"]:
        claim.status = "SATELLITE_ANALYZE"
        db.commit()

    # 6. Cryptographic audit record
    record_audit(
        db=db,
        action="SENTINEL_HUB_PROCESS",
        entity="FRAClaim",
        entity_id=str(claim.id),
        user_id=current_user.id,
        new_value={
            "mean_ndvi": sat_res["mean_ndvi"],
            "mean_ndwi": sat_res["mean_ndwi"],
            "mean_ndbi": sat_res["mean_ndbi"],
            "source": sat_res["satellite_source"]
        }
    )

    stats = sat_res["statistics"]
    return SentinelProcessResponse(
        id=sat_analysis.id,
        claim_id=claim.id,
        claim_code=claim.claim_id,
        satellite_source=sat_res["satellite_source"],
        acquisition_date=sat_res["acquisition_date"],
        cloud_percentage=sat_res["cloud_percentage"],
        image_url=sat_res["raster_urls"]["rgb_url"],
        false_color_url=sat_res["raster_urls"]["cir_url"],
        ndvi_url=sat_res["raster_urls"]["ndvi_url"],
        ndwi_url=sat_res["raster_urls"]["ndwi_url"],
        ndbi_url=sat_res["raster_urls"]["ndbi_url"],
        mean_ndvi=sat_res["mean_ndvi"],
        mean_ndwi=sat_res["mean_ndwi"],
        mean_ndbi=sat_res["mean_ndbi"],
        statistics=SentinelStatisticsResponse(
            claim_id=claim.claim_id,
            parcel_id=claim.id,
            ndvi=IndexStatistics(**stats["ndvi"]),
            ndwi=IndexStatistics(**stats["ndwi"]),
            ndbi=IndexStatistics(**stats["ndbi"]),
            land_characteristics=LandPercentages(**stats["land_characteristics"]),
            metadata=SentinelLayerMetadata(**stats["metadata"])
        ),
        processing_status="COMPLETED",
        created_at=sat_analysis.created_at
    )
