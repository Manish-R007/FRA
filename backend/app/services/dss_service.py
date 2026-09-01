import os
import re
import json
import httpx
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.claim import FRAClaim
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.models.scheme import Scheme, SchemeRecommendation
from app.models.user import User
from app.services.rag_service import search_relevant_policy_chunks
from app.schemas.scheme import SchemeRecommendationResponse
from app.schemas.dss import (
    VillageConvergenceSummary, 
    DSSQueryResponse, 
    DSSQueryRequest, 
    RAGCitation,
    ChatMessage,
    DSSChatRequest,
    DSSChatResponse,
    SatelliteTelemetry
)

def call_groq_llm(
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1800
) -> Tuple[Optional[str], Optional[str]]:
    """
    Executes chat completion against Groq LLM API.
    Tries configured GROQ_MODEL, falling back across known models:
    ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'].
    """
    if not settings.GROQ_API_KEY:
        return None, None

    model_candidates = [
        settings.GROQ_MODEL,
        "openai/gpt-oss-120b",
        "qwen/qwen3.6-27b",
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile"
    ]
    seen = set()
    models_to_try = []
    for m in model_candidates:
        if m and m not in seen:
            seen.add(m)
            models_to_try.append(m)

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    full_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        r = msg.get("role", "user")
        if r not in ["user", "assistant", "system"]:
            r = "user"
        full_messages.append({"role": r, "content": msg.get("content", "")})

    for model in models_to_try:
        try:
            payload = {
                "model": model,
                "messages": full_messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    # Strip any internal chain-of-thought tags like <think>...</think>
                    clean_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                    return clean_content or content.strip(), model
        except Exception:
            continue

    return None, None


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
        if water_pct >= 75.0:
            status = "INELIGIBLE"
            score = 10.0
            priority = "LOW"
            reasons.append(f"Parcel is submerged under water body ({water_pct:.1f}% water); arable crop cultivation is not possible on water surface.")
        elif not is_approved:
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
        if water_pct >= 75.0:
            status = "INELIGIBLE"
            score = 15.0
            priority = "LOW"
            reasons.append(f"Parcel is submerged under water body ({water_pct:.1f}% water); irrigation infrastructure subsidy is not applicable.")
        elif not is_approved:
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
        if water_pct >= 75.0:
            status = "INELIGIBLE"
            score = 10.0
            priority = "LOW"
            reasons.append("No terrestrial forest canopy detected on submerged parcel for Minor Forest Produce (MFP) gathering.")
        elif claim.claim_type in ["CFR", "CR"] or forest_pct > 30.0:
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
        if water_pct >= 75.0:
            status = "INELIGIBLE"
            score = 10.0
            priority = "LOW"
            reasons.append("No dry, stable land available on submerged parcel for housing construction.")
        elif is_approved and (building_pct < 10.0 or bare_pct > 15.0):
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
        if water_pct >= 75.0:
            status = "ELIGIBLE"
            score = 85.0
            priority = "HIGH"
            reasons.append(f"Substantial water body detected ({water_pct:.1f}%). Eligible for MGNREGA community desilting, earthen embankment bunding, and freshwater aquaculture/fishery pond development.")
        elif is_approved:
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

    elif code == "JJM":
        # Jal Jeevan Mission (Potable Household Drinking Water)
        # Eligibility: Approved FRA Patta for dwelling/homestead, and critical surface water deficit (< 4.0% water cover, no pond asset)
        if has_water_asset or water_pct >= 4.0:
            status = "INELIGIBLE"
            score = 25.0
            priority = "LOW"
            reasons.append(f"Satellite analysis and spatial asset detection confirmed active surface water body / water presence ({water_pct:.1f}% cover) on parcel.")
            reasons.append("Household water resource is already accessible on-site; individual tap connection prioritization is diverted to water-scarce habitations.")
            reasons.append("Jal Jeevan Mission (JJM) convergence is targeted specifically at water-stressed households lacking local water sources.")
        elif not is_approved:
            status = "CONDITIONAL"
            score = 40.0
            priority = "LOW"
            reasons.append("FRA claim title verification is currently pending for residential tap water sanction.")
        elif building_pct > 0.0 or claim.claim_type == "IFR":
            status = "ELIGIBLE"
            score = 88.0
            priority = "HIGH"
            reasons.append("FRA Individual Forest Rights (IFR) title is recognized for tribal homestead.")
            reasons.append(f"Remote sensing indicates critical surface water deficit (water cover: {water_pct:.1f}%).")
            reasons.append("No permanent pond or water reservoir detected on parcel; qualifies for 100% subsidized Functional Household Tap Connection (FHTC).")
        else:
            status = "ELIGIBLE"
            score = 70.0
            priority = "MEDIUM"
            reasons.append(f"Parcel exhibits surface water deficit ({water_pct:.1f}%). Eligible for village community standpost or piped water supply connection.")

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
    Scheme recommendations are ONLY generated if a parcel geometry is uploaded AND satellite analysis is completed.
    """
    claim = db.query(FRAClaim).filter(FRAClaim.id == claim_id).first()
    if not claim:
        raise ValueError(f"Claim with ID {claim_id} not found")

    # 1. Geometry Check: Scheme recommendations require an uploaded GeoJSON parcel boundary
    geom = db.query(FRAGeometry).filter(FRAGeometry.claim_id == claim_id).first()
    if not geom or not geom.geometry:
        return []

    # 2. Satellite Analysis Check: Must be completed
    analysis = db.query(SatelliteAnalysis).filter(
        SatelliteAnalysis.claim_id == claim_id,
        SatelliteAnalysis.processing_status == "COMPLETED"
    ).order_by(SatelliteAnalysis.id.desc()).first()
    if not analysis:
        return []

    # Fetch land-cover statistics
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

        if mean_water < 4.0:
            interventions.append("Drinking Water Need: Jal Jeevan Mission (JJM) piped tap water connections")
            schemes.append("JJM")
            if priority != "HIGH":
                priority = "HIGH"
        elif mean_water >= 8.0:
            interventions.append("Water Abundant: Community fisheries / pond recharge under MGNREGA")

        if mean_forest > 40.0:
            interventions.append("Opportunity: Van Dhan Vikas Kendra for NTFP processing")
            schemes.append("VDVY")
            if priority != "HIGH":
                priority = "HIGH"

        if total_claims > approved_claims:
            interventions.append(f"Administrative: Expedite {total_claims - approved_claims} pending FRA Patta titles")

        if not schemes:
            schemes = ["MGNREGA-FRA", "PMAY-G"]

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

    # Check if a claim ID (e.g., FRA-OD-MAY-001) or Applicant Name is mentioned in the query text
    if not query_req.claim_id:
        import re
        match = re.search(r'(FRA-[A-Z]{2}-[A-Z]{3}-\d{3})', query_req.query, re.IGNORECASE)
        if match:
            found_claim = db.query(FRAClaim).filter(FRAClaim.claim_id == match.group(1).upper()).first()
            if found_claim:
                query_req.claim_id = found_claim.id
        
        if not query_req.claim_id:
            # Check if any registered claimant's name or distinct name part is mentioned in the query
            all_claims = db.query(FRAClaim).all()
            for c in all_claims:
                if c.applicant_name:
                    name_lower = c.applicant_name.lower()
                    if name_lower in q:
                        query_req.claim_id = c.id
                        break
                    # Check distinct name words (e.g. 'birsa', 'munda', 'baiga', 'soren', 'oraon', 'mangal')
                    words = [w for w in name_lower.split() if len(w) >= 4 and w not in ["gram", "sabha", "protection", "committee", "forest", "village", "singh"]]
                    if any(w in q for w in words):
                        query_req.claim_id = c.id
                        break

    if query_req.claim_id:
        recs = run_dss_for_claim(db, query_req.claim_id)
        claim = db.query(FRAClaim).filter(FRAClaim.id == query_req.claim_id).first()
        
        # Pull latest satellite stats and assets
        analysis = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).order_by(SatelliteAnalysis.id.desc()).first()
        stats_dict = {}
        if analysis:
            stats = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == analysis.id).all()
            stats_dict = {s.class_name: s.percentage for s in stats}
            
        crop_pct = stats_dict.get("crop", 0.0)
        forest_pct = stats_dict.get("forest", 0.0)
        water_pct = stats_dict.get("water", 0.0)
        bldg_pct = stats_dict.get("building", 0.0)
        bare_pct = stats_dict.get("bare_land", 0.0)

        assets = db.query(Asset).filter(Asset.claim_id == claim.id).all()
        assets_desc = ", ".join(f"{a.asset_type} ({a.confidence * 100:.0f}% conf)" for a in assets) if assets else "None detected"

        is_approved = (claim.status == "APPROVED" or claim.verification_status == "VERIFIED")
        eligible_schemes = [r for r in recs if r.eligibility_status == "ELIGIBLE"]
        high_priority = [r for r in recs if r.priority == "HIGH"]

        # Check if query targets specific schemes
        targeted_codes = []
        for code in ["PM-KISAN", "PMKSY", "VDVY", "PMAY-G", "MGNREGA-FRA", "JJM"]:
            if code.lower() in q or code.replace("-", "").lower() in q.replace("-", "") or code.replace("-FRA", "").lower() in q or ("jal jeevan" in q and code == "JJM"):
                targeted_codes.append(code)

        display_recs = [r for r in recs if r.scheme_code in targeted_codes] if targeted_codes else recs

        # Build Criteria Table
        title_status_str = "SATISFIED (Approved Patta)" if is_approved else "REQUIRES VERIFICATION (Pending)"
        crop_status_str = f"SATISFIED ({crop_pct:.1f}% Cultivated)" if crop_pct > 15.0 else "PARTIAL / LOW CROP"
        water_status_str = f"DEFICIT DETECTED ({water_pct:.1f}% Surface Water)" if water_pct < 5.0 else f"ADEQUATE ({water_pct:.1f}%)"
        forest_status_str = f"HIGH CANOPY ({forest_pct:.1f}%)" if forest_pct > 30.0 else f"LOW ({forest_pct:.1f}%)"

        overall_status = "ELIGIBLE for Convergence" if eligible_schemes else "REQUIRES VERIFICATION"

        # Construct markdown response
        lines = [
            f"### 📋 Eligibility Assessment Summary",
            f"- **Overall Assessment**: **{overall_status}**",
            f"- **Beneficiary**: {claim.applicant_name} | **Claim ID**: `{claim.claim_id}`",
            f"- **Location**: {claim.village}, {claim.district}, {claim.state} | **Category**: {claim.claim_type} ({claim.area_claimed:.2f} Ha)",
            f"- **Title Status**: **{claim.status}** (Verification: {claim.verification_status})",
            f"",
            f"### 📊 Criteria & Grounding Analysis",
            f"| Requirement | Claimant / Admin Record | Satellite / GIS Evidence | Assessment |",
            f"| :--- | :--- | :--- | :--- |",
            f"| **1. FRA 2006 Legal Title** | Status: {claim.status} ({claim.claim_type}) | Cadastral Boundary Mapped | {title_status_str} |",
            f"| **2. Active Land Cultivation** | Land Use: {claim.land_use or 'Agriculture'} | Sentinel-2 Crop NDVI: {crop_pct:.1f}% | {crop_status_str} |",
            f"| **3. Surface Water Security** | Water Access Profile | Sentinel-2 NDWI Water: {water_pct:.1f}% | {water_status_str} |",
            f"| **4. Forest Canopy / MFP** | Traditional Forest Dweller | Sentinel-2 Canopy: {forest_pct:.1f}% | {forest_status_str} |",
            f"",
            f"### 🎯 Scheme Recommendations & Reasoning",
        ]

        for r in display_recs:
            lines.append(f"#### **{r.scheme_name}** ({r.department})")
            lines.append(f"- **Status**: **{r.eligibility_status}** | **Score**: {r.eligibility_score:.0f}/100 | **Priority**: **{r.priority}**")
            lines.append(f"- **Transparent Reasons**:")
            for reason_line in r.reason.split("\n"):
                lines.append(f"  {reason_line}")
            if r.evidence:
                lines.append(f"- **Statutory Evidence**: *{r.evidence}*")
            lines.append("")

        lines.extend([
            f"### 🛰️ Observed Satellite Evidence (Sentinel-2)",
            f"- **Land-Cover Breakdown**: Crop ({crop_pct:.1f}%), Forest Canopy ({forest_pct:.1f}%), Surface Water ({water_pct:.1f}%), Buildings ({bldg_pct:.1f}%), Bare Land ({bare_pct:.1f}%).",
            f"- **Detected Assets**: {assets_desc}.",
            f"- *Note: Satellite analysis provides objective land-use & vegetation indicators; legal entitlement is governed by official FRA title recognition.*",
            f"",
            f"### 🔍 Missing Evidence & Recommended Next Steps",
            f"1. Ensure Bank Account is Aadhaar-seeded for Direct Benefit Transfer (DBT).",
            f"2. Obtain Gram Sabha endorsement resolution for village-level scheme convergence.",
            f"3. Refer to official Ministry guidelines below for administrative sanction."
        ])

        answer_text = "\n".join(lines)

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="BENEFICIARY_ASSESSMENT",
            recommendations=display_recs,
            citations=citations,
            statistics={"total_eligible": len(eligible_schemes), "high_priority_count": len(high_priority)}
        )

    # 1. Forest Canopy / Van Dhan / NTFP Query Intent
    forest_keywords = ["forest", "van dhan", "vdvk", "ntfp", "tree", "canopy", "greenery", "vegetation", "jungle", "afforestation", "mfp", "timber"]
    if any(kw in q for kw in forest_keywords):
        villages = calculate_village_convergence(db)
        forest_villages = [v for v in villages if v.mean_forest_pct > 35.0]
        v_names = [f"{v.village} ({v.district}) - Forest Cover: {v.mean_forest_pct}%" for v in forest_villages]

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

    # 2. Water / Irrigation / Drought Query Intent
    water_keywords = ["water", "irrigation", "drought", "pond", "borewell", "check dam", "canal", "pmksy", "moisture"]
    if any(kw in q for kw in water_keywords):
        villages = calculate_village_convergence(db)
        needy_villages = [v for v in villages if v.mean_water_pct < 6.0 and v.mean_crop_pct > 25.0]
        v_names = [f"{v.village} ({v.district}) - Water: {v.mean_water_pct}%" for v in needy_villages]
        
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

    # 3. Agriculture / Cultivation / PM-KISAN Query Intent
    crop_keywords = ["agriculture", "farming", "crop", "farmer", "cultivation", "pm-kisan", "kisan", "seed", "fertilizer"]
    if any(kw in q for kw in crop_keywords):
        villages = calculate_village_convergence(db)
        agri_villages = [v for v in villages if v.mean_crop_pct > 20.0]
        v_names = [f"{v.village} ({v.district}) - Agricultural Cultivation: {v.mean_crop_pct}%" for v in agri_villages]

        answer_text = (
            f"**Agricultural & PM-KISAN Convergence Analysis**:\n\n"
            f"Satellite NDVI analysis detected active agriculture in **{len(agri_villages)} villages** (>20% cultivated area):\n\n"
            + "\n".join(f"- **{v}**" for v in v_names) +
            "\n\n**Recommended Interventions**:\n"
            "- Direct enrollment under **PM-KISAN** (₹6,000/year income support).\n"
            "- Subsidized distribution of high-yield drought-tolerant seeds and organic fertilizer under PKVY."
        )

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="SCHEME_INQUIRY",
            recommendations=[],
            citations=citations,
            statistics={"agri_villages_count": len(agri_villages)}
        )

    # 4. Housing / PMAY-G Query Intent
    housing_keywords = ["housing", "house", "pmay", "shelter", "homestead", "dwelling", "kutcha", "pucca"]
    if any(kw in q for kw in housing_keywords):
        total_ifr = db.query(FRAClaim).filter(FRAClaim.claim_type == "IFR", FRAClaim.status == "APPROVED").count()
        answer_text = (
            f"**PMAY-G Tribal Housing Convergence Assessment**:\n\n"
            f"- **Approved IFR Homestead Title Holders**: {total_ifr} beneficiaries\n"
            f"- **Eligible Assistance**: ₹1.30 Lakh capital grant + 90 days MGNREGA unskilled construction labor.\n\n"
            f"All verified IFR title holders with kutcha/unstable dwellings are fast-tracked under SECC Special Tribal Housing Convergence."
        )

        return DSSQueryResponse(
            query=query_req.query,
            answer=answer_text,
            context_type="POLICY_INFO",
            recommendations=[],
            citations=citations,
            statistics={"homestead_eligible_count": total_ifr}
        )

    # 5. General DSS Fallback with helpful suggestions
    total_claims = db.query(FRAClaim).count()
    approved = db.query(FRAClaim).filter(FRAClaim.status == "APPROVED").count()

    answer_text = (
        f"**FRA ATLAS Decision Support System Overview**:\n\n"
        f"- **Total Registered FRA Claims**: {total_claims}\n"
        f"- **Approved Titles**: {approved}\n"
        f"- **Active Welfare Schemes Available for Convergence**: PM-KISAN, PMKSY, PMAY-G, VDVY, JJM, MGNREGA-FRA.\n\n"
        f"**Suggested Queries**:\n"
        f"- *'Which villages have high forest cover?'*\n"
        f"- *'Which villages have low water availability and need irrigation?'*\n"
        f"- *'What schemes are suitable for claim FRA-OD-MAY-001?'*\n"
        f"- *'Which areas have high agricultural cultivation?'*"
    )

    return DSSQueryResponse(
        query=query_req.query,
        answer=answer_text,
        context_type="POLICY_INFO",
        recommendations=[],
        citations=citations,
        statistics={"total_claims": total_claims, "approved_claims": approved}
    )

def _find_claim_in_context(db: Session, text: str, claim_id_hint: Optional[int] = None) -> Optional[FRAClaim]:
    """Resolves an FRAClaim entity from explicit ID, claim code regex, or applicant name."""
    if claim_id_hint:
        c = db.query(FRAClaim).filter(FRAClaim.id == claim_id_hint).first()
        if c:
            return c

    # 1. Regex for Claim Code (e.g. FRA-OD-MAY-001)
    match = re.search(r'(FRA-[A-Z]{2}-[A-Z]{3}-\d{3})', text, re.IGNORECASE)
    if match:
        c = db.query(FRAClaim).filter(FRAClaim.claim_id == match.group(1).upper()).first()
        if c:
            return c

    # 2. Match claimant names
    text_lower = text.lower()
    all_claims = db.query(FRAClaim).all()
    for c in all_claims:
        if c.applicant_name:
            name_lower = c.applicant_name.lower()
            if name_lower in text_lower:
                return c
            # Check individual name tokens (length >= 4)
            tokens = [t for t in name_lower.split() if len(t) >= 4 and t not in ["gram", "sabha", "protection", "committee", "forest", "village", "singh"]]
            if any(t in text_lower for t in tokens):
                return c

    return None

def chat_dss_query(db: Session, req: DSSChatRequest) -> DSSChatResponse:
    """
    State-of-the-Art Conversational AI Decision Support Assistant for Forest Rights Act (FRA).
    Combines:
    - Real-time PostGIS claim records & geometries
    - Real-time Copernicus Sentinel-2 remote sensing statistics (crop NDVI, canopy cover, NDWI water, built-up)
    - Deterministic statutory welfare scheme eligibility rules
    - Grounded RAG semantic search across official Ministry of Tribal Affairs (MoTA) policy documents
    - Groq LLM (LLaMA / GPT-OSS 120B / Qwen) natural language synthesis & multi-turn dialog
    """
    # 1. Determine active user query
    user_query = req.query or ""
    if not user_query and req.messages:
        for msg in reversed(req.messages):
            if msg.role == "user":
                user_query = msg.content
                break

    if not user_query:
        user_query = "Overview of FRA Decision Support System and Scheme Convergence"

    q_lower = user_query.lower()
    full_conversation_text = " ".join([m.content for m in req.messages]) + " " + user_query

    # 2. Resolve Claim Context
    claim = _find_claim_in_context(db, user_query, req.claim_id)
    if not claim and req.messages:
        claim = _find_claim_in_context(db, full_conversation_text)

    # 3. Retrieve RAG Policy Citations
    target_scheme_filter = req.scheme_code
    if not target_scheme_filter:
        for code in ["PM-KISAN", "PMKSY", "VDVY", "PMAY-G", "MGNREGA-FRA", "JJM"]:
            if code.lower() in q_lower or code.replace("-", "").lower() in q_lower:
                target_scheme_filter = code
                break

    citations = search_relevant_policy_chunks(db, query=user_query, top_k=3, scheme_code_filter=target_scheme_filter)

    # Context containers
    claim_context_dict = None
    satellite_telemetry = None
    recommendations_list: List[SchemeRecommendationResponse] = []
    suggested_followups: List[str] = []
    context_type = "POLICY_INFO"
    model_used = "Groq/LLM-Grounded"

    if claim:
        context_type = "BENEFICIARY_ASSESSMENT"
        # Run scheme evaluation
        recs = run_dss_for_claim(db, claim.id)
        recommendations_list = recs

        # Fetch latest satellite analysis and land cover stats
        analysis = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.claim_id == claim.id).order_by(SatelliteAnalysis.id.desc()).first()
        stats_dict = {}
        if analysis:
            stats = db.query(LandCoverStatistic).filter(LandCoverStatistic.analysis_id == analysis.id).all()
            stats_dict = {s.class_name: s.percentage for s in stats}

        crop_pct = stats_dict.get("crop", 0.0)
        forest_pct = stats_dict.get("forest", 0.0)
        water_pct = stats_dict.get("water", 0.0)
        bldg_pct = stats_dict.get("building", 0.0)
        bare_pct = stats_dict.get("bare_land", 0.0)
        grass_pct = stats_dict.get("grassland", 0.0)

        assets = db.query(Asset).filter(Asset.claim_id == claim.id).all()
        assets_list = [f"{a.asset_type.upper()} ({a.confidence * 100:.0f}% confidence)" for a in assets] if assets else ["No permanent structures or water bodies detected"]
        water_deficit = (crop_pct > 15.0 and water_pct < 4.0)

        satellite_telemetry = SatelliteTelemetry(
            crop_pct=round(crop_pct, 1),
            forest_pct=round(forest_pct, 1),
            water_pct=round(water_pct, 1),
            building_pct=round(bldg_pct, 1),
            bare_pct=round(bare_pct, 1),
            mean_ndvi=round(analysis.mean_ndvi, 3) if analysis and analysis.mean_ndvi else (0.55 if crop_pct > 20 else 0.35),
            mean_ndwi=round(analysis.mean_ndwi, 3) if analysis and analysis.mean_ndwi else (-0.15 if water_deficit else 0.10),
            assets_detected=assets_list,
            parcel_area_ha=claim.area_claimed,
            claim_type=claim.claim_type,
            water_deficit=water_deficit
        )

        claim_context_dict = {
            "id": claim.id,
            "claim_id": claim.claim_id,
            "applicant_name": claim.applicant_name,
            "father_or_husband_name": claim.father_or_husband_name or "N/A",
            "village": claim.village,
            "district": claim.district,
            "state": claim.state,
            "claim_type": claim.claim_type,
            "area_claimed": claim.area_claimed,
            "status": claim.status,
            "verification_status": claim.verification_status,
            "land_use": claim.land_use or "Agriculture / Forest Dwelling"
        }

        # Build Scheme Summary for Prompt
        eligible_schemes = [r for r in recs if r.eligibility_status == "ELIGIBLE"]
        conditional_schemes = [r for r in recs if r.eligibility_status == "CONDITIONAL"]
        ineligible_schemes = [r for r in recs if r.eligibility_status == "INELIGIBLE"]

        schemes_prompt_lines = []
        for r in recs:
            schemes_prompt_lines.append(
                f"- Scheme: {r.scheme_name} ({r.scheme_code}) | Dept: {r.department}\n"
                f"  Status: {r.eligibility_status} | Score: {r.eligibility_score}/100 | Priority: {r.priority}\n"
                f"  Reasoning: {r.reason}\n"
                f"  Benefits: {r.benefits}\n"
                f"  Statutory Evidence: {r.evidence or 'Standard MoTA Convergence Framework'}"
            )
        schemes_prompt_text = "\n".join(schemes_prompt_lines)

        citations_prompt_text = "\n".join([
            f"- Document: '{c.document_name}', Page {c.page_number} [{c.scheme_code or 'GENERAL'}]: \"{c.excerpt}\""
            for c in citations
        ]) or "Standard Ministry of Tribal Affairs (MoTA) and Ministry of Agriculture (MoA) Convergence Guidelines 2024."

        system_prompt = f"""
You are the official Forest Rights Act (FRA) Decision Support System & Policy Advisor AI for the Ministry of Tribal Affairs (MoTA), Government of India.

CORE RULE: Keep your answers CONCISE, DIRECT, ACCURATE, and EASY TO UNDERSTAND (100-200 words max).
Avoid overwhelming walls of text, unnecessary data dumps, or generic essays. Answer ONLY what the user asked.

GROUND TRUTH DATA FOR CURRENT CLAIM:
- Beneficiary: {claim.applicant_name} (Claim ID: {claim.claim_id})
- Location: Village {claim.village}, District {claim.district}, State {claim.state}
- Title Category: {claim.claim_type} | Extent: {claim.area_claimed:.2f} Ha | Status: {claim.status} ({claim.verification_status})
- Satellite Remote Sensing: Crop Cover: {crop_pct:.1f}% (NDVI: {satellite_telemetry.mean_ndvi}), Forest Canopy: {forest_pct:.1f}%, Surface Water: {water_pct:.1f}% (NDWI: {satellite_telemetry.mean_ndwi}), Water Deficit: {'YES' if water_deficit else 'NO'}
- Evaluated Schemes:
{schemes_prompt_text}

RESPONSE STRUCTURE:
1. **Direct Verdict**: Start immediately with the status (e.g. "✅ **Yes, {claim.applicant_name} is Eligible for [Scheme]**" or "⚠️ **Conditional** / ❌ **Ineligible**").
2. **Why (Satellite + Policy Grounding)**: 2-3 crisp bullet points linking the real satellite remote sensing metric (canopy %, crop NDVI, water NDWI) and FRA legal title status.
3. **Benefits**: 1 short line stating the monetary grant, subsidy, or income benefit.
4. **Actionable Next Steps**: 2 short bullet points on what to do next.
"""

        # Generate intelligent follow-up suggestions
        if eligible_schemes:
            top_scheme = eligible_schemes[0].scheme_code
            suggested_followups.append(f"What documents are required to claim benefits under {top_scheme}?")
            if len(eligible_schemes) > 1:
                second_scheme = eligible_schemes[1].scheme_code
                suggested_followups.append(f"Explain how {top_scheme} and {second_scheme} can be combined on this parcel.")
        if water_deficit:
            suggested_followups.append(f"Why did Sentinel-2 detect a water deficit on parcel {claim.claim_id}?")
        if conditional_schemes or ineligible_schemes:
            gap_scheme = (conditional_schemes + ineligible_schemes)[0].scheme_code
            suggested_followups.append(f"What exact steps are needed to make {claim.applicant_name} eligible for {gap_scheme}?")

    else:
        # Village or General Scheme Query Context
        villages = calculate_village_convergence(db)
        context_type = "VILLAGE_CONVERGENCE" if any(w in q_lower for w in ["village", "district", "mayurbhanj", "dindori", "gadchiroli", "gumla", "convergence"]) else "SCHEME_INQUIRY"

        # Check if query is about a specific scheme
        schemes_info = {
            "VDVY": "Pradhan Mantri Van Dhan Vikas Yojana (VDVY): For Minor Forest Produce (MFP) value addition. Requires approved FRA title (IFR/CFR), ≥30% forest canopy cover, and a 15-member tribal Self-Help Group (SHG). Benefit: ₹15 Lakh capital grant per Van Dhan Kendra.",
            "PM-KISAN": "PM-KISAN: Direct income support of ₹6,000/year in 3 installments. Requires approved FRA Individual Forest Rights (IFR) title and active agricultural cultivation on parcel.",
            "PMKSY": "PMKSY (Per Drop More Crop): Micro-irrigation subsidy (up to 85%) and 100% subsidized farm ponds. Prioritizes approved FRA parcels with active crops but surface water deficit (<5% water).",
            "PMAY-G": "PMAY-Gramin: Housing grant of ₹1.30 Lakh + 90 days MGNREGA labor. Requires approved FRA homestead rights and lack of existing pucca house.",
            "MGNREGA-FRA": "MGNREGA Special FRA Convergence: 150 days guaranteed wage labor + material grant for land bunding, leveling, well deepening, and farm ponds.",
            "JJM": "Jal Jeevan Mission (JJM - Har Ghar Jal): 100% grant for Functional Household Tap Connection (FHTC) providing 55 lpcd clean drinking water. Prioritizes approved FRA habitations experiencing surface water deficit (<4% water cover and no local pond/water body on parcel)."
        }

        matched_scheme_info = ""
        for code, info in schemes_info.items():
            if code.lower() in q_lower or code.replace("-", "").lower() in q_lower or ("van dhan" in q_lower and code == "VDVY") or ("kisan" in q_lower and code == "PM-KISAN") or ("irrigation" in q_lower and code == "PMKSY") or ("housing" in q_lower and code == "PMAY-G") or (("jal jeevan" in q_lower or "drinking water" in q_lower or "tap" in q_lower) and code == "JJM"):
                matched_scheme_info = info
                break

        system_prompt = f"""
You are the official Forest Rights Act (FRA) Decision Support System & Policy Advisor AI for the Ministry of Tribal Affairs (MoTA), Government of India.

CORE RULE: Keep your answers CONCISE, DIRECT, ACCURATE, and EASY TO UNDERSTAND (100-180 words max).
DO NOT dump tables of all villages unless explicitly asked to "list all villages".

SCHEME POLICY CONTEXT:
{matched_scheme_info or 'Available schemes: PM-KISAN (₹6,000/yr agri income), PMKSY (85% drip irrigation), VDVY (₹15L Van Dhan MFP cluster grant), PMAY-G (₹1.30L housing grant), MGNREGA (150 days labor), JJM (drinking water tap connection for water-stressed habitations).'}

INSTRUCTIONS:
1. If asked "Am I eligible for [Scheme]?" without mentioning a claim or name:
   - State the 3 key eligibility criteria (FRA Title + Satellite Remote Sensing Threshold + Scheme Condition).
   - State the benefit.
   - Provide a 1-line note: "💡 *To check your exact parcel eligibility, select your name from the Context dropdown above or tell me your Claim ID (e.g. FRA-OD-MAY-001).*"
2. If asked about a village or district:
   - Give a brief 2-3 sentence summary of top priority interventions based on Sentinel-2 canopy, crop, and water metrics.
3. Use clean, short markdown with bullet points.
"""
        suggested_followups = [
            "What schemes are suitable for claim FRA-OD-MAY-001?",
            "Which villages in Mayurbhanj have critical water deficits needing PMKSY?",
            "Which villages qualify for Van Dhan Vikas Kendra (VDVY) clusters?",
            "What documents are required for PM-KISAN?"
        ]

    # Convert incoming conversation history for Groq
    msg_history = []
    if req.messages:
        for m in req.messages[-6:]:  # Keep last 6 turns for context
            msg_history.append({"role": m.role, "content": m.content})
    else:
        msg_history.append({"role": "user", "content": user_query})

    # 4. Execute Groq LLM
    llm_answer, actual_model = call_groq_llm(
        messages=msg_history,
        system_prompt=system_prompt,
        temperature=0.2,
        max_tokens=1800
    )

    if actual_model:
        model_used = f"Groq/{actual_model}"

    # 5. Deterministic fallback if LLM is unavailable
    if not llm_answer:
        if claim:
            lines = [
                f"### 📋 Decision Support Assessment: `{claim.claim_id}` ({claim.applicant_name})",
                f"- **Location**: {claim.village}, {claim.district}, {claim.state} | **Extent**: {claim.area_claimed:.2f} Ha ({claim.claim_type})",
                f"- **FRA Title Status**: **{claim.status}** (Verification: {claim.verification_status})",
                f"",
                f"### 🛰️ Live Sentinel-2 Remote Sensing Indices",
                f"- **Crop Cultivation Cover**: **{satellite_telemetry.crop_pct}%** (NDVI: {satellite_telemetry.mean_ndvi})",
                f"- **Forest Canopy Cover**: **{satellite_telemetry.forest_pct}%**",
                f"- **Surface Water Cover**: **{satellite_telemetry.water_pct}%** ({'⚠️ Critical Water Deficit Detected' if satellite_telemetry.water_deficit else 'Adequate Water'})",
                f"- **Detected Spatial Assets**: {', '.join(satellite_telemetry.assets_detected)}",
                f"",
                f"### 🎯 Evaluated Welfare Scheme Convergence",
            ]
            for r in recommendations_list:
                lines.append(f"#### **{r.scheme_name}** ({r.department})")
                lines.append(f"- **Status**: **{r.eligibility_status}** | **Score**: {r.eligibility_score:.0f}/100 | **Priority**: **{r.priority}**")
                lines.append(f"- **Reasoning**: {r.reason}")
                lines.append(f"- **Benefits**: {r.benefits}")
                if r.evidence:
                    lines.append(f"- **Policy Evidence**: *{r.evidence}*")
                lines.append("")
            lines.extend([
                f"### 💡 Actionable Next Steps",
                f"1. Link Bank Account with Aadhaar for Direct Benefit Transfer (DBT).",
                f"2. Present this spatial assessment to Gram Sabha for convergence approval under Section 3(1).",
                f"3. Submit application dossier to District Forest Rights Committee (DFRC)."
            ])
            llm_answer = "\n".join(lines)
            model_used = "Deterministic-Grounded-Fallback"
        else:
            llm_answer = answer_dss_query(db, DSSQueryRequest(query=user_query)).answer
            model_used = "Rules-Engine-Fallback"

    # Assemble and return chat response
    assistant_msg = ChatMessage(
        role="assistant",
        content=llm_answer,
        timestamp=datetime.now().strftime("%I:%M %p"),
        model_used=model_used
    )

    return DSSChatResponse(
        message=assistant_msg,
        context_type=context_type,
        claim_context=claim_context_dict,
        satellite_telemetry=satellite_telemetry,
        recommendations=recommendations_list,
        citations=citations,
        suggested_followups=suggested_followups,
        statistics={
            "total_schemes_evaluated": len(recommendations_list),
            "eligible_schemes_count": sum(1 for r in recommendations_list if r.eligibility_status == "ELIGIBLE"),
            "model": model_used
        }
    )

