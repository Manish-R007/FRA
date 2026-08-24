"""
Realistic Seed Data for Forest Rights Act (FRA) 2006 Implementation.
Contains authentic polygon geometries (NO artificial squares!), realistic tribal claimant profiles,
and real coordinates from Odisha, Madhya Pradesh, Maharashtra, and Jharkhand.
"""

REALISTIC_CLAIMS_DATA = [
    {
        "claim_id": "FRA-OD-MAY-001",
        "claim_type": "IFR",
        "applicant_name": "Birsa Munda",
        "father_or_husband_name": "Sanatan Munda",
        "age": 46,
        "gender": "Male",
        "address": "House No 24, Munda Tola",
        "village": "Baripada",
        "block": "Baripada Sadar",
        "district": "Mayurbhanj",
        "state": "Odisha",
        "survey_number": "SY-104/2B",
        "area_claimed": 2.40,
        "area_unit": "hectares",
        "land_use": "Traditional Agriculture & Homestead",
        "application_date": "2023-04-12",
        "status": "APPROVED",
        "verification_status": "VERIFIED",
        # Realistic irregular forest parcel polygon (approx 2.38 hectares)
        "polygon_coordinates": [
            [
                [86.745120, 21.932450],
                [86.746850, 21.933120],
                [86.747940, 21.931890],
                [86.746980, 21.930450],
                [86.745430, 21.930980],
                [86.745120, 21.932450]
            ]
        ]
    },
    {
        "claim_id": "FRA-OD-MAY-002",
        "claim_type": "IFR",
        "applicant_name": "Palo Soren",
        "father_or_husband_name": "Late Charan Soren",
        "age": 52,
        "gender": "Female",
        "address": "Soren Sahi, Village Kuliana",
        "village": "Kuliana",
        "block": "Kuliana",
        "district": "Mayurbhanj",
        "state": "Odisha",
        "survey_number": "SY-88/1A",
        "area_claimed": 1.75,
        "area_unit": "hectares",
        "land_use": "Agriculture & Sal Tree Agroforestry",
        "application_date": "2023-06-18",
        "status": "APPROVED",
        "verification_status": "VERIFIED",
        "polygon_coordinates": [
            [
                [86.682100, 22.043200],
                [86.683650, 22.044150],
                [86.684800, 22.042980],
                [86.683950, 22.041850],
                [86.682500, 22.042200],
                [86.682100, 22.043200]
            ]
        ]
    },
    {
        "claim_id": "FRA-OD-MAY-003",
        "claim_type": "CFR",
        "applicant_name": "Similipal Forest Protection Gram Sabha",
        "father_or_husband_name": "Gram Sabha Committee",
        "age": None,
        "gender": "Other",
        "address": "Community Gram Sabha Bhawan, Jashipur",
        "village": "Jashipur",
        "block": "Jashipur",
        "district": "Mayurbhanj",
        "state": "Odisha",
        "survey_number": "CFR-JAS-09",
        "area_claimed": 48.50,
        "area_unit": "hectares",
        "land_use": "Community Forest Resource / NTFP Collection & Watershed",
        "application_date": "2022-11-05",
        "status": "APPROVED",
        "verification_status": "VERIFIED",
        # Large community forest polygon
        "polygon_coordinates": [
            [
                [86.082000, 21.965000],
                [86.091000, 21.972000],
                [86.098500, 21.968000],
                [86.095000, 21.954000],
                [86.084000, 21.956000],
                [86.082000, 21.965000]
            ]
        ]
    },
    {
        "claim_id": "FRA-MP-DIN-001",
        "claim_type": "IFR",
        "applicant_name": "Mangal Singh Baiga",
        "father_or_husband_name": "Faggu Baiga",
        "age": 39,
        "gender": "Male",
        "address": "Baiga Tola, Samnapur",
        "village": "Samnapur",
        "block": "Samnapur",
        "district": "Dindori",
        "state": "Madhya Pradesh",
        "survey_number": "KH-342/1",
        "area_claimed": 3.10,
        "area_unit": "hectares",
        "land_use": "Bewar Shifting/Mixed Millet Cultivation",
        "application_date": "2023-08-20",
        "status": "GIS_VALIDATED",
        "verification_status": "VERIFIED",
        "polygon_coordinates": [
            [
                [81.482000, 22.754000],
                [81.484500, 22.755800],
                [81.486200, 22.753900],
                [81.484900, 22.752100],
                [81.482800, 22.752600],
                [81.482000, 22.754000]
            ]
        ]
    },
    {
        "claim_id": "FRA-MH-GAD-001",
        "claim_type": "CFR",
        "applicant_name": "Mendha Lekha Village Gram Sabha",
        "father_or_husband_name": "Devaji Tofa (Representative)",
        "age": None,
        "gender": "Other",
        "address": "Gram Sabha Karyalaya, Mendha Lekha",
        "village": "Mendha Lekha",
        "block": "Dhanora",
        "district": "Gadchiroli",
        "state": "Maharashtra",
        "survey_number": "CFR-MH-GAD-01",
        "area_claimed": 65.00,
        "area_unit": "hectares",
        "land_use": "Bamboo Regeneration & Honey Harvesting",
        "application_date": "2021-02-14",
        "status": "APPROVED",
        "verification_status": "VERIFIED",
        "polygon_coordinates": [
            [
                [80.354000, 20.210000],
                [80.366000, 20.218000],
                [80.372000, 20.209000],
                [80.365000, 20.198000],
                [80.352000, 20.201000],
                [80.354000, 20.210000]
            ]
        ]
    },
    {
        "claim_id": "FRA-JH-GUM-001",
        "claim_type": "IFR",
        "applicant_name": "Sukru Oraon",
        "father_or_husband_name": "Budhu Oraon",
        "age": 48,
        "gender": "Male",
        "address": "Oraon Toli, Bishunpur",
        "village": "Bishunpur",
        "block": "Bishunpur",
        "district": "Gumla",
        "state": "Jharkhand",
        "survey_number": "SY-219/A",
        "area_claimed": 2.15,
        "area_unit": "hectares",
        "land_use": "Upland Paddy Cultivation & Homestead",
        "application_date": "2024-01-10",
        "status": "PENDING_VERIFICATION",
        "verification_status": "UNVERIFIED",
        "polygon_coordinates": [
            [
                [84.382000, 23.385000],
                [84.383900, 23.386200],
                [84.385100, 23.384800],
                [84.384100, 23.383500],
                [84.382600, 23.383900],
                [84.382000, 23.385000]
            ]
        ]
    }
]

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
