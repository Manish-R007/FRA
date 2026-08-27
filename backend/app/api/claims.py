import json
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.models.document import Document, DocumentField
from app.models.scheme import SchemeRecommendation
from app.models.audit import Notification
from app.schemas.claim import FRAClaimCreate, FRAClaimUpdate, FRAClaimResponse
from app.services.audit_service import record_audit
from app.services.gis_service import validate_and_process_geometry

router = APIRouter(prefix="/claims", tags=["FRA Claims"])

@router.get("", response_model=List[FRAClaimResponse])
def get_claims(
    claim_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    district: Optional[str] = None,
    village: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FRAClaim)

    # RBAC filtering
    if current_user.role == "CITIZEN":
        # Citizen can view own claims or claims in their village
        query = query.filter((FRAClaim.created_by == current_user.id) | (FRAClaim.village == current_user.village))
    elif current_user.role in ["DISTRICT_OFFICER", "FIELD_OFFICER"] and current_user.district:
        query = query.filter(FRAClaim.district == current_user.district)
    elif current_user.role == "STATE_OFFICER" and current_user.state:
        query = query.filter(FRAClaim.state == current_user.state)

    if claim_type:
        query = query.filter(FRAClaim.claim_type == claim_type)
    if status_filter:
        query = query.filter(FRAClaim.status == status_filter)
    if district:
        query = query.filter(FRAClaim.district == district)
    if village:
        query = query.filter(FRAClaim.village == village)
    if state:
        query = query.filter(FRAClaim.state == state)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (FRAClaim.claim_id.ilike(search_fmt)) |
            (FRAClaim.applicant_name.ilike(search_fmt)) |
            (FRAClaim.village.ilike(search_fmt)) |
            (FRAClaim.survey_number.ilike(search_fmt))
        )

    claims = query.order_by(FRAClaim.id.desc()).offset(skip).limit(limit).all()

    # Enrich with flags for has_geometry and has_analysis
    claim_ids = [c.id for c in claims]
    geom_claim_ids = set(r[0] for r in db.query(FRAGeometry.claim_id).filter(FRAGeometry.claim_id.in_(claim_ids)).all()) if claim_ids else set()
    sat_claim_ids = set(r[0] for r in db.query(SatelliteAnalysis.claim_id).filter(SatelliteAnalysis.claim_id.in_(claim_ids)).all()) if claim_ids else set()

    result = []
    for c in claims:
        resp = FRAClaimResponse.model_validate(c)
        resp.has_geometry = c.id in geom_claim_ids
        resp.has_analysis = c.id in sat_claim_ids
        result.append(resp)

    return result

@router.get("/{claim_id_or_id}", response_model=FRAClaimResponse)
def get_claim(claim_id_or_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    else:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    has_geom = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first() is not None
    has_sat = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).first() is not None

    resp = FRAClaimResponse.model_validate(claim)
    resp.has_geometry = has_geom
    resp.has_analysis = has_sat
    return resp

