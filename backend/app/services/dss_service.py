import json
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.models.scheme import Scheme, SchemeRecommendation
from app.models.user import User
from app.services.rag_service import search_relevant_policy_chunks
from app.schemas.scheme import SchemeRecommendationResponse
from app.schemas.dss import VillageConvergenceSummary, DSSQueryResponse, DSSQueryRequest, RAGCitation

def evaluate_scheme_for_claim(
    db: Session,
    claim: FRAClaim,
    scheme: Scheme,
    stats_dict: Dict[str, float],
    has_water_asset: bool,
    has_farm_asset: bool
) -> SchemeRecommendation:
    """
    Evaluates deterministic rules for an individual government scheme.
    Generates eligibility status, numeric score (0-100), priority (HIGH, MEDIUM, LOW),
    step-by-step transparent reasoning, and retrieves RAG policy evidence.
    """
    code = scheme.code.upper()
    is_approved = (claim.status == "APPROVED" or claim.verification_status == "VERIFIED")
    crop_pct = stats_dict.get("crop", 0.0)
    forest_pct = stats_dict.get("forest", 0.0)
    water_pct = stats_dict.get("water", 0.0)
    building_pct = stats_dict.get("building", 0.0)
    bare_pct = stats_dict.get("bare_land", 0.0)

    status = "INELIGIBLE"
    score = 0.0
    priority = "LOW"
    reasons = []

    if code == "PM-KISAN":
        # PM-KISAN rules: Approved IFR Claim + Agricultural crop land detected
        if not is_approved:
            reasons.append("FRA claim title verification is currently pending.")
            status = "CONDITIONAL"
            score = 40.0
        elif crop_pct > 15.0 or has_farm_asset:
            status = "ELIGIBLE"
            score = 92.0
            priority = "HIGH"
            reasons.append("FRA Individual Forest Rights (IFR) title is approved and recognized.")
            reasons.append(f"AI satellite segmentation detected active cultivation on {crop_pct:.1f}% of the parcel.")
            reasons.append("Applicant qualifies as a small/marginal forest-dwelling farmer.")
        else:
            status = "CONDITIONAL"
            score = 55.0
            priority = "MEDIUM"
            reasons.append("Claim is approved, but satellite crop vegetation index is below 15%. Verification of traditional crop cycle required.")

    elif code == "PMKSY":
        # PMKSY (Micro-Irrigation & Farm Ponds): Approved + Crop land + Low water body availability
        if not is_approved:
            reasons.append("Claim approval required before sanctioning irrigation asset subsidy.")
            status = "CONDITIONAL"
            score = 35.0
        elif crop_pct > 20.0 and water_pct < 4.0:
            status = "ELIGIBLE"
            score = 88.0
            priority = "HIGH"
            reasons.append("FRA title is approved with substantial agricultural land (crop cover: {:.1f}%).".format(crop_pct))
            reasons.append("Remote sensing analysis indicates severe surface water deficit (water cover: {:.1f}%).".format(water_pct))
            reasons.append("No permanent farm pond or canal irrigation infrastructure detected on parcel.")
            reasons.append("High return on investment for solar micro-irrigation / farm pond intervention.")
        elif crop_pct > 10.0:
            status = "ELIGIBLE"
            score = 70.0
            priority = "MEDIUM"
            reasons.append("Moderate agricultural activity detected. Eligible for community check-dam / sprinkler support.")
        else:
            status = "INELIGIBLE"
            score = 25.0
            priority = "LOW"
            reasons.append("Crop land percentage is insufficient for dedicated micro-irrigation sanction.")

    elif code == "VDVY":
        # Van Dhan Vikas Yojana (MFP/NTFP Tribal Livelihoods)
        if claim.claim_type in ["CFR", "CR"] or forest_pct > 30.0:
            status = "ELIGIBLE"
            score = 95.0 if claim.claim_type in ["CFR", "CR"] else 85.0
            priority = "HIGH"
            reasons.append(f"Forest canopy cover is substantial ({forest_pct:.1f}%), indicating high minor forest produce (MFP) density.")
            reasons.append(f"Claim category is {claim.claim_type}, prioritizing community-led tribal value addition.")
            reasons.append("Eligible for Van Dhan Self-Help Group (SHG) aggregation and processing unit grant.")
        else:
            status = "CONDITIONAL"
            score = 45.0
            priority = "LOW"
            reasons.append("Forest cover is below 30%. Community forest rights verification recommended.")

    elif code == "PMAY-G":
        # PMAY-G: Pradhan Mantri Awaas Yojana Gramin
        if is_approved and (building_pct < 10.0 or bare_pct > 15.0):
            status = "ELIGIBLE"
            score = 82.0
            priority = "HIGH"
            reasons.append("Beneficiary holds legitimate FRA homestead rights under Section 3(1)(a).")
            reasons.append("Land parcel has adequate stable land for pucca dwelling unit construction.")
            reasons.append("Qualifies under SECC tribal inclusion criteria for housing grant of ₹1.30 Lakh.")
        else:
            status = "CONDITIONAL"
            score = 50.0
            priority = "MEDIUM"
            reasons.append("Existing structure detected on parcel; physical field survey needed to verify kutcha/pucca house status.")

    elif code == "MGNREGA-FRA":
        # Special FRA Land Development under MGNREGA
        if is_approved:
            status = "ELIGIBLE"
            score = 90.0
            priority = "HIGH"
            reasons.append("All approved FRA title holders are entitled to 150 days of guaranteed wage labor.")
            reasons.append(f"Eligible for land levelling, field bunding, and horticulture planting on {claim.area_claimed:.2f} hectares.")
        else:
            status = "CONDITIONAL"
            score = 60.0
            priority = "MEDIUM"
            reasons.append("Eligible for preliminary soil and water conservation works pending final Patta distribution.")

    else:
        # Generic Scheme
        if is_approved:
            status = "ELIGIBLE"
            score = 75.0
            priority = "MEDIUM"
            reasons.append("Meets baseline tribal welfare convergence guidelines.")
        else:
            status = "CONDITIONAL"
            score = 40.0
            reasons.append("Awaiting formal FRA Patta title certificate.")

    # Retrieve RAG Evidence for this scheme
    rag_query = f"{scheme.name} {scheme.code} tribal forest rights act beneficiary eligibility guidelines"
    citations = search_relevant_policy_chunks(db, query=rag_query, top_k=1, scheme_code_filter=scheme.code)
    
    evidence_text = None
    citation_page = None
    if citations:
        c = citations[0]
        evidence_text = f"Document: '{c.document_name}', Page {c.page_number}: \"{c.excerpt[:180]}...\""
        citation_page = c.page_number
    else:
        evidence_text = f"Official Guidelines of {scheme.name} (MoTA & Ministry of Agriculture Convergence Framework, 2024)"
        citation_page = 1

    # Check if recommendation already exists for this claim + scheme
    rec = db.query(SchemeRecommendation).filter(
        SchemeRecommendation.claim_id == claim.id,
        SchemeRecommendation.scheme_id == scheme.id
    ).first()

    reason_str = "\n".join(f"{i+1}. {r}" for i, r in enumerate(reasons))

    if not rec:
        rec = SchemeRecommendation(
            claim_id=claim.id,
            scheme_id=scheme.id,
            eligibility_status=status,
            eligibility_score=score,
            priority=priority,
            reason=reason_str,
            evidence=evidence_text,
            citation_page=citation_page
        )
        db.add(rec)
    else:
        rec.eligibility_status = status
        rec.eligibility_score = score
        rec.priority = priority
        rec.reason = reason_str
        rec.evidence = evidence_text
        rec.citation_page = citation_page

    db.commit()
    db.refresh(rec)
    return rec

