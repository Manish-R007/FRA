from app.services.llm_extractor import rule_based_extraction

def test_ocr_structured_extraction():
    sample_text = """
    GOVERNMENT OF ODISHA - REVENUE & DISASTER MANAGEMENT
    TITLE OF FOREST LAND (PATTA) UNDER FOREST RIGHTS ACT 2006
    Claim ID: FRA-OD-MAY-009
    Applicant Name: Sanatan Soren
    Father's Name: Late Budhu Soren
    Age: 51
    Gender: Male
    Village: Baripada, Block: Sadar, District: Mayurbhanj, State: Odisha
    Claim Type: Individual Forest Rights (IFR)
    Claimed Area: 2.80 Hectares
    Survey Number: PLOT-889/B
    Land Use: Agriculture & Homestead
    Date of Application: 14/02/2023
    """

    extracted = rule_based_extraction(sample_text)
    assert extracted.claim_id == "FRA-OD-MAY-009"
    assert extracted.applicant_name == "Sanatan Soren"
    assert extracted.father_name == "Late Budhu Soren"
    assert extracted.age == 51
    assert extracted.gender == "Male"
    assert extracted.village == "Baripada"
    assert extracted.district == "Mayurbhanj"
    assert extracted.state == "Odisha"
    assert extracted.claim_type == "IFR"
    assert extracted.area == 2.80
    assert extracted.survey_number == "PLOT-889/B"

def test_ocr_no_hallucination_for_missing_fields():
    sparse_text = "Claim ID: FRA-OD-001. Applicant: Mangal Baiga. State: Odisha."
    extracted = rule_based_extraction(sparse_text)
    assert extracted.claim_id == "FRA-OD-001"
    assert extracted.applicant_name == "Mangal Baiga"
    assert extracted.father_name is None
    assert extracted.age is None
    assert extracted.survey_number is None
    assert extracted.area is None
