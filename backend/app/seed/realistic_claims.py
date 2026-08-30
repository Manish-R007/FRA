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
    }
]
