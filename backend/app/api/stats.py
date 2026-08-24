from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.models.scheme import Scheme, SchemeRecommendation

router = APIRouter(prefix="/stats", tags=["FRA Atlas Statistics & Analytics"])

@router.get("/atlas", response_model=Dict[str, Any])
def get_atlas_statistics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Computes high-level aggregated metrics and charts for the FRA Atlas AI Dashboard.
    """
    # 1. Total claim counts & statuses
    total_claims = db.query(FRAClaim).count()
    approved = db.query(FRAClaim).filter((FRAClaim.status == "APPROVED") | (FRAClaim.verification_status == "VERIFIED")).count()
    pending = db.query(FRAClaim).filter(FRAClaim.status.in_(["UPLOADED", "OCR_PROCESSED", "PENDING_VERIFICATION", "FIELD_VERIFICATION", "GIS_VALIDATED", "SATELLITE_ANALYZE"])).count()
    rejected = db.query(FRAClaim).filter((FRAClaim.status == "REJECTED") | (FRAClaim.verification_status == "REJECTED")).count()

    # 2. Claim types breakdown
    ifr_count = db.query(FRAClaim).filter(FRAClaim.claim_type == "IFR").count()
    cr_count = db.query(FRAClaim).filter(FRAClaim.claim_type == "CR").count()
    cfr_count = db.query(FRAClaim).filter(FRAClaim.claim_type == "CFR").count()

    # 3. Total Area
    total_claimed_area = db.query(func.sum(FRAClaim.area_claimed)).scalar() or 0.0
    total_gis_area = db.query(func.sum(FRAGeometry.calculated_area_hectares)).scalar() or 0.0

    # 4. Coverage counts
    villages_count = db.query(func.count(func.distinct(FRAClaim.village))).scalar() or 0
    districts_count = db.query(func.count(func.distinct(FRAClaim.district))).scalar() or 0
    states_count = db.query(func.count(func.distinct(FRAClaim.state))).scalar() or 0

    # 5. Land Cover aggregates from satellite analyses
    forest_area_ha = db.query(func.sum(LandCoverStatistic.area_hectares)).filter(LandCoverStatistic.class_name == "forest").scalar() or 0.0
    crop_area_ha = db.query(func.sum(LandCoverStatistic.area_hectares)).filter(LandCoverStatistic.class_name == "crop").scalar() or 0.0
    water_area_ha = db.query(func.sum(LandCoverStatistic.area_hectares)).filter(LandCoverStatistic.class_name == "water").scalar() or 0.0
    building_area_ha = db.query(func.sum(LandCoverStatistic.area_hectares)).filter(LandCoverStatistic.class_name == "building").scalar() or 0.0
    bare_land_area_ha = db.query(func.sum(LandCoverStatistic.area_hectares)).filter(LandCoverStatistic.class_name == "bare_land").scalar() or 0.0

    # 6. Detected Assets counts
    total_assets = db.query(Asset).count()
    water_assets = db.query(Asset).filter(Asset.asset_type.in_(["pond", "water_body"])).count()
    farm_assets = db.query(Asset).filter(Asset.asset_type.in_(["farm", "crop"])).count()
    forest_assets = db.query(Asset).filter(Asset.asset_type == "forest").count()
    homestead_assets = db.query(Asset).filter(Asset.asset_type.in_(["homestead", "building"])).count()

    # 7. Claims by State
    state_breakdown = (
        db.query(FRAClaim.state, func.count(FRAClaim.id).label("count"))
        .group_by(FRAClaim.state)
        .all()
    )
    claims_by_state = [{"state": r[0], "count": r[1]} for r in state_breakdown]

    # 8. Claims by District
    district_breakdown = (
        db.query(FRAClaim.district, FRAClaim.state, func.count(FRAClaim.id).label("count"))
        .group_by(FRAClaim.district, FRAClaim.state)
        .all()
    )
    claims_by_district = [{"district": r[0], "state": r[1], "count": r[2]} for r in district_breakdown]

    # 9. Claims by Status
    status_breakdown = (
        db.query(FRAClaim.status, func.count(FRAClaim.id).label("count"))
        .group_by(FRAClaim.status)
        .all()
    )
    claims_by_status = [{"status": r[0], "count": r[1]} for r in status_breakdown]

    # 10. Scheme Recommendations count
    high_priority_recs = db.query(SchemeRecommendation).filter(SchemeRecommendation.priority == "HIGH").count()
    total_recs = db.query(SchemeRecommendation).count()

    # 11. Discrepancy Flag count
    flagged_geometries = db.query(FRAGeometry).filter(FRAGeometry.flag_for_review == True).count()

    return {
        "summary": {
            "total_claims": total_claims,
            "approved_claims": approved,
            "pending_claims": pending,
            "rejected_claims": rejected,
            "total_claimed_area_hectares": round(float(total_claimed_area), 2),
            "total_gis_area_hectares": round(float(total_gis_area), 2),
            "villages_covered": villages_count,
            "districts_covered": districts_count,
            "states_covered": states_count,
            "flagged_discrepancies": flagged_geometries,
            "high_priority_interventions": high_priority_recs
        },
        "claim_types": {
            "IFR": ifr_count,
            "CR": cr_count,
            "CFR": cfr_count
        },
        "land_cover_totals_ha": {
            "forest": round(float(forest_area_ha), 2),
            "crop": round(float(crop_area_ha), 2),
            "water": round(float(water_area_ha), 2),
            "building": round(float(building_area_ha), 2),
            "bare_land": round(float(bare_land_area_ha), 2)
        },
        "assets_detected": {
            "total": total_assets,
            "water_bodies": water_assets,
            "farms": farm_assets,
            "forest_stands": forest_assets,
            "homesteads": homestead_assets
        },
        "charts": {
            "by_state": claims_by_state,
            "by_district": claims_by_district,
            "by_status": claims_by_status
        }
    }
