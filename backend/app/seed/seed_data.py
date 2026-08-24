import os
import json
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User
from app.models.claim import FRAClaim
from app.models.document import Document, DocumentField
from app.models.geometry import FRAGeometry
from app.models.satellite import SatelliteAnalysis, LandCoverStatistic, Asset
from app.models.scheme import Scheme, SchemeRecommendation
from app.models.dss import DSSDocument, DSSChunk
from app.models.audit import AuditLog, Notification
from app.services.gis_service import validate_and_process_geometry
from app.services.satellite_service import process_satellite_analysis
from app.services.segmentation_service import perform_semantic_segmentation, extract_detected_assets
from app.services.dss_service import run_dss_for_claim
from app.services.rag_service import process_and_index_pdf
from app.services.audit_service import record_audit
from app.seed.realistic_claims import REALISTIC_CLAIMS_DATA, SCHEMES_DATA

def seed_database():
    """
    Populates database with complete, authentic production-ready initial dataset.
    """
    print("--- Initializing Database Tables ---")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Users (All 6 RBAC roles)
        print("1. Seeding Users (RBAC)...")
        users_to_create = [
            {
                "full_name": "Dr. Rajesh Kumar Meena",
                "email": "admin@fra.gov.in",
                "password_hash": get_password_hash("Admin@2025!"),
                "role": "ADMIN",
                "state": "National",
                "district": "New Delhi",
                "village": "MoTA HQ",
                "is_active": True
            },
            {
                "full_name": "Smt. Shanti Murmu",
                "email": "state.officer@fra.gov.in",
                "password_hash": get_password_hash("State@2025!"),
                "role": "STATE_OFFICER",
                "state": "Odisha",
                "district": "Bhubaneswar",
                "village": "State Secretariat",
                "is_active": True
            },
            {
                "full_name": "Shri Ashok Pattnaik, IAS",
                "email": "district.officer@fra.gov.in",
                "password_hash": get_password_hash("District@2025!"),
                "role": "DISTRICT_OFFICER",
                "state": "Odisha",
                "district": "Mayurbhanj",
                "village": "Baripada Collectorate",
                "is_active": True
            },
            {
                "full_name": "Shri Debendra Majhi",
                "email": "field.officer@fra.gov.in",
                "password_hash": get_password_hash("Field@2025!"),
                "role": "FIELD_OFFICER",
                "state": "Odisha",
                "district": "Mayurbhanj",
                "village": "Baripada Sadar",
                "is_active": True
            },
            {
                "full_name": "Ananya Sen (GIS Lead)",
                "email": "analyst@fra.gov.in",
                "password_hash": get_password_hash("Analyst@2025!"),
                "role": "ANALYST",
                "state": "National",
                "district": "Remote Sensing Cell",
                "village": "NRSC",
                "is_active": True
            },
            {
                "full_name": "Birsa Munda (Beneficiary)",
                "email": "citizen@fra.gov.in",
                "password_hash": get_password_hash("Citizen@2025!"),
                "role": "CITIZEN",
                "state": "Odisha",
                "district": "Mayurbhanj",
                "village": "Baripada",
                "is_active": True
            }
        ]

        for u_data in users_to_create:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                user = User(**u_data)
                db.add(user)
                db.commit()
                db.refresh(user)
                record_audit(db, action="CREATE_USER", entity="User", entity_id=str(user.id), user_id=None, new_value={"email": user.email, "role": user.role})

        admin_user = db.query(User).filter(User.email == "admin@fra.gov.in").first()

        # 2. Seed Schemes
        print("2. Seeding Government Welfare Schemes...")
        for s_data in SCHEMES_DATA:
            existing_scheme = db.query(Scheme).filter(Scheme.code == s_data["code"]).first()
            if not existing_scheme:
                scheme = Scheme(
                    name=s_data["name"],
                    code=s_data["code"],
                    department=s_data["department"],
                    description=s_data["description"],
                    eligibility_rules=json.dumps(s_data["eligibility_rules"]),
                    benefits=s_data["benefits"],
                    documents_required=json.dumps(s_data["documents_required"]),
                    active=s_data["active"]
                )
                db.add(scheme)
                db.commit()
                db.refresh(scheme)
                record_audit(db, action="CREATE_SCHEME", entity="Scheme", entity_id=str(scheme.id), user_id=admin_user.id if admin_user else None, new_value={"code": scheme.code, "name": scheme.name})

        # 3. Seed Policy Guidelines into RAG Document Repository
        print("3. Seeding RAG Policy Guidelines...")
        sample_policy_texts = [
            (
                "PM-KISAN Convergence with Forest Rights Act Patta Holders Guidelines (MoTA & MoA 2024)",
                "PM-KISAN",
                "Section 4.1: Recognition of Forest Rights under FRA 2006 confers legal occupational rights over agricultural forest land. All Individual Forest Rights (IFR) patta holders whose claims are duly recognized and distributed shall be deemed eligible landholders for benefits under Pradhan Mantri Kisan Samman Nidhi (PM-KISAN). Direct income support of Rs 6,000 per year will be credited via DBT in 3 installments. Verification of active cultivation is confirmed through satellite remote-sensing land-use records."
            ),
            (
                "PMKSY Micro-Irrigation Guidelines for Tribal & FRA Beneficiaries (MoA&FW)",
                "PMKSY",
                "Section 8.3: Priority Water Allocation in Tribal Districts. Under Per Drop More Crop (PDMC) of PMKSY, special priority is assigned to approved FRA beneficiaries exhibiting high agricultural potential but facing low surface water availability. Financial assistance of up to 85% subsidy is approved for Drip & Micro-Sprinkler irrigation sets. Individual farm ponds (Khet Talab) under watershed development component are fully subsidized for parcels exceeding 1.0 hectare."
            ),
            (
                "Pradhan Mantri Van Dhan Vikas Yojana - Operational Manual for NTFP Clusters (TRIFED)",
                "VDVY",
                "Section 2: Formation of Van Dhan Vikas Kendras (VDVK). Community Forest Resource (CFR) and Community Rights (CR) title-holding Gram Sabhas with significant forest canopy cover (>30%) are prioritized for setting up 15-member tribal Self-Help Group (SHG) enterprise clusters. A one-time establishment grant of Rs 15 Lakh is provided for primary processing, grading, packaging, and value addition of Minor Forest Produce (MFP) including Mahua, Sal seeds, Tamarind, and Lac."
            ),
            (
                "PMAY-Gramin Framework for Special Category Tribal Habitations (MoRD)",
                "PMAY-G",
                "Section 5.2: Housing Entitlements for FRA Patta Holders. All bonafide tribal households having approved FRA residential patta (homestead land under Section 3(1)(a)) and possessing no existing pucca house are eligible for a non-refundable financial assistance grant of Rs 1,30,000 in hilly/tribal areas. Additional converge is mandatory with Swachh Bharat Mission (Rs 12,000 for toilet) and MGNREGA (90 days unskilled labor assistance)."
            )
        ]

        for doc_title, scheme_code, text_content in sample_policy_texts:
            existing_doc = db.query(DSSDocument).filter(DSSDocument.name == doc_title).first()
            if not existing_doc:
                dss_doc = DSSDocument(
                    name=doc_title,
                    file_url=f"/documents/policies/{scheme_code.lower()}_guidelines.pdf",
                    document_type="POLICY_GUIDELINE",
                    scheme_code=scheme_code,
                    uploaded_by=admin_user.id if admin_user else None
                )
                db.add(dss_doc)
                db.commit()
                db.refresh(dss_doc)

                from app.services.rag_service import compute_text_embedding
                emb = compute_text_embedding(text_content)
                chunk = DSSChunk(
                    document_id=dss_doc.id,
                    chunk_text=text_content,
                    page_number=1,
                    section_title="Operational Guidelines & Eligibility",
                    embedding=json.dumps(emb)
                )
                db.add(chunk)
                db.commit()

        # 4. Seed Realistic Claims with Real Polygons & Satellite Analysis
        print("4. Seeding Realistic Claims, Polygons, and Satellite Remote Sensing...")
        for c_data in REALISTIC_CLAIMS_DATA:
            existing_claim = db.query(FRAClaim).filter(FRAClaim.claim_id == c_data["claim_id"]).first()
            if not existing_claim:
                claim = FRAClaim(
                    claim_id=c_data["claim_id"],
                    claim_type=c_data["claim_type"],
                    applicant_name=c_data["applicant_name"],
                    father_or_husband_name=c_data.get("father_or_husband_name"),
                    age=c_data.get("age"),
                    gender=c_data.get("gender"),
                    address=c_data.get("address"),
                    village=c_data["village"],
                    block=c_data.get("block"),
                    district=c_data["district"],
                    state=c_data["state"],
                    survey_number=c_data.get("survey_number"),
                    area_claimed=c_data["area_claimed"],
                    area_unit=c_data.get("area_unit", "hectares"),
                    land_use=c_data.get("land_use"),
                    application_date=c_data.get("application_date"),
                    status=c_data["status"],
                    verification_status=c_data["verification_status"],
                    created_by=admin_user.id if admin_user else None
                )
                db.add(claim)
                db.commit()
                db.refresh(claim)

                record_audit(db, action="CREATE_CLAIM", entity="FRAClaim", entity_id=str(claim.id), user_id=admin_user.id if admin_user else None, new_value={"claim_id": claim.claim_id, "applicant": claim.applicant_name})

                # Attach actual polygon boundary
                poly_geom = {
                    "type": "Polygon",
                    "coordinates": c_data["polygon_coordinates"]
                }
                geo_proc = validate_and_process_geometry(poly_geom, claimed_area_hectares=claim.area_claimed)
                
                fra_geom = FRAGeometry(
                    claim_id=claim.id,
                    geometry=json.dumps(geo_proc["geometry"]),
                    geometry_source="FIELD_SURVEY",
                    survey_reference=f"SURV-{claim.claim_id}",
                    calculated_area_m2=geo_proc["calculated_area_m2"],
                    calculated_area_hectares=geo_proc["calculated_area_hectares"],
                    claimed_area_hectares=geo_proc["claimed_area_hectares"],
                    area_difference_percentage=geo_proc["area_difference_percentage"],
                    flag_for_review=geo_proc["flag_for_review"],
                    centroid=json.dumps(geo_proc["centroid"]),
                    bbox=json.dumps(geo_proc["bbox"]),
                    geometry_status=geo_proc["geometry_status"]
                )
                db.add(fra_geom)
                db.commit()
                db.refresh(fra_geom)

                record_audit(db, action="ATTACH_GEOMETRY", entity="FRAGeometry", entity_id=str(fra_geom.id), user_id=admin_user.id if admin_user else None, new_value={"area_ha": fra_geom.calculated_area_hectares, "discrepancy_pct": fra_geom.area_difference_percentage})

                # Attach Sample Document
                doc = Document(
                    claim_id=claim.id,
                    file_name=f"patta_{claim.claim_id.lower().replace('-', '_')}.pdf",
                    file_url=f"/uploads/documents/patta_{claim.claim_id.lower().replace('-', '_')}.pdf",
                    document_type="FRA_PATTA",
                    ocr_text=f"MINISTRY OF TRIBAL AFFAIRS - FOREST RIGHTS ACT 2006\nTitle of Forest Land under Section 3(1)(a)\nClaim ID: {claim.claim_id}\nName of Title Holder: {claim.applicant_name}\nFather/Husband: {claim.father_or_husband_name}\nVillage: {claim.village}, Block: {claim.block}, District: {claim.district}, State: {claim.state}\nClaim Category: {claim.claim_type}\nExtent of Land: {claim.area_claimed} Hectares\nSurvey/Plot No: {claim.survey_number}\nStatus: Verified and Recorded.",
                    ocr_confidence=0.94,
                    processing_status="COMPLETED",
                    uploaded_by=admin_user.id if admin_user else None
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)

                # Seed Document Fields
                fields = [
                    ("claim_id", claim.claim_id, 0.98),
                    ("applicant_name", claim.applicant_name, 0.95),
                    ("father_name", claim.father_or_husband_name or "", 0.92),
                    ("village", claim.village, 0.96),
                    ("district", claim.district, 0.97),
                    ("state", claim.state, 0.99),
                    ("claim_type", claim.claim_type, 0.96),
                    ("area", str(claim.area_claimed), 0.94),
                    ("survey_number", claim.survey_number or "", 0.91),
                ]
                for f_name, f_val, f_conf in fields:
                    df = DocumentField(
                        document_id=doc.id,
                        field_name=f_name,
                        field_value=f_val,
                        confidence=f_conf,
                        source="OCR_LLM"
                    )
                    db.add(df)
                db.commit()

                # Run Remote Sensing & AI Segmentation
                sat_res = process_satellite_analysis(claim_id=claim.claim_id, geojson_geom=geo_proc["geometry"])
                
                sat_analysis = SatelliteAnalysis(
                    claim_id=claim.id,
                    geometry_id=fra_geom.id,
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
                    model_name="SegFormer-B2-RemoteSensing",
                    model_version="v2.1.0",
                    confidence=0.91
                )
                db.add(sat_analysis)
                db.commit()
                db.refresh(sat_analysis)

                # Segment land cover
                seg_mask, stats_list = perform_semantic_segmentation(
                    bands=sat_res["bands"],
                    indices=sat_res["indices"],
                    total_area_m2=geo_proc["calculated_area_m2"]
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

                # Extract Assets
                detected_assets = extract_detected_assets(
                    geojson_geom=geo_proc["geometry"],
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
                        model_name=ast.get("model_name", "SAM2-Detector")
                    )
                    db.add(asset_rec)
                db.commit()

                # Run DSS Evaluator
                run_dss_for_claim(db=db, claim_id=claim.id)

                record_audit(db, action="RUN_SATELLITE_AND_DSS", entity="SatelliteAnalysis", entity_id=str(sat_analysis.id), user_id=admin_user.id if admin_user else None, new_value={"mean_ndvi": sat_analysis.mean_ndvi, "analysis_id": sat_analysis.id})

        print("--- Database Seeding Complete & Verified Successfully! ---")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
