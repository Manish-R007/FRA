from app.models.claim import FRAClaim
from app.models.scheme import Scheme
from app.services.dss_service import evaluate_scheme_for_claim, calculate_village_convergence

def test_dss_scheme_evaluation(db_session):
    # Create test scheme
    scheme = Scheme(
        name="Pradhan Mantri Krishi Sinchayee Yojana",
        code="PMKSY",
        department="Ministry of Agriculture",
        description="Micro-irrigation subsidy",
        eligibility_rules="{}",
        benefits="85% subsidy on Drip/Sprinkler",
        documents_required="[]",
        active=True
    )
    db_session.add(scheme)

    # Create approved claim
    claim = FRAClaim(
        claim_id="FRA-TEST-DSS-1",
        claim_type="IFR",
        applicant_name="Birsa Munda",
        village="Baripada",
        district="Mayurbhanj",
        state="Odisha",
        area_claimed=2.40,
        status="APPROVED",
        verification_status="VERIFIED"
    )
    db_session.add(claim)
    db_session.commit()

    # Case: High crop (40%), Low water (2%) -> PMKSY should be HIGH priority
    stats_dict = {"crop": 40.0, "water": 2.0, "forest": 30.0, "building": 4.0}
    rec = evaluate_scheme_for_claim(
        db=db_session,
        claim=claim,
        scheme=scheme,
        stats_dict=stats_dict,
        has_water_asset=False,
        has_farm_asset=True
    )

    assert rec.eligibility_status == "ELIGIBLE"
    assert rec.priority == "HIGH"
    assert rec.eligibility_score >= 85.0
    assert "surface water deficit" in rec.reason.lower() or "micro-irrigation" in rec.reason.lower()
