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
    Structured extraction:
    1. Primary: Groq LLM API (ultra-fast LLaMA 3.3 70B / LLaMA 3.1 70B) if GROQ_API_KEY is configured.
    2. Secondary: Google Gemini API if GEMINI_API_KEY is configured.
    3. Fallback: High-precision deterministic rule parser.
    Never invents missing values; strictly returns null for unverified fields.
    """
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
            "applicant_name": float,
            "father_name": float,
            "age": float,
            "gender": float,
            "village": float,
            "block": float,
            "district": float,
            "state": float,
            "claim_type": float,
            "area": float,
            "survey_number": float,
            "land_use": float,
            "application_date": float
        }}
    }}

    OCR TEXT:
    \"\"\"
    {ocr_text}
    \"\"\"

    Return ONLY the raw JSON object.
    """

    # 1. Primary: Groq API (multi-model fallback)
    if settings.GROQ_API_KEY:
        models_to_try = [
            settings.GROQ_MODEL,
            "openai/gpt-oss-120b",
            "qwen/qwen3.6-27b",
            "llama-3.3-70b-versatile"
        ]
        # Remove duplicates while preserving order
        unique_models = []
        for m in models_to_try:
            if m and m not in unique_models:
                unique_models.append(m)

        for model_name in unique_models:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an official Ministry of Tribal Affairs Forest Rights Act document metadata parser. Output strictly valid JSON."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        content = data["choices"][0]["message"]["content"]
                        # Strip thinking tags if generated
                        clean_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                        clean_json_str = re.sub(r'```(?:json)?', '', clean_content).strip()
                        # Extract first JSON object
                        json_match = re.search(r'\{.*\}', clean_json_str, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            return LLMExtractedDocument(**parsed)
            except Exception:
                continue

    # 2. Secondary: Gemini API
    if settings.GEMINI_API_KEY:
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
                    clean_json_str = re.sub(r'```(?:json)?', '', candidate_text).strip()
                    parsed = json.loads(clean_json_str)
                    return LLMExtractedDocument(**parsed)
        except Exception:
            pass

    # 3. Fallback to deterministic rule parser
    return rule_based_extraction(ocr_text)