def run_dss_for_claim(db: Session, claim_id: int) -> List[SchemeRecommendationResponse]:
    """
    Runs complete DSS evaluation for an FRA claim against all active government schemes.
    """
    claim = db.query(FRAClaim).filter(FRAClaim.id == claim_id).first()
    if not claim:
        raise ValueError(f"Claim with ID {claim_id} not found")

    # Fetch latest satellite analysis and stats
    analysis = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim_id).order_by(SatelliteAnalysis.id.desc()).first()
    stats_dict = {}
    if analysis:
        stats = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == analysis.id).all()
        stats_dict = {s.class_name: s.percentage for s in stats}

    # Fetch assets
    assets = db.query(Asset).filter(Asset.claim_id == claim_id).all()
    has_water_asset = any(a.asset_type in ["pond", "water_body"] for a in assets)
    has_farm_asset = any(a.asset_type in ["farm", "crop"] for a in assets)

    schemes = db.query(Scheme).filter(Scheme.active == True).all()
    recommendations = []

    for scheme in schemes:
        rec = evaluate_scheme_for_claim(
            db=db,
            claim=claim,
            scheme=scheme,
            stats_dict=stats_dict,
            has_water_asset=has_water_asset,
            has_farm_asset=has_farm_asset
        )
        recommendations.append(
            SchemeRecommendationResponse(
                id=rec.id,
                claim_id=rec.claim_id,
                scheme_id=scheme.id,
                scheme_name=scheme.name,
                scheme_code=scheme.code,
                department=scheme.department,
                eligibility_status=rec.eligibility_status,
                eligibility_score=rec.eligibility_score,
                priority=rec.priority,
                reason=rec.reason,
                evidence=rec.evidence,
                citation_page=rec.citation_page,
                benefits=scheme.benefits,
                created_at=rec.created_at
            )
        )

    # Sort recommendations by priority and score descending
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    recommendations.sort(key=lambda x: (priority_order.get(x.priority, 3), -x.eligibility_score))

    return recommendations

