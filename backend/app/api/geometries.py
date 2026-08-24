import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic
from app.schemas.geometry import FRAGeometryCreate, FRAGeometryUpdate, FRAGeometryResponse, GeoJSONFeatureCollection, GeoJSONFeature
from app.services.gis_service import validate_and_process_geometry
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
        if sat:
            sat_date = sat.acquisition_date
            mean_ndvi = sat.mean_ndvi
            st_records = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == sat.id).all()
            stats_dict = {s.class_name: s.percentage for s in st_records}

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
