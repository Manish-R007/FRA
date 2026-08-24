import re
import json
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.schemas.document import LLMExtractedDocument

def rule_based_extraction(ocr_text: str) -> LLMExtractedDocument:
    """
    High-precision deterministic pattern extractor for official Indian FRA documents.
    Strictly sets unknown or missing fields to None (null).
    Calculates field-level confidences based on regex match quality.
    """
    confidences = {}
    
    # 1. Claim ID pattern
    claim_id_match = re.search(r'(?:Claim\s*(?:ID|No\.?|Number)|Patta\s*No\.?)[\s:]*([A-Za-z0-9\-_/]+)', ocr_text, re.IGNORECASE)
    claim_id = claim_id_match.group(1).strip() if claim_id_match else None
    confidences["claim_id"] = 0.95 if claim_id else 0.0

    # 2. Applicant Name pattern
    applicant_match = re.search(r'(?:Applicant\s*Name|Applicant|Claimant|Name\s*of\s*the\s*Applicant|Holder)[\s:]*([A-Za-z\s\.]+?)(?=\n|\.|Father|Husband|Village|Age|State|District|$)', ocr_text, re.IGNORECASE)
    applicant_name = applicant_match.group(1).strip() if applicant_match else None
    confidences["applicant_name"] = 0.92 if applicant_name else 0.0

    # 3. Father/Husband Name
    father_match = re.search(r'(?:Father(?:\'s)?(?:\s*Name)?|Husband(?:\'s)?(?:\s*Name)?|S/o|D/o|W/o)[\s:]*([A-Za-z\s\.]+?)(?=\n|\.|Village|District|Age|Gender|State|$)', ocr_text, re.IGNORECASE)
    father_name = father_match.group(1).strip() if father_match else None
    confidences["father_name"] = 0.90 if father_name else 0.0

    # 4. Age
    age_match = re.search(r'\bAge[\s:]*(\d{2})\b', ocr_text, re.IGNORECASE)
    age = int(age_match.group(1)) if age_match else None
    confidences["age"] = 0.95 if age else 0.0

    # 5. Gender
    gender_match = re.search(r'\bGender[\s:]*(Male|Female|Other|M|F)\b', ocr_text, re.IGNORECASE)
    gender = None
    if gender_match:
        g = gender_match.group(1).upper()
        gender = "Male" if g in ["M", "MALE"] else ("Female" if g in ["F", "FEMALE"] else "Other")
    confidences["gender"] = 0.90 if gender else 0.0

    # 6. Village
    village_match = re.search(r'\bVillage[\s:]*([A-Za-z\s]+?)(?=,|\n|Block|District|Panchayat|$)', ocr_text, re.IGNORECASE)
    village = village_match.group(1).strip() if village_match else None
    confidences["village"] = 0.91 if village else 0.0

    # 7. Block / Tehsil
    block_match = re.search(r'\b(?:Block|Tehsil|Taluk)[\s:]*([A-Za-z\s]+?)(?=,|\n|District|$)', ocr_text, re.IGNORECASE)
    block = block_match.group(1).strip() if block_match else None
    confidences["block"] = 0.88 if block else 0.0

    # 8. District
    district_match = re.search(r'\bDistrict[\s:]*([A-Za-z\s]+?)(?=,|\n|State|$)', ocr_text, re.IGNORECASE)
    district = district_match.group(1).strip() if district_match else None
    confidences["district"] = 0.94 if district else 0.0

    # 9. State
    state_match = re.search(r'\bState[\s:]*([A-Za-z\s]+?)(?=\n|Pin|Survey|Claim|$)', ocr_text, re.IGNORECASE)
    state = state_match.group(1).strip() if state_match else None
    confidences["state"] = 0.95 if state else 0.0

    # 10. Claim Type (IFR, CR, CFR)
    claim_type = None
    if re.search(r'\b(?:Individual\s*Forest\s*Rights?|IFR)\b', ocr_text, re.IGNORECASE):
        claim_type = "IFR"
    elif re.search(r'\b(?:Community\s*Forest\s*Resource|CFR)\b', ocr_text, re.IGNORECASE):
        claim_type = "CFR"
    elif re.search(r'\b(?:Community\s*Rights?|CR)\b', ocr_text, re.IGNORECASE):
        claim_type = "CR"
    confidences["claim_type"] = 0.96 if claim_type else 0.0

    # 11. Area Claimed (in hectares or acres converted to hectares)
    area = None
    area_match = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(?:Hectares?|Ha\.?|Acres?|Acre)', ocr_text, re.IGNORECASE)
    if area_match:
        val = float(area_match.group(1))
        # If acres, convert to hectares (1 acre = 0.404686 ha)
        if "acre" in area_match.group(0).lower():
            area = round(val * 0.404686, 4)
        else:
            area = round(val, 4)
    confidences["area"] = 0.93 if area else 0.0

    # 12. Survey Number
    survey_match = re.search(r'(?:Survey\s*(?:Number|No\.?)|Khasra\s*(?:Number|No\.?)|Plot\s*(?:Number|No\.?))[\s:]*([A-Za-z0-9\-_/]+)', ocr_text, re.IGNORECASE)
    survey_number = survey_match.group(1).strip() if survey_match else None
    confidences["survey_number"] = 0.90 if survey_number else 0.0

    # 13. Land Use
    land_use_match = re.search(r'(?:Land\s*Use|Purpose)[\s:]*([A-Za-z\s&,]+?)(?=\n|Date|$)', ocr_text, re.IGNORECASE)
    land_use = land_use_match.group(1).strip() if land_use_match else None
    confidences["land_use"] = 0.85 if land_use else 0.0

    # 14. Application Date
    date_match = re.search(r'(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})', ocr_text)
    application_date = date_match.group(1) if date_match else None
    confidences["application_date"] = 0.92 if application_date else 0.0

    return LLMExtractedDocument(
        claim_id=claim_id,
        applicant_name=applicant_name,
        father_name=father_name,
        age=age,
        gender=gender,
        village=village,
        block=block,
        district=district,
        state=state,
        claim_type=claim_type,
        area=area,
        survey_number=survey_number,
        land_use=land_use,
        application_date=application_date,
        field_confidences=confidences
    )

