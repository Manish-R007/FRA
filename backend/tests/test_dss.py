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


def test_dss_jjm_scheme_evaluation_with_and_without_water(db_session):
    # Create JJM scheme
    scheme = Scheme(
        name="Jal Jeevan Mission (JJM - Har Ghar Jal)",
        code="JJM",
        department="Ministry of Jal Shakti",
        description="Household tap water connection",
        eligibility_rules="{}",
        benefits="100% assistance for Functional Household Tap Connection",
        documents_required="[]",
        active=True
    )
    db_session.add(scheme)

    claim = FRAClaim(
        claim_id="FRA-TEST-JJM-1",
        claim_type="IFR",
        applicant_name="Budhan Kol",
        village="Karanjia",
        district="Mayurbhanj",
        state="Odisha",
        area_claimed=1.80,
        status="APPROVED",
        verification_status="VERIFIED"
    )
    db_session.add(claim)
    db_session.commit()

    # Case A: Land HAS water (water: 12%, has_water_asset: True) -> JJM should be INELIGIBLE
    stats_with_water = {"crop": 30.0, "water": 12.0, "forest": 20.0, "building": 5.0}
    rec_with_water = evaluate_scheme_for_claim(
        db=db_session,
        claim=claim,
        scheme=scheme,
        stats_dict=stats_with_water,
        has_water_asset=True,
        has_farm_asset=True
    )
    assert rec_with_water.eligibility_status == "INELIGIBLE"
    assert rec_with_water.priority == "LOW"
    assert "surface water body" in rec_with_water.reason.lower() or "water resource is already accessible" in rec_with_water.reason.lower()

    # Case B: Land HAS water deficit (water: 1.2%, has_water_asset: False) -> JJM should be ELIGIBLE
    stats_water_deficit = {"crop": 35.0, "water": 1.2, "forest": 20.0, "building": 8.0}
    rec_water_deficit = evaluate_scheme_for_claim(
        db=db_session,
        claim=claim,
        scheme=scheme,
        stats_dict=stats_water_deficit,
        has_water_asset=False,
        has_farm_asset=True
    )
    assert rec_water_deficit.eligibility_status == "ELIGIBLE"
    assert rec_water_deficit.priority == "HIGH"
    assert rec_water_deficit.eligibility_score >= 80.0
    assert "surface water deficit" in rec_water_deficit.reason.lower()
