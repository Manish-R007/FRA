from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.claim import FRAClaim
from app.models.scheme import Scheme, SchemeCoverage, SchemeRecommendation
from app.models.user import User
from app.services.audit_service import record_audit

router = APIRouter(prefix="/coverage", tags=["Scheme Coverage"])
OFFICER_ROLES = ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER", "ANALYST"]
STATUSES = {"eligibility_status": {"UNKNOWN", "ELIGIBLE", "INELIGIBLE", "CONDITIONAL"},
            "enrollment_status": {"UNKNOWN", "ENROLLED", "NOT_ENROLLED", "PENDING"},
            "coverage_status": {"UNKNOWN", "COVERED", "NOT_COVERED", "PENDING"}}


class CoverageUpdate(BaseModel):
    claim_id: int
    scheme_id: int
    eligibility_status: str = "UNKNOWN"
    enrollment_status: str = "UNKNOWN"
    coverage_status: str = "UNKNOWN"
    benefit_information: Optional[str] = Field(default=None, max_length=2000)
    source_reference: Optional[str] = Field(default=None, max_length=500)


def _scope(query, user: User):
    if user.role == "CITIZEN":
        return query.filter(FRAClaim.created_by == user.id)
    if user.role == "STATE_OFFICER" and user.state:
        return query.filter(FRAClaim.state == user.state)
    if user.role == "DISTRICT_OFFICER" and user.district:
        return query.filter(FRAClaim.district == user.district)
    if user.role == "FIELD_OFFICER":
        if user.village:
            query = query.filter(FRAClaim.village == user.village)
        if user.district:
            query = query.filter(FRAClaim.district == user.district)
        return query
    return query


def _metrics_for_claims(db: Session, claims, schemes, coverage_by_key=None, recommendations_by_key=None):
    """Combine current DSS eligibility assessments with explicitly recorded delivery outcomes."""
    claim_ids = [claim.id for claim in claims]
    scheme_ids = [scheme.id for scheme in schemes]
    if coverage_by_key is None:
        coverage_rows = db.query(SchemeCoverage).filter(
            SchemeCoverage.claim_id.in_(claim_ids), SchemeCoverage.scheme_id.in_(scheme_ids)
        ).all() if claim_ids and scheme_ids else []
        coverage_by_key = {(row.claim_id, row.scheme_id): row for row in coverage_rows}
    if recommendations_by_key is None:
        recommendation_rows = db.query(SchemeRecommendation).filter(
            SchemeRecommendation.claim_id.in_(claim_ids), SchemeRecommendation.scheme_id.in_(scheme_ids)
        ).all() if claim_ids and scheme_ids else []
        recommendations_by_key = {(row.claim_id, row.scheme_id): row for row in recommendation_rows}

    output = {}
    for scheme in schemes:
        eligible = assessed = conditional = ineligible = enrolled = covered = pending = not_covered = 0
        for claim in claims:
            key = (claim.id, scheme.id)
            recommendation = recommendations_by_key.get(key)
            recorded = coverage_by_key.get(key)
            eligibility = (
                recorded.eligibility_status
                if recorded and recorded.eligibility_status in {"ELIGIBLE", "CONDITIONAL", "INELIGIBLE"}
                else recommendation.eligibility_status if recommendation else "UNKNOWN"
            )
            eligible += eligibility == "ELIGIBLE"
            conditional += eligibility == "CONDITIONAL"
            ineligible += eligibility == "INELIGIBLE"
            assessed += eligibility in {"ELIGIBLE", "CONDITIONAL", "INELIGIBLE"}
            if recorded:
                enrolled += recorded.enrollment_status == "ENROLLED"
                covered += recorded.coverage_status == "COVERED"
                not_covered += recorded.coverage_status == "NOT_COVERED"
                pending += recorded.coverage_status == "PENDING" or recorded.enrollment_status == "PENDING"
        output[scheme.id] = {
            "scheme_id": scheme.id, "scheme_code": scheme.code, "scheme_name": scheme.name,
            "claims_in_scope": len(claims), "total_claims_in_scope": len(claims), "eligible_beneficiaries": eligible,
            "eligibility_assessed": assessed, "conditional_beneficiaries": conditional,
            "ineligible_beneficiaries": ineligible, "enrolled_beneficiaries": enrolled,
            "confirmed_covered": covered, "pending_beneficiaries": pending,
            "confirmed_not_covered": not_covered,
            "coverage_percentage": round(covered / (covered + not_covered) * 100, 1) if covered + not_covered else None,
            "coverage_denominator": covered + not_covered,
            "unknown_coverage": max(0, len(claims) - covered - not_covered - pending),
            "data_source": "explicit eligibility decision when recorded, otherwise DSS recommendation; scheme coverage records for enrollment and delivery",
        }
    return output


