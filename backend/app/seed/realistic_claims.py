"""
Forest Rights Act (FRA) 2006 Implementation - Welfare Schemes & Policy Guidelines Data.
"""

REALISTIC_CLAIMS_DATA = []

SCHEMES_DATA = [
    {
        "name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
        "code": "PM-KISAN",
        "department": "Ministry of Agriculture & Farmers Welfare",
        "description": "Central sector welfare scheme to supplement the financial needs of all landholding farmer families across India for agricultural inputs and domestic needs.",
        "eligibility_rules": {
            "claim_status": ["APPROVED"],
            "claim_types": ["IFR"],
            "min_crop_percentage": 15.0,
            "required_land_use": "Agriculture"
        },
        "benefits": "Direct income support of ₹6,000 per annum in three equal four-monthly installments of ₹2,000 directly into Aadhaar-seeded bank accounts.",
        "documents_required": ["FRA Title Patta", "Aadhaar Card", "Bank Passbook", "Land Possession Certificate"],
        "active": True
    },
    {
        "name": "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY - Per Drop More Crop)",
        "code": "PMKSY",
        "department": "Department of Agriculture & Farmers Welfare",
        "description": "National mission to improve on-farm water use efficiency through precision micro-irrigation technologies (drip & sprinkler systems) and individual farm ponds.",
        "eligibility_rules": {
            "claim_status": ["APPROVED"],
            "min_crop_percentage": 20.0,
            "max_water_percentage": 5.0,
            "requires_irrigation_asset": True
        },
        "benefits": "Up to 85% capital subsidy for tribal and marginal farmers on installation of micro-irrigation equipment and 100% assistance for individual farm ponds (*Khet Talab*).",
        "documents_required": ["FRA Patta Title Copy", "Khasra/Survey Land Map", "Soil & Water Test Report", "Bank Account Details"],
        "active": True
    },
    {
        "name": "Pradhan Mantri Awaas Yojana - Gramin (PMAY-G)",
        "code": "PMAY-G",
        "department": "Ministry of Rural Development",
        "description": "Flagship rural housing scheme providing financial assistance to houseless and households living in kutcha/dilapidated houses in forest and rural habitations.",
        "eligibility_rules": {
            "claim_status": ["APPROVED"],
            "max_building_percentage": 10.0,
            "min_bare_land_percentage": 10.0,
            "homestead_rights": True
        },
        "benefits": "Direct financial grant of ₹1,30,000 in Integrated Action Plan / tribal districts, plus 90 days of MGNREGA unskilled labor wages and ₹12,000 for toilet construction.",
        "documents_required": ["FRA Patta Document", "SECC / BPL Verification", "Aadhaar Card", "Site Geo-tagged Photo"],
        "active": True
    },
    {
        "name": "Pradhan Mantri Van Dhan Vikas Yojana (VDVY)",
        "code": "VDVY",
        "department": "Ministry of Tribal Affairs / TRIFED",
        "description": "Livelihood generation initiative for tribal gatherers and forest dwellers harnessing the wealth of forest produce through tribal SHG aggregation and value addition.",
        "eligibility_rules": {
            "claim_types": ["CFR", "CR", "IFR"],
            "min_forest_percentage": 30.0
        },
        "benefits": "One-time establishment grant of ₹15 Lakh per Van Dhan Vikas Kendra (VDVK) for equipment, toolkits, training, and working capital for value addition of NTFP.",
        "documents_required": ["Gram Sabha Resolution", "CFR/IFR Title Deed", "SHG Member Roster", "TRIFED Registration"],
        "active": True
    },
    {
        "name": "Special FRA Land Development Support under MGNREGA",
        "code": "MGNREGA-FRA",
        "department": "Ministry of Rural Development",
        "description": "Category B individual land development entitlement for FRA title holders for land levelling, bunding, horticulture planting, and dug-well creation.",
        "eligibility_rules": {
            "claim_status": ["APPROVED", "GIS_VALIDATED"],
            "requires_land_development": True
        },
        "benefits": "Up to 150 days of guaranteed wage labor per household, plus material grant up to ₹2,00,000 for individual field bunding, irrigation wells, and fruit orchard development.",
        "documents_required": ["FRA Patta Certificate", "Job Card", "Gram Rozgar Sahayak Verification"],
        "active": True
    },
    {
        "name": "Jal Jeevan Mission (JJM - Har Ghar Jal)",
        "code": "JJM",
        "department": "Ministry of Jal Shakti",
        "description": "Assuring potable drinking water supply in adequate quantity and prescribed quality to every rural household through individual functional household tap connections.",
        "eligibility_rules": {
            "claim_status": ["APPROVED", "PENDING_VERIFICATION"],
            "habitation_need": True
        },
        "benefits": "Free installation of functional household tap connection (FHTC) providing 55 liters per capita per day of clean treated drinking water.",
        "documents_required": ["Village Habitation Proof", "Aadhaar", "Village Water & Sanitation Committee (VWSC) Approval"],
        "active": True
    },
    {"name": "PM-KISAN", "code": "PM-KISAN", "department": "Ministry of Agriculture & Farmers Welfare", "description": "Income support for eligible farmer families; verify current official rules and household conditions.", "eligibility_rules": {"official_source_verification_required": True, "status": "Eligibility cannot be inferred from FRA claim alone"}, "benefits": "Refer to current official PM-KISAN guidelines; benefit amount not asserted by this catalog entry.", "documents_required": ["Check current official guidelines"], "active": True},
    {"name": "PMKSY", "code": "PMKSY", "department": "Ministry of Agriculture & Farmers Welfare", "description": "Pradhan Mantri Krishi Sinchayee Yojana; components and applicant criteria vary.", "eligibility_rules": {"official_source_verification_required": True, "status": "Project and component specific"}, "benefits": "Refer to the applicable current component guidelines.", "documents_required": ["Check current official component guidelines"], "active": True},
    {"name": "Mahatma Gandhi National Rural Employment Guarantee Scheme", "code": "MGNREGA", "department": "Ministry of Rural Development", "description": "Rights-based rural employment programme; household/job-card and local work demand records are needed.", "eligibility_rules": {"official_source_verification_required": True, "status": "FRA claim alone does not establish enrollment or entitlement"}, "benefits": "As provided by current MGNREGA rules and approved local works.", "documents_required": ["Job card and current programme requirements"], "active": True},
    {"name": "Dharti Aaba Janjatiya Gram Utkarsh Abhiyan", "code": "DAJGUA", "department": "Ministry of Tribal Affairs", "description": "Convergence initiative for tribal-majority villages; intervention selection requires verified departmental indicators.", "eligibility_rules": {"official_source_verification_required": True, "status": "Village selection and interventions require official verification"}, "benefits": "Interventions depend on applicable departmental schemes and approved village plans.", "documents_required": ["Official village plan and applicable departmental records"], "active": True},
    {"name": "Van Dhan Vikas Kendra / Van Dhan Yojana", "code": "VDVK", "department": "Ministry of Tribal Affairs / TRIFED", "description": "Tribal livelihood and minor forest produce value-addition support; local group and programme criteria apply.", "eligibility_rules": {"official_source_verification_required": True, "status": "Group formation and local programme criteria require verification"}, "benefits": "Refer to current TRIFED programme guidelines.", "documents_required": ["Current programme and group documentation"], "active": True},
    {"name": "DAY-NRLM", "code": "DAY-NRLM", "department": "Ministry of Rural Development", "description": "Rural livelihoods mission delivered through eligible households, SHGs and local institutions.", "eligibility_rules": {"official_source_verification_required": True, "status": "SHG and local programme status require verification"}, "benefits": "As provided by current DAY-NRLM programme components.", "documents_required": ["SHG membership and applicable programme documents"], "active": True},
    {"name": "Swachh Bharat Mission-Gramin", "code": "SBM-G", "department": "Department of Drinking Water and Sanitation", "description": "Rural sanitation programme; household and village sanitation status must be verified from programme records.", "eligibility_rules": {"official_source_verification_required": True, "status": "Household sanitation status is not inferred from FRA records"}, "benefits": "Refer to current SBM-G guidelines and verified local sanitation plan.", "documents_required": ["Current local SBM-G records"], "active": True},
    {"name": "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana", "code": "PM-JAY", "department": "Ministry of Health and Family Welfare", "description": "Health assurance programme; beneficiary status requires authorized official lookup.", "eligibility_rules": {"official_source_verification_required": True, "status": "Must be checked using authorized PM-JAY beneficiary records"}, "benefits": "Refer to current official PM-JAY guidance for verified beneficiary households.", "documents_required": ["Authorized beneficiary identification and current official requirements"], "active": True}
]