@router.post("", response_model=FRAClaimResponse, status_code=status.HTTP_201_CREATED)
def create_claim(
    claim_in: FRAClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_in.claim_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Claim ID already exists")

    claim = FRAClaim(
        **claim_in.model_dump(),
        verification_status="UNVERIFIED",
        created_by=current_user.id
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    record_audit(db, action="CREATE_CLAIM", entity="FRAClaim", entity_id=str(claim.id), user_id=current_user.id, new_value={"claim_id": claim.claim_id, "applicant": claim.applicant_name})

    resp = FRAClaimResponse.model_validate(claim)
    resp.has_geometry = False
    resp.has_analysis = False
    return resp

@router.put("/{claim_id_or_id}", response_model=FRAClaimResponse)
def update_claim(
    claim_id_or_id: str,
    claim_update: FRAClaimUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER"]))
):
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    else:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    old_data = {"status": claim.status, "verification_status": claim.verification_status, "area": claim.area_claimed}
    
    update_dict = claim_update.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(claim, field, value)

    db.commit()
    db.refresh(claim)

    record_audit(db, action="UPDATE_CLAIM", entity="FRAClaim", entity_id=str(claim.id), user_id=current_user.id, old_value=old_data, new_value=update_dict)

    has_geom = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first() is not None
    has_sat = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).first() is not None

    resp = FRAClaimResponse.model_validate(claim)
    resp.has_geometry = has_geom
    resp.has_analysis = has_sat
    return resp

@router.patch("/{claim_id_or_id}/status", response_model=FRAClaimResponse)
def update_claim_status(
    claim_id_or_id: str,
    new_status: str = Query(..., description="APPROVED, REJECTED, FIELD_VERIFICATION, GIS_VALIDATED, SATELLITE_ANALYZE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]))
):
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    else:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    old_status = claim.status
    claim.status = new_status
    if new_status == "APPROVED":
        claim.verification_status = "VERIFIED"
    elif new_status == "REJECTED":
        claim.verification_status = "REJECTED"

    db.commit()
    db.refresh(claim)

    record_audit(db, action="CHANGE_CLAIM_STATUS", entity="FRAClaim", entity_id=str(claim.id), user_id=current_user.id, old_value={"status": old_status}, new_value={"status": new_status})

    resp = FRAClaimResponse.model_validate(claim)
    return resp

@router.delete("/{claim_id_or_id}")
def delete_claim(
    claim_id_or_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    if claim_id_or_id.isdigit():
        claim = db.query(FRAClaim).filter(FRAClaim.id == int(claim_id_or_id)).first()
    else:
        claim = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_or_id).first()

    if not claim:
        raise HTTPException(status_code=404, detail="FRA Claim not found")

    claim_id_val = claim.id
    db.delete(claim)
    db.commit()

    record_audit(db, action="DELETE_CLAIM", entity="FRAClaim", entity_id=str(claim_id_val), user_id=current_user.id, old_value={"claim_id": claim.claim_id})

    return {"message": f"Claim {claim_id_or_id} deleted successfully"}

@router.post("/purge-data")
def purge_all_claims_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER"]))
):
    """
    Purges all claims, boundary geometries, satellite analyses, land cover statistics,
    detected assets, documents, and recommendations.
    Leaves user accounts, government schemes, and policy documents intact.
    """
    claims_count = db.query(FRAClaim).count()
    
    db.query(Asset).delete()
    db.query(LandCoverStatistic).delete()
    db.query(SatelliteAnalysis).delete()
    db.query(FRAGeometry).delete()
    db.query(DocumentField).delete()
    db.query(Document).delete()
    db.query(SchemeRecommendation).delete()
    db.query(Notification).delete()
    db.query(FRAClaim).delete()
    
    db.commit()
    
    record_audit(
        db,
        action="PURGE_ALL_CLAIMS_DATA",
        entity="FRAClaim",
        entity_id="ALL",
        user_id=current_user.id,
        new_value={"purged_claims_count": claims_count}
    )
    
    return {
        "status": "success",
        "message": f"Successfully purged {claims_count} claims and all dependent geospatial & satellite data.",
        "purged_count": claims_count
    }

@router.post("/bulk-upload", status_code=status.HTTP_201_CREATED)
def bulk_upload_claims(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER"]))
):
    """
    Bulk imports real FRA claims from JSON list or GeoJSON FeatureCollection.
    Automatically creates claims and attaches geometries.
    """
    claims_data = payload.get("claims") or payload.get("features") or payload
    if isinstance(claims_data, dict) and claims_data.get("type") == "FeatureCollection":
        claims_data = claims_data.get("features", [])
    elif not isinstance(claims_data, list):
        claims_data = [claims_data]

    created_records = []
    errors = []

    for idx, item in enumerate(claims_data):
        try:
            # Handle GeoJSON Feature vs Plain Dictionary
            props = item.get("properties", item) if isinstance(item, dict) else {}
            geom = item.get("geometry") if isinstance(item, dict) else None

            claim_id_val = props.get("claim_id") or f"FRA-GEN-{int(db.query(FRAClaim).count()) + idx + 1:04d}"
            
            # Check existing
            existing = db.query(FRAClaim).filter(FRAClaim.claim_id == claim_id_val).first()
            if existing:
                claim = existing
            else:
                claim = FRAClaim(
                    claim_id=claim_id_val,
                    claim_type=props.get("claim_type", "IFR"),
                    applicant_name=props.get("applicant_name", f"Beneficiary {claim_id_val}"),
                    father_or_husband_name=props.get("father_or_husband_name") or props.get("father_name"),
                    age=int(props["age"]) if props.get("age") and str(props["age"]).isdigit() else None,
                    gender=props.get("gender", "Male"),
                    village=props.get("village", "Village"),
                    block=props.get("block"),
                    district=props.get("district", "District"),
                    state=props.get("state", "State"),
                    survey_number=props.get("survey_number"),
                    area_claimed=float(props.get("area_claimed") or props.get("area") or 1.5),
                    area_unit=props.get("area_unit", "hectares"),
                    land_use=props.get("land_use", "Traditional Agriculture"),
                    application_date=props.get("application_date"),
                    status=props.get("status", "UPLOADED"),
                    verification_status=props.get("verification_status", "UNVERIFIED"),
                    created_by=current_user.id
                )
                db.add(claim)
                db.commit()
                db.refresh(claim)

            # If geometry or polygon coordinates provided, attach geometry
            if not geom and "polygon_coordinates" in props:
                geom = {"type": "Polygon", "coordinates": props["polygon_coordinates"]}

            if geom:
                geo_proc = validate_and_process_geometry(geom, claimed_area_hectares=claim.area_claimed)
                existing_geom = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim.id).first()
                if existing_geom:
                    existing_geom.geometry = json.dumps(geo_proc["geometry"])
                    existing_geom.calculated_area_m2 = geo_proc["calculated_area_m2"]
                    existing_geom.calculated_area_hectares = geo_proc["calculated_area_hectares"]
                    existing_geom.flag_for_review = geo_proc["flag_for_review"]
                    existing_geom.centroid = json.dumps(geo_proc["centroid"])
                    existing_geom.bbox = json.dumps(geo_proc["bbox"])
                    db.commit()
                else:
                    new_geom = FRAGeometry(
                        claim_id=claim.id,
                        geometry=json.dumps(geo_proc["geometry"]),
                        geometry_source="GEOJSON_BULK_UPLOAD",
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

            created_records.append(claim.claim_id)
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})

    return {
        "status": "success",
        "created_count": len(created_records),
        "created_claim_ids": created_records,
        "errors": errors
    }
