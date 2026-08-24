import os
import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.schemas.satellite import (
    SatelliteAnalysisRequest,
    SatelliteAnalysisResponse,
    LandCoverStatsResponse,
    AssetResponse,
    ClaimAnalysisSummary
)
from app.services.satellite_service import process_satellite_analysis
from app.services.segmentation_service import perform_semantic_segmentation, extract_detected_assets
from app.services.dss_service import run_dss_for_claim
from app.services.audit_service import record_audit

router = APIRouter(prefix="/analysis", tags=["Satellite & AI Analysis"])

@router.post("/run", response_model=SatelliteAnalysisResponse)
def run_satellite_analysis(
    req: SatelliteAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "ANALYST"]))
):
    claim = db.query(FRAClaim).filter(FRAClaim.id == req.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    geom_rec = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first()
    if not geom_rec:
        raise HTTPException(
            status_code=400,
            detail="Actual land boundary geometry not found. Please attach a polygon before running satellite analysis."
        )

    geojson_geom = json.loads(geom_rec.geometry)

    # 1. Run Sentinel-2 Remote Sensing Pipeline
    sat_res = process_satellite_analysis(claim_id=claim.claim_id, geojson_geom=geojson_geom)

    # 2. Check if prior analysis exists, update or create
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
            model_name="SegFormer-B2-RemoteSensing",
            model_version="v2.1.0",
            confidence=0.91
        )
        db.add(sat_analysis)
        db.commit()
        db.refresh(sat_analysis)
    else:
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

    # 3. Perform 8-class Semantic Segmentation
    # Clear old statistics
    db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat_analysis.id).delete()
    db.commit()

    seg_mask, stats_list = perform_semantic_segmentation(
        bands=sat_res["bands"],
        indices=sat_res["indices"],
        total_area_m2=geom_rec.calculated_area_m2
    )

    stat_responses = []
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
        stat_responses.append(LandCoverStatsResponse(**st))
    db.commit()

    # 4. Extract and Vectorize Detected Assets
    db.query(Asset).filter(Asset.claim_id == claim.id).delete()
    db.commit()

    detected_assets = extract_detected_assets(
        geojson_geom=geojson_geom,
        seg_mask=seg_mask,
        statistics=stats_list
    )

    asset_responses = []
    for ast in detected_assets:
        asset_rec = Asset(
            claim_id=claim.id,
            analysis_id=sat_analysis.id,
            asset_type=ast["asset_type"],
            geometry=json.dumps(ast["geometry"]),
            area_m2=ast.get("area_m2"),
            confidence=ast.get("confidence", 0.88),
            model_name=ast.get("model_name", "SAM2-Detector")
        )
        db.add(asset_rec)
        db.commit()
        db.refresh(asset_rec)
        asset_responses.append(AssetResponse(
            id=asset_rec.id,
            claim_id=asset_rec.claim_id,
            asset_type=asset_rec.asset_type,
            geometry=ast["geometry"],
            area_m2=asset_rec.area_m2,
            confidence=asset_rec.confidence,
            model_name=asset_rec.model_name
        ))

    # 5. Automatically trigger DSS evaluation
    run_dss_for_claim(db, claim.id)

    # 6. Update claim status to SATELLITE_ANALYZE if in pipeline
    if claim.status == "GIS_VALIDATED":
        claim.status = "SATELLITE_ANALYZE"
        db.commit()

    record_audit(db, action="RUN_SATELLITE_ANALYSIS", entity="SatelliteAnalysis", entity_id=str(sat_analysis.id), user_id=current_user.id, new_value={"mean_ndvi": sat_analysis.mean_ndvi, "assets_count": len(asset_responses)})

    return SatelliteAnalysisResponse(
        id=sat_analysis.id,
        claim_id=sat_analysis.claim_id,
        geometry_id=sat_analysis.geometry_id,
        satellite_source=sat_analysis.satellite_source,
        acquisition_date=sat_analysis.acquisition_date,
        cloud_percentage=sat_analysis.cloud_percentage,
        image_url=sat_analysis.image_url,
        false_color_url=sat_analysis.false_color_url,
        ndvi_url=sat_analysis.ndvi_url,
        ndwi_url=sat_analysis.ndwi_url,
        ndbi_url=sat_analysis.ndbi_url,
        mean_ndvi=sat_analysis.mean_ndvi,
        mean_ndwi=sat_analysis.mean_ndwi,
        mean_ndbi=sat_analysis.mean_ndbi,
        processing_status=sat_analysis.processing_status,
        model_name=sat_analysis.model_name,
        model_version=sat_analysis.model_version,
        confidence=sat_analysis.confidence,
        statistics=stat_responses,
        assets=asset_responses,
        created_at=sat_analysis.created_at
    )