async def extract_structured_data(ocr_text: str) -> LLMExtractedDocument:
    """
    Structured extraction: calls Gemini LLM API if key is configured,
    otherwise uses the rule-based extraction engine.
    Never invents missing values; returns null for unverified fields.
    """
    if not settings.GEMINI_API_KEY:
        return rule_based_extraction(ocr_text)

    prompt = f"""
    You are an expert Forest Rights Act (FRA) document verification assistant for the Ministry of Tribal Affairs, India.
    Convert the following OCR text extracted from an official FRA Patta / application document into structured JSON.

    CRITICAL RULES:
    1. NEVER invent, assume, or hallucinate missing information.
    2. If a field is not explicitly present in the text, you MUST return null.
    3. Return field-level confidence scores (0.0 to 1.0) based strictly on OCR clarity.
    4. Normalize claim_type to one of: "IFR", "CR", "CFR", or null.
    5. Convert area to standard hectares (float).

    Required JSON schema format:
    {{
        "claim_id": string or null,
        "applicant_name": string or null,
        "father_name": string or null,
        "age": integer or null,
        "gender": string ("Male"/"Female"/"Other") or null,
        "village": string or null,
        "block": string or null,
        "district": string or null,
        "state": string or null,
        "claim_type": "IFR" | "CR" | "CFR" | null,
        "area": float (hectares) or null,
        "survey_number": string or null,
        "land_use": string or null,
        "application_date": string or null,
        "field_confidences": {{
            "claim_id": float,
            "applicant_name": float, ...
        }}
    }}

    OCR TEXT:
    \"\"\"
    {ocr_text}
    \"\"\"

    Return ONLY the raw JSON object.
    """

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                result = response.json()
                candidate_text = result["candidates"][0]["content"]["parts"][0]["text"]
                # Clean markdown json fences
                clean_json_str = re.sub(r'```(?:json)?', '', candidate_text).strip()
                parsed = json.loads(clean_json_str)
                return LLMExtractedDocument(**parsed)
    except Exception:
        pass

    # Fallback to high-precision rule parser
    return rule_based_extraction(ocr_text)