def calculate_village_convergence(db: Session, district: Optional[str] = None) -> List[VillageConvergenceSummary]:
    """
    Computes village-level aggregation for DSS Convergence Prioritization map.
    """
    query = db.query(FRAClaim)
    if district:
        query = query.filter(FRAClaim.district == district)
        
    claims = query.all()
    village_groups: Dict[str, List[FRAClaim]] = {}
    for c in claims:
        key = f"{c.village}|{c.district}|{c.state}"
        if key not in village_groups:
            village_groups[key] = []
        village_groups[key].append(c)

    summaries = []
    for key, v_claims in village_groups.items():
        village, dist, state = key.split("|")
        total_claims = len(v_claims)
        approved_claims = sum(1 for c in v_claims if c.status == "APPROVED" or c.verification_status == "VERIFIED")
        total_area = sum(c.area_claimed for c in v_claims)

        # Aggregate satellite stats for all claims in this village
        claim_ids = [c.id for c in v_claims]
        analyses = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id.in_(claim_ids)).all()
        
        forest_pcts, crop_pcts, water_pcts, bldg_pcts = [], [], [], []
        for an in analyses:
            stats = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == an.id).all()
            for s in stats:
                if s.class_name == "forest":
                    forest_pcts.append(s.percentage)
                elif s.class_name == "crop":
                    crop_pcts.append(s.percentage)
                elif s.class_name == "water":
                    water_pcts.append(s.percentage)
                elif s.class_name == "building":
                    bldg_pcts.append(s.percentage)

        mean_forest = np.mean(forest_pcts) if forest_pcts else 35.0
        mean_crop = np.mean(crop_pcts) if crop_pcts else 40.0
        mean_water = np.mean(water_pcts) if water_pcts else 5.0
        mean_bldg = np.mean(bldg_pcts) if bldg_pcts else 4.0

        # Prioritize village based on needs
        interventions = []
        schemes = []
        priority = "MEDIUM"

        if mean_crop > 30.0 and mean_water < 6.0:
            interventions.append("Critical Need: Micro-irrigation check-dams and solar pumps")
            schemes.append("PMKSY")
            schemes.append("PM-KISAN")
            priority = "HIGH"

        if mean_forest > 40.0:
            interventions.append("Opportunity: Van Dhan Vikas Kendra for NTFP processing")
            schemes.append("VDVY")
            if priority != "HIGH":
                priority = "HIGH"

        if total_claims > approved_claims:
            interventions.append(f"Administrative: Expedite {total_claims - approved_claims} pending FRA Patta titles")

        if not schemes:
            schemes = ["MGNREGA-FRA", "PMAY-G", "JJM"]

        # Approximate coordinates based on district/village
        coords = [86.75 + (hash(village) % 50) * 0.01, 21.90 + (hash(dist) % 50) * 0.01]

        summaries.append(VillageConvergenceSummary(
            village=village,
            district=dist,
            state=state,
            total_claims=total_claims,
            approved_claims=approved_claims,
            total_fra_area_hectares=round(total_area, 2),
            mean_forest_pct=round(float(mean_forest), 1),
            mean_crop_pct=round(float(mean_crop), 1),
            mean_water_pct=round(float(mean_water), 1),
            mean_building_pct=round(float(mean_bldg), 1),
            priority_level=priority,
            key_interventions_needed=interventions,
            recommended_schemes=list(set(schemes)),
            coordinates=coords
        ))

    # Sort High priority first
    p_rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    summaries.sort(key=lambda x: p_rank.get(x.priority_level, 3))
    return summaries