@router.get("")
def coverage_summary(state: Optional[str] = None, district: Optional[str] = None,
                     block: Optional[str] = None, village: Optional[str] = None,
                     claim_type: Optional[str] = None, scheme_code: Optional[str] = None,
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if claim_type and claim_type not in {"IFR", "CR", "CFR"}:
        raise HTTPException(status_code=422, detail="claim_type must be IFR, CR, or CFR")
    if user.role == "STATE_OFFICER" and state and state != user.state:
        raise HTTPException(status_code=403, detail="State filter is outside your access scope")
    if user.role == "DISTRICT_OFFICER" and district and district != user.district:
        raise HTTPException(status_code=403, detail="District filter is outside your access scope")
    if user.role == "FIELD_OFFICER" and ((district and user.district and district != user.district) or (village and user.village and village != user.village)):
        raise HTTPException(status_code=403, detail="Location filter is outside your access scope")
    q = _scope(db.query(FRAClaim), user)
    if state: q = q.filter(FRAClaim.state == state)
    if district: q = q.filter(FRAClaim.district == district)
    if block: q = q.filter(FRAClaim.block == block)
    if village: q = q.filter(FRAClaim.village == village)
    if claim_type: q = q.filter(FRAClaim.claim_type == claim_type)
    claims = q.all()
    schemes_q = db.query(Scheme).filter(Scheme.active.is_(True))
    if scheme_code: schemes_q = schemes_q.filter(Scheme.code == scheme_code)
    schemes = schemes_q.order_by(Scheme.name).all()
    metrics = _metrics_for_claims(db, claims, schemes)
    output = []
    for scheme in schemes:
        output.append(metrics[scheme.id])
    return {"filters": {"state": state, "district": district, "block": block, "village": village,
                         "claim_type": claim_type, "scheme_code": scheme_code}, "schemes": output}


@router.get("/monitoring")
def coverage_monitoring(level: str = "state", state: Optional[str] = None,
                       district: Optional[str] = None, block: Optional[str] = None,
                       db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Live location rollups; eligibility comes from DSS assessments, delivery from recorded coverage."""
    if level not in {"state", "district", "village"}:
        raise HTTPException(status_code=422, detail="level must be state, district, or village")
    if user.role == "STATE_OFFICER" and state and state != user.state:
        raise HTTPException(status_code=403, detail="State filter is outside your access scope")
    if user.role == "DISTRICT_OFFICER" and district and district != user.district:
        raise HTTPException(status_code=403, detail="District filter is outside your access scope")
    claims_query = _scope(db.query(FRAClaim), user)
    if state: claims_query = claims_query.filter(FRAClaim.state == state)
    if district: claims_query = claims_query.filter(FRAClaim.district == district)
    if block: claims_query = claims_query.filter(FRAClaim.block == block)
    claims = claims_query.order_by(FRAClaim.state, FRAClaim.district, FRAClaim.village).all()
    schemes = db.query(Scheme).filter(Scheme.active.is_(True)).order_by(Scheme.name).all()
    claim_ids = [claim.id for claim in claims]
    scheme_ids = [scheme.id for scheme in schemes]
    coverage_rows = db.query(SchemeCoverage).filter(
        SchemeCoverage.claim_id.in_(claim_ids), SchemeCoverage.scheme_id.in_(scheme_ids)
    ).all() if claim_ids and scheme_ids else []
    recommendation_rows = db.query(SchemeRecommendation).filter(
        SchemeRecommendation.claim_id.in_(claim_ids), SchemeRecommendation.scheme_id.in_(scheme_ids)
    ).all() if claim_ids and scheme_ids else []
    coverage_map = {(row.claim_id, row.scheme_id): row for row in coverage_rows}
    recommendation_map = {(row.claim_id, row.scheme_id): row for row in recommendation_rows}
    dimensions = {
        "state": ("state",),
        "district": ("state", "district"),
        "village": ("state", "district", "village"),
    }[level]
    groups = {}
    for claim in claims:
        key = tuple(getattr(claim, dimension) or "" for dimension in dimensions)
        groups.setdefault(key, []).append(claim)
    rows = []
    for key, group_claims in groups.items():
        location = dict(zip(dimensions, key))
        rows.append({**location, "claim_count": len(group_claims),
                     "approved_claims": sum(c.status == "APPROVED" or c.verification_status == "VERIFIED" for c in group_claims),
                     "schemes": list(_metrics_for_claims(db, group_claims, schemes, coverage_map, recommendation_map).values())})
    totals_schemes = list(_metrics_for_claims(db, claims, schemes, coverage_map, recommendation_map).values())
    return {
        "level": level,
        "filters": {"state": state, "district": district, "block": block},
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
        "locations": rows,
        "totals": {"claim_count": len(claims),
                   "approved_claims": sum(c.status == "APPROVED" or c.verification_status == "VERIFIED" for c in claims),
                   "eligible_assessments": sum(m["eligible_beneficiaries"] for m in totals_schemes),
                   "schemes": totals_schemes},
        "options": {
            "states": sorted({c.state for c in claims if c.state}),
            "districts": sorted({c.district for c in claims if c.district}),
            "blocks": sorted({c.block for c in claims if c.block}),
        },
    }


@router.put("/record")
def record_coverage(body: CoverageUpdate, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(OFFICER_ROLES))):
    claim = db.query(FRAClaim).filter(FRAClaim.id == body.claim_id).first()
    scheme = db.query(Scheme).filter(Scheme.id == body.scheme_id).first()
    if not claim or not scheme:
        raise HTTPException(status_code=404, detail="Claim or scheme not found")
    if user.role == "STATE_OFFICER" and claim.state != user.state:
        raise HTTPException(status_code=403, detail="Claim is outside your state scope")
    if user.role == "DISTRICT_OFFICER" and claim.district != user.district:
        raise HTTPException(status_code=403, detail="Claim is outside your district scope")
    if user.role == "FIELD_OFFICER" and ((user.district and claim.district != user.district) or (user.village and claim.village != user.village)):
        raise HTTPException(status_code=403, detail="Claim is outside your field scope")
    values = body.model_dump(exclude={"claim_id", "scheme_id"})
    for key, allowed in STATUSES.items():
        values[key] = values[key].upper()
        if values[key] not in allowed:
            raise HTTPException(status_code=422, detail=f"Invalid {key}")
    row = db.query(SchemeCoverage).filter_by(claim_id=claim.id, scheme_id=scheme.id).first()
    if row is None:
        row = SchemeCoverage(claim_id=claim.id, scheme_id=scheme.id)
        db.add(row)
    for key, value in values.items(): setattr(row, key, value)
    row.updated_by = user.id
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    record_audit(db, action="RECORD_SCHEME_COVERAGE", entity="SchemeCoverage", entity_id=str(row.id), user_id=user.id,
                 new_value={"claim_id": claim.id, "scheme_code": scheme.code, **values})
    return {"id": row.id, "claim_id": claim.id, "scheme_code": scheme.code, **values, "updated_at": row.updated_at}
