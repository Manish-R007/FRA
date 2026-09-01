import json
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic
from app.schemas.geometry import FRAGeometryCreate, FRAGeometryUpdate, FRAGeometryResponse, GeoJSONFeatureCollection, GeoJSONFeature
from app.services.gis_service import validate_and_process_geometry, parse_geospatial_features
from app.services.audit_service import record_audit

router = APIRouter(prefix="/geometries", tags=["GIS & Geometries"])

@router.get("", response_model=GeoJSONFeatureCollection)
def get_all_geometries(
    bbox: Optional[str] = Query(None, description="minX,minY,maxX,maxY"),
    district: Optional[str] = None,
    village: Optional[str] = None,
    claim_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns high-performance GeoJSON FeatureCollection formatted for React-Leaflet WebGIS layer rendering.
    Enriched with claim properties, satellite analysis results, and discrepancy flags.
    """
    query = db.query(FRAGeometry, FRAClaim).join(FRAClaim, FRAGeometry.claim_id == FRAClaim.id)

    # Scoping
    if current_user.role == "CITIZEN":
        query = query.filter((FRAClaim.created_by == current_user.id) | (FRAClaim.village == current_user.village))
    elif current_user.role in ["DISTRICT_OFFICER", "FIELD_OFFICER"] and current_user.district:
        query = query.filter(FRAClaim.district == current_user.district)
    elif current_user.role == "STATE_OFFICER" and current_user.state:
        query = query.filter(FRAClaim.state == current_user.state)

    if district:
        query = query.filter(FRAClaim.district == district)
    if village:
        query = query.filter(FRAClaim.village == village)
    if claim_type:
        query = query.filter(FRAClaim.claim_type == claim_type)
    if status_filter:
        query = query.filter(FRAClaim.status == status_filter)

    results = query.all()
    features = []

    for geom, claim in results:
        try:
            geometry_obj = json.loads(geom.geometry)
        except Exception:
            continue

        # Fetch latest satellite analysis stats for this claim
        sat = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).order_by(SatelliteAnalysis.id.desc()).first()
        stats_dict = {}
        sat_date = None
        mean_ndvi = None
        mean_ndwi = None
        mean_ndbi = None
        cloud_pct = None
        if sat:
            sat_date = sat.acquisition_date
            mean_ndvi = sat.mean_ndvi
            mean_ndwi = sat.mean_ndwi
            mean_ndbi = sat.mean_ndbi
            cloud_pct = sat.cloud_percentage
            st_records = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat.id).all()
            stats_dict = {s.class_name: s.percentage for s in st_records}

        bbox_coords = json.loads(geom.bbox) if geom.bbox else None

        properties = {
            "geometry_id": geom.id,
            "claim_id": claim.claim_id,
            "db_claim_id": claim.id,
            "applicant_name": claim.applicant_name,
            "father_or_husband_name": claim.father_or_husband_name,
            "claim_type": claim.claim_type,
            "village": claim.village,
            "block": claim.block,
            "district": claim.district,
            "state": claim.state,
            "survey_number": claim.survey_number,
            "area_claimed_hectares": claim.area_claimed,
            "calculated_area_hectares": geom.calculated_area_hectares,
            "calculated_area_m2": geom.calculated_area_m2,
            "area_difference_percentage": geom.area_difference_percentage,
            "flag_for_review": geom.flag_for_review,
            "status": claim.status,
            "verification_status": claim.verification_status,
            "geometry_source": geom.geometry_source,
            "satellite_date": sat_date,
            "mean_ndvi": mean_ndvi,
            "mean_ndwi": mean_ndwi,
            "mean_ndbi": mean_ndbi,
            "cloud_percentage": cloud_pct,
            "bbox": bbox_coords,
            "forest_percentage": stats_dict.get("forest", 0.0),
            "crop_percentage": stats_dict.get("crop", 0.0),
            "water_percentage": stats_dict.get("water", 0.0),
            "building_percentage": stats_dict.get("building", 0.0),
            "bare_land_percentage": stats_dict.get("bare_land", 0.0),
            "grassland_percentage": stats_dict.get("grassland", 0.0),
            "ai_confidence": sat.confidence if sat else 0.88
        }

        features.append(GeoJSONFeature(
            type="Feature",
            geometry=geometry_obj,
            properties=properties
        ))

    return GeoJSONFeatureCollection(type="FeatureCollection", features=features)

@router.get("/{claim_id_or_geom_id}", response_model=FRAGeometryResponse)
def get_geometry_by_id(claim_id_or_geom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    geom = db.query(FRAGeometry).filter(
        (FRAGeometry.id == claim_id_or_geom_id) | (FRAGeometry.claim_id == claim_id_or_geom_id)
    ).first()
    if not geom:
        raise HTTPException(status_code=404, detail="Geometry not found")

    return FRAGeometryResponse(
        id=geom.id,
        claim_id=geom.claim_id,
        geometry=json.loads(geom.geometry),
        geometry_source=geom.geometry_source,
        survey_reference=geom.survey_reference,
        calculated_area_m2=geom.calculated_area_m2,
        calculated_area_hectares=geom.calculated_area_hectares,
        claimed_area_hectares=geom.claimed_area_hectares,
        area_difference_percentage=geom.area_difference_percentage,
        flag_for_review=geom.flag_for_review,
        centroid=json.loads(geom.centroid) if geom.centroid else None,
        bbox=json.loads(geom.bbox) if geom.bbox else None,
        geometry_status=geom.geometry_status,
        created_at=geom.created_at,
        updated_at=geom.updated_at
    )

def _trigger_sentinel_analysis(db: Session, claim: FRAClaim, geom_dict: Dict[str, Any], total_area_m2: float, geom_id: int):
    try:
        from app.services.sentinel_hub_service import sentinel_hub_client
        from app.services.segmentation_service import perform_semantic_segmentation, extract_detected_assets
        from app.services.dss_service import run_dss_for_claim
        from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset

        sat_res = sentinel_hub_client.process_and_compute_parcel(
            claim_id=claim.claim_id,
            geojson_geom=geom_dict
        )

        sat_analysis = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).first()
        if not sat_analysis:
            sat_analysis = SatelliteAnalysis(
                claim_id=claim.id,
                geometry_id=geom_id,
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
                confidence=0.92
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

        db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat_analysis.id).delete()
        db.commit()

        seg_mask, stats_list = perform_semantic_segmentation(
            bands=sat_res["bands"],
            indices=sat_res["indices"],
            total_area_m2=total_area_m2
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

        db.query(Asset).filter(Asset.claim_id == claim.id).delete()
        db.commit()

        detected_assets = extract_detected_assets(
            geojson_geom=geom_dict,
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

        run_dss_for_claim(db, claim.id)
    except Exception:
        # A geometry submission must not look successfully analysed when CDSE
        # authentication, scene selection, or pixel processing failed.
        db.rollback()
        raise

@router.post("", response_model=FRAGeometryResponse, status_code=status.HTTP_201_CREATED)
def create_geometry(
    geom_in: FRAGeometryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER"]))
):
    claim = db.query(FRAClaim).filter(FRAClaim.id == geom_in.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Associated FRA Claim not found")

    # Geometrical validation & real geodesic area calculation
    try:
        geo_proc = validate_and_process_geometry(geom_in.geometry, claimed_area_hectares=claim.area_claimed)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Geometry validation failed: {str(e)}")

    # Check if geometry already exists for this claim
    existing = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first()
    if existing:
        existing.geometry = json.dumps(geo_proc["geometry"])
        existing.geometry_source = geom_in.geometry_source
        existing.survey_reference = geom_in.survey_reference
        existing.calculated_area_m2 = geo_proc["calculated_area_m2"]
        existing.calculated_area_hectares = geo_proc["calculated_area_hectares"]
        existing.claimed_area_hectares = geo_proc["claimed_area_hectares"]
        existing.area_difference_percentage = geo_proc["area_difference_percentage"]
        existing.flag_for_review = geo_proc["flag_for_review"]
        existing.centroid = json.dumps(geo_proc["centroid"])
        existing.bbox = json.dumps(geo_proc["bbox"])
        existing.geometry_status = geo_proc["geometry_status"]
        db.commit()
        db.refresh(existing)
        geom_record = existing
    else:
        geom_record = FRAGeometry(
            claim_id=claim.id,
            geometry=json.dumps(geo_proc["geometry"]),
            geometry_source=geom_in.geometry_source,
            survey_reference=geom_in.survey_reference,
            calculated_area_m2=geo_proc["calculated_area_m2"],
            calculated_area_hectares=geo_proc["calculated_area_hectares"],
            claimed_area_hectares=geo_proc["claimed_area_hectares"],
            area_difference_percentage=geo_proc["area_difference_percentage"],
            flag_for_review=geo_proc["flag_for_review"],
            centroid=json.dumps(geo_proc["centroid"]),
            bbox=json.dumps(geo_proc["bbox"]),
            geometry_status=geo_proc["geometry_status"]
        )
        db.add(geom_record)
        db.commit()
        db.refresh(geom_record)

    # Transition claim status to GIS_VALIDATED if not yet approved
    if claim.status in ["UPLOADED", "OCR_PROCESSED", "PENDING_VERIFICATION"]:
        claim.status = "GIS_VALIDATED"
        db.commit()

    # Automatically compute real-time Sentinel-2 remote sensing statistics & DSS scheme convergence
    _trigger_sentinel_analysis(db, claim, geo_proc["geometry"], geo_proc["calculated_area_m2"], geom_record.id)

    record_audit(db, action="ATTACH_GEOMETRY", entity="FRAGeometry", entity_id=str(geom_record.id), user_id=current_user.id, new_value={"calculated_ha": geom_record.calculated_area_hectares, "flag_for_review": geom_record.flag_for_review})

    return FRAGeometryResponse(
        id=geom_record.id,
        claim_id=geom_record.claim_id,
        geometry=json.loads(geom_record.geometry),
        geometry_source=geom_record.geometry_source,
        survey_reference=geom_record.survey_reference,
        calculated_area_m2=geom_record.calculated_area_m2,
        calculated_area_hectares=geom_record.calculated_area_hectares,
        claimed_area_hectares=geom_record.claimed_area_hectares,
        area_difference_percentage=geom_record.area_difference_percentage,
        flag_for_review=geom_record.flag_for_review,
        centroid=json.loads(geom_record.centroid) if geom_record.centroid else None,
        bbox=json.loads(geom_record.bbox) if geom_record.bbox else None,
        geometry_status=geom_record.geometry_status,
        created_at=geom_record.created_at,
        updated_at=geom_record.updated_at
    )

@router.delete("/{geom_id}")
def delete_geometry(geom_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]))):
    geom = db.query(FRAGeometry).filter(FRAGeometry.id == geom_id).first()
    if not geom:
        raise HTTPException(status_code=404, detail="Geometry not found")
    db.delete(geom)
    db.commit()
    record_audit(db, action="DELETE_GEOMETRY", entity="FRAGeometry", entity_id=str(geom_id), user_id=current_user.id, old_value={"id": geom_id})
    return {"message": "Geometry deleted successfully"}

@router.post("/upload-file", status_code=status.HTTP_201_CREATED)
async def upload_geospatial_file(
    file: UploadFile = File(...),
    claim_id: Optional[int] = Form(None),
    geometry_source: str = Form("GEOJSON_UPLOAD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER", "ANALYST"]))
):
    """
    Parses and stores real-time geospatial boundaries from .geojson, .json, or .kml files.
    - If claim_id is given, attaches the geometry to the specified claim.
    - If no claim_id is given, parses all features (single or multi-parcel), auto-creating claims
      using feature properties if needed, and stores geodesic boundaries for all parcels.
    """
    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    try:
        features = parse_geospatial_features(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Geospatial parsing failed: {str(e)}")

    processed_records = []
    errors = []

    # Case A: Specific claim_id target
    if claim_id:
        target_claim = db.query(FRAClaim).filter(FRAClaim.id == claim_id).first()
        if not target_claim:
            raise HTTPException(status_code=404, detail="Specified target FRA claim not found")

        first_geom = features[0]["geometry"]
        try:
            geo_proc = validate_and_process_geometry(first_geom, claimed_area_hectares=target_claim.area_claimed)
            existing_geom = db.query(FRAGeometry).filter(FRAGeometry.claim_id == target_claim.id).first()
            if existing_geom:
                existing_geom.geometry = json.dumps(geo_proc["geometry"])
                existing_geom.geometry_source = geometry_source
                existing_geom.calculated_area_m2 = geo_proc["calculated_area_m2"]
                existing_geom.calculated_area_hectares = geo_proc["calculated_area_hectares"]
                existing_geom.flag_for_review = geo_proc["flag_for_review"]
                existing_geom.centroid = json.dumps(geo_proc["centroid"])
                existing_geom.bbox = json.dumps(geo_proc["bbox"])
                existing_geom.geometry_status = geo_proc["geometry_status"]
                geom_rec = existing_geom
            else:
                geom_rec = FRAGeometry(
                    claim_id=target_claim.id,
                    geometry=json.dumps(geo_proc["geometry"]),
                    geometry_source=geometry_source,
                    survey_reference=target_claim.survey_number or f"SURV-{target_claim.claim_id}",
                    calculated_area_m2=geo_proc["calculated_area_m2"],
                    calculated_area_hectares=geo_proc["calculated_area_hectares"],
                    claimed_area_hectares=geo_proc["claimed_area_hectares"],
                    area_difference_percentage=geo_proc["area_difference_percentage"],
                    flag_for_review=geo_proc["flag_for_review"],
                    centroid=json.dumps(geo_proc["centroid"]),
                    bbox=json.dumps(geo_proc["bbox"]),
                    geometry_status=geo_proc["geometry_status"]
                )
                db.add(geom_rec)
            
            if target_claim.status in ["UPLOADED", "OCR_PROCESSED", "PENDING_VERIFICATION"]:
                target_claim.status = "GIS_VALIDATED"

            db.commit()

            # Auto-trigger Sentinel-2 AI analysis & DSS convergence
            _trigger_sentinel_analysis(db, target_claim, geo_proc["geometry"], geo_proc["calculated_area_m2"], geom_rec.id)

            record_audit(db, action="ATTACH_GEOMETRY_FILE", entity="FRAGeometry", entity_id=str(geom_rec.id or target_claim.id), user_id=current_user.id, new_value={"claim_id": target_claim.claim_id, "calculated_ha": geo_proc["calculated_area_hectares"]})
            processed_records.append({"claim_id": target_claim.claim_id, "area_ha": geo_proc["calculated_area_hectares"]})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Geometry validation failed: {str(e)}")

    # Case B: Multi-feature or feature-collection upload
    else:
        for idx, feat in enumerate(features):
            try:
                geom = feat.get("geometry")
                props = feat.get("properties", {})
                if not geom:
                    continue

                claim_id_code = props.get("claim_id") or f"FRA-GEN-{int(db.query(FRAClaim).count()) + idx + 1:04d}"
                claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_code).first()

                if not claim:
                    claimed_area = float(
                        props.get("area_claimed_hectares")
                        or props.get("area_claimed")
                        or props.get("area")
                        or 1.5
                    )
                    claim = FRAClaim(
                        claim_id=claim_id_code,
                        claim_type=props.get("claim_type", "IFR"),
                        applicant_name=props.get("applicant_name", f"Beneficiary {claim_id_code}"),
                        father_or_husband_name=props.get("father_or_husband_name") or props.get("father_name"),
                        village=props.get("village", "Village Area"),
                        block=props.get("block"),
                        district=props.get("district", "District Area"),
                        state=props.get("state", "State"),
                        survey_number=props.get("survey_number"),
                        area_claimed=claimed_area,
                        area_unit=props.get("area_unit", "hectares"),
                        land_use=props.get("land_use", "Traditional Agriculture & Homestead"),
                        status="GIS_VALIDATED",
                        verification_status="UNVERIFIED",
                        created_by=current_user.id
                    )
                    db.add(claim)
                    db.commit()
                    db.refresh(claim)

                geo_proc = validate_and_process_geometry(geom, claimed_area_hectares=claim.area_claimed)
                existing_geom = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first()

                if existing_geom:
                    existing_geom.geometry = json.dumps(geo_proc["geometry"])
                    existing_geom.geometry_source = geometry_source
                    existing_geom.calculated_area_m2 = geo_proc["calculated_area_m2"]
                    existing_geom.calculated_area_hectares = geo_proc["calculated_area_hectares"]
                    existing_geom.flag_for_review = geo_proc["flag_for_review"]
                    existing_geom.centroid = json.dumps(geo_proc["centroid"])
                    existing_geom.bbox = json.dumps(geo_proc["bbox"])
                    existing_geom.geometry_status = geo_proc["geometry_status"]
                    geom_target_id = existing_geom.id
                else:
                    new_geom = FRAGeometry(
                        claim_id=claim.id,
                        geometry=json.dumps(geo_proc["geometry"]),
                        geometry_source=geometry_source,
                        survey_reference=props.get("survey_number") or f"SURV-{claim.claim_id}",
                        calculated_area_m2=geo_proc["calculated_area_m2"],
                        calculated_area_hectares=geo_proc["calculated_area_hectares"],
                        claimed_area_hectares=geo_proc["claimed_area_hectares"],
                        area_difference_percentage=geo_proc["area_difference_percentage"],
                        flag_for_review=geo_proc["flag_for_review"],
                        centroid=json.dumps(geo_proc["centroid"]),
                        bbox=json.dumps(geo_proc["bbox"]),
                        geometry_status=geo_proc["geometry_status"]
                    )
                    db.add(new_geom)
                    db.commit()
                    db.refresh(new_geom)
                    geom_target_id = new_geom.id

                if claim.status in ["UPLOADED", "OCR_PROCESSED", "PENDING_VERIFICATION"]:
                    claim.status = "GIS_VALIDATED"

                db.commit()

                # Auto-trigger Sentinel-2 AI analysis & DSS convergence
                _trigger_sentinel_analysis(db, claim, geo_proc["geometry"], geo_proc["calculated_area_m2"], geom_target_id)

                processed_records.append({"claim_id": claim.claim_id, "area_ha": geo_proc["calculated_area_hectares"]})
            except Exception as e:
                errors.append({"index": idx, "error": str(e)})

    return {
        "status": "success",
        "message": f"Successfully processed {len(processed_records)} parcel boundaries.",
        "processed_count": len(processed_records),
        "parcels": processed_records,
        "errors": errors
    }
