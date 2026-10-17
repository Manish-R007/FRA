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

def test_rule_based_extraction_hindi_labels_and_digits():
    extracted = rule_based_extraction("आवेदक का नाम: सीमा देवी\nआयु: ३५\nग्राम: बरिपदा\nजिला: मयूरभंज\nराज्य: ओडिशा\nदावा संख्या: FRA-OD-12\n2.5 हेक्टेयर")
    assert extracted.applicant_name == "सीमा देवी"
    assert extracted.age == 35
    assert extracted.village == "बरिपदा"
    assert extracted.district == "मयूरभंज"
    assert extracted.state == "ओडिशा"
    assert extracted.claim_id == "FRA-OD-12"
    assert extracted.area == 2.5

def test_rule_based_extraction_kannada_labels():
    extracted = rule_based_extraction("ಅರ್ಜಿದಾರರ ಹೆಸರು: ಲಕ್ಷ್ಮಿ\nವಯಸ್ಸು: ೪೨\nಗ್ರಾಮ: ಹಳ್ಳಿ\nಜಿಲ್ಲೆ: ಮೈಸೂರು\nರಾಜ್ಯ: ಕರ್ನಾಟಕ\n1.5 ಹೆಕ್ಟೇರ್")
    assert extracted.applicant_name == "ಲಕ್ಷ್ಮಿ"
    assert extracted.age == 42
    assert extracted.village == "ಹಳ್ಳಿ"
    assert extracted.district == "ಮೈಸೂರು"
    assert extracted.state == "ಕರ್ನಾಟಕ"
    assert extracted.area == 1.5

def test_rule_based_extraction_odia_labels():
    extracted = rule_based_extraction("ଆବେଦକଙ୍କ ନାମ: ସୀତା\nବୟସ: ୩୦\nଗ୍ରାମ: ବାରିପଦା\nଜିଲ୍ଲା: ମୟୂରଭଞ୍ଜ\nରାଜ୍ୟ: ଓଡ଼ିଶା\n2 ଏକର")
    assert extracted.applicant_name == "ସୀତା"
    assert extracted.age == 30
    assert extracted.village == "ବାରିପଦା"
    assert extracted.district == "ମୟୂରଭଞ୍ଜ"
    assert extracted.state == "ଓଡ଼ିଶା"
    assert extracted.area == round(2 * 0.404686, 4)
