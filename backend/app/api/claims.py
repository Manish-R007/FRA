from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis
from app.schemas.claim import FRAClaimCreate, FRAClaimUpdate, FRAClaimResponse
from app.services.audit_service import record_audit

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
    current_user: User = Depends(require_roles(["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER"]))
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