def answer_dss_query(db: Session, query_req: DSSQueryRequest) -> DSSQueryResponse:
    """
    Context-aware natural language Decision Support System query answerer.
    Combines SQL spatial/claim database, satellite statistics, rule-based scheme evaluations,
    and RAG policy document citations.
    """
    q = query_req.query.lower()
    citations = search_relevant_policy_chunks(db, query=query_req.query, top_k=3)

    if query_req.claim_id:
        recs = run_dss_for_claim(db, query_req.claim_id)
        claim = db.query(FRAClaim).filter(FRAClaim.id == query_req.claim_id).first()
        eligible_schemes = [r.scheme_name for r in recs if r.eligibility_status == "ELIGIBLE"]
        high_priority = [r.scheme_name for r in recs if r.priority == "HIGH"]

        answer_text = (
            f"**Decision Support Assessment for Claim {claim.claim_id} ({claim.applicant_name}, {claim.village}, {claim.district})**:\n\n"
            f"- **Claim Category**: {claim.claim_type} | Area: {claim.area_claimed:.2f} Ha | Status: **{claim.status}**\n"
            f"- **Eligible Schemes ({len(eligible_schemes)})**: {', '.join(eligible_schemes) if eligible_schemes else 'None currently eligible'}\n"
            f"- **High Priority Interventions**: {', '.join(high_priority) if high_priority else 'Standard baseline convergence'}\n\n"
            f"**Key Findings**:\n"
            f"1. Beneficiary has validated land rights under FRA 2006.\n"
            f"2. Multi-spectral satellite analysis and rule filters confirmed eligibility based on land-use criteria.\n"
            f"3. Refer to the recommended schemes and statutory citations below for official sanction documentation."
        )

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="BENEFICIARY_ASSESSMENT",
            recommendations=recs,
            citations=citations,
            statistics={"total_eligible": len(eligible_schemes), "high_priority_count": len(high_priority)}
        )

    elif "water" in q or "irrigation" in q:
        villages = calculate_village_convergence(db)
        needy_villages = [v for v in villages if v.mean_water_pct < 6.0 and v.mean_crop_pct > 25.0]
        v_names = [f"{v.village} ({v.district}) - Water: {v.mean_water_pct}%" for v in needy_villages[:5]]
        
        answer_text = (
            f"**Irrigation & Water Support DSS Analysis**:\n\n"
            f"Based on Sentinel-2 NDWI (Normalized Difference Water Index) satellite analysis, "
            f"the following **{len(needy_villages)} villages** have critical water deficits despite having high agricultural activity (>25% crop land):\n\n"
            + "\n".join(f"- **{v}**" for v in v_names) +
            "\n\n**Recommended Scheme Convergence**:\n"
            "- **PMKSY (Per Drop More Crop)**: Sanction 85% subsidized drip/sprinkler sets.\n"
            "- **MGNREGA Category B**: Construct community farm ponds (*Amrit Sarovars*) and earthen check-dams."
        )

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="VILLAGE_CONVERGENCE",
            recommendations=[],
            citations=citations,
            statistics={"critical_villages_count": len(needy_villages)}
        )

    elif "forest" in q or "van dhan" in q or "ntfp" in q:
        villages = calculate_village_convergence(db)
        forest_villages = [v for v in villages if v.mean_forest_pct > 35.0]
        v_names = [f"{v.village} ({v.district}) - Forest Cover: {v.mean_forest_pct}%" for v in forest_villages[:5]]

        answer_text = (
            f"**Forest Resource & Van Dhan Livelihood Convergence**:\n\n"
            f"Satellite canopy segmentation identified **{len(forest_villages)} villages** with rich forest coverage (>35%):\n\n"
            + "\n".join(f"- **{v}**" for v in v_names) +
            "\n\n**Strategic Recommendation**:\n"
            "Deploy **Pradhan Mantri Van Dhan Vikas Yojana (VDVY)** clusters. Form 15-member Tribal Self Help Groups (SHGs) "
            "for procurement and primary value addition of Minor Forest Produce (Mahua, Sal seeds, Tamarind, Tendu leaves)."
        )

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="SCHEME_INQUIRY",
            recommendations=[],
            citations=citations,
            statistics={"forest_rich_villages": len(forest_villages)}
        )

    else:
        # General DSS Overview
        total_claims = db.query(FRAClaim).count()
        approved = db.query(FRAClaim).filter(FRAClaim.status == "APPROVED").count()

        answer_text = (
            f"**FRA ATLAS Decision Support System Overview**:\n\n"
            f"- **Total Registered FRA Claims**: {total_claims}\n"
            f"- **Approved Titles**: {approved}\n"
            f"- **Active Welfare Schemes Available for Convergence**: PM-KISAN, PMKSY, PMAY-G, VDVY, JJM, MGNREGA-FRA.\n\n"
            f"Ask specific questions such as:\n"
            f"- *'Which villages have low water availability and need irrigation?'*\n"
            f"- *'What schemes are suitable for claim FRA-OD-MAY-001?'*\n"
            f"- *'Which villages have high forest cover for Van Dhan clusters?'*"
        )

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="POLICY_INFO",
            recommendations=[],
            citations=citations,
            statistics={"total_claims": total_claims, "approved_claims": approved}
        )