@router.get("/{claim_id_or_id}", response_model=SatelliteAnalysisResponse)
def get_analysis_by_claim(claim_id_or_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    claim = None
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    if not claim:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    sat = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).order_by(SatelliteAnalysis.id.desc()).first()
    if not sat:
        raise HTTPException(status_code=404, detail="No satellite analysis found for this claim")

    stats = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat.id).all()
    stat_responses = [
        LandCoverStatsResponse(
            class_name=s.class_name,
            pixel_count=s.pixel_count,
            area_m2=s.area_m2,
            area_hectares=s.area_hectares,
            percentage=s.percentage,
            confidence=s.confidence
        )
        for s in stats
    ]

    assets = db.query(Asset).filter(Asset.claim_id == claim.id).all()
    asset_responses = [
        AssetResponse(
            id=a.id,
            claim_id=a.claim_id,
            asset_type=a.asset_type,
            geometry=json.loads(a.geometry),
            area_m2=a.area_m2,
            confidence=a.confidence,
            model_name=a.model_name
        )
        for a in assets
    ]

    return SatelliteAnalysisResponse(
        id=sat.id,
        claim_id=sat.claim_id,
        geometry_id=sat.geometry_id,
        satellite_source=sat.satellite_source,
        acquisition_date=sat.acquisition_date,
        cloud_percentage=sat.cloud_percentage,
        image_url=sat.image_url,
        false_color_url=sat.false_color_url,
        ndvi_url=sat.ndvi_url,
        ndwi_url=sat.ndwi_url,
        ndbi_url=sat.ndbi_url,
        mean_ndvi=sat.mean_ndvi,
        mean_ndwi=sat.mean_ndwi,
        mean_ndbi=sat.mean_ndbi,
        processing_status=sat.processing_status,
        model_name=sat.model_name,
        model_version=sat.model_version,
        confidence=sat.confidence,
        statistics=stat_responses,
        assets=asset_responses,
        created_at=sat.created_at
    )

@router.get("/{claim_id_or_id}/statistics", response_model=List[LandCoverStatsResponse])
def get_claim_statistics(claim_id_or_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    claim = None
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    if not claim:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    sat = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).order_by(SatelliteAnalysis.id.desc()).first()
    if not sat:
        raise HTTPException(status_code=404, detail="No satellite analysis found for this claim")

    stats = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat.id).all()
    return [
        LandCoverStatsResponse(
            class_name=s.class_name,
            pixel_count=s.pixel_count,
            area_m2=s.area_m2,
            area_hectares=s.area_hectares,
            percentage=s.percentage,
            confidence=s.confidence
        )
        for s in stats
    ]

@router.get("/{claim_id_or_id}/assets", response_model=List[AssetResponse])
def get_claim_assets(claim_id_or_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    claim = None
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    if not claim:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    assets = db.query(Asset).filter(Asset.claim_id == claim.id).all()
    return [
        AssetResponse(
            id=a.id,
            claim_id=a.claim_id,
            asset_type=a.asset_type,
            geometry=json.loads(a.geometry),
            area_m2=a.area_m2,
            confidence=a.confidence,
            model_name=a.model_name
        )
        for a in assets
    ]

@router.get("/imagery/{filename}")
def get_imagery_file(filename: str):
    file_path = os.path.join(settings.SATELLITE_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Imagery raster not found")
    return FileResponse(file_path, media_type="image/png")
