import os
import json
from PIL import Image, ImageDraw, ImageFont

def create_official_government_patta():
    out_dir = os.path.join(os.getcwd(), "sample_documents")
    os.makedirs(out_dir, exist_ok=True)

    # 1. Canvas dimensions: High-Resolution A4 (300 DPI -> 2480 x 3508)
    W, H = 2480, 3508
    img = Image.new("RGB", (W, H), color=(254, 252, 245)) # Government stamp parchment paper
    draw = ImageDraw.Draw(img)

    # Outer intricate borders
    draw.rectangle([50, 50, W - 50, H - 50], outline=(30, 60, 40), width=10)
    draw.rectangle([75, 75, W - 75, H - 75], outline=(180, 140, 60), width=3)
    draw.rectangle([90, 90, W - 90, H - 90], outline=(30, 60, 40), width=2)

    # Corner decorations
    for cx, cy in [(110, 110), (W - 110, 110), (110, H - 110), (W - 110, H - 110)]:
        draw.rectangle([cx - 20, cy - 20, cx + 20, cy + 20], fill=(180, 140, 60))

    # Header Emblem box
    draw.rectangle([130, 130, W - 130, 580], fill=(244, 240, 226), outline=(180, 140, 60), width=3)

    # Text rendering helper (using default font with scaling)
    def draw_banner_text():
        # Emulated Government Seal
        draw.ellipse([W//2 - 60, 160, W//2 + 60, 280], outline=(30, 60, 40), width=4)
        draw.text((W//2 - 50, 200), "सत्यमेव जयते", fill=(30, 60, 40))
        draw.text((W//2 - 45, 230), "GOVT OF INDIA", fill=(30, 60, 40))

        # Header Titles
        lines_header = [
            ("GOVERNMENT OF ODISHA / भारत सरकार", 310, (20, 30, 20)),
            ("DISTRICT LEVEL COMMITTEE (DLC), REVENUE & FOREST DEPARTMENT", 350, (60, 60, 60)),
            ("SCHEDULED TRIBES AND OTHER TRADITIONAL FOREST DWELLERS", 400, (10, 80, 40)),
            ("(RECOGNITION OF FOREST RIGHTS) ACT, 2006 [CENTRAL ACT NO. 2 OF 2007]", 440, (10, 80, 40)),
            ("FORM - A : TITLE DEED FOR INDIVIDUAL FOREST RIGHTS [RULE 8(h)]", 490, (140, 50, 20)),
            ("TITLE NUMBER / पट्टा संख्या: FRA/OD/MAY/2023/IFR-00889", 535, (10, 100, 50)),
        ]
        for t, y, col in lines_header:
            draw.text((W//2 - (len(t) * 7), y), t, fill=col)

    draw_banner_text()

    # Main Body Content
    draw.line([130, 620, W - 130, 620], fill=(180, 140, 60), width=3)

    fields = [
        ("1. Title Deed Registration No.", "FRA-OD-MAY-010 / 2023", "1. पट्टा पंजीकरण संख्या"),
        ("2. Name of Title Holder / Beneficiary", "BIRSA MUNDA (बिरसा मुंडा)", "2. वन अधिकार धारक का नाम"),
        ("3. Father's / Husband's Name", "LATE SUGANA MUNDA (स्व. सुगना मुंडा)", "3. पिता / पति का नाम"),
        ("4. Age & Gender", "46 Years / MALE", "4. आयु एवं लिंग"),
        ("5. Social Category / Tribe", "SCHEDULED TRIBE (MUNDA) / अनुसूचित जनजाति", "5. सामाजिक वर्ग / जनजाति"),
        ("6. Name of Gram Sabha / Village", "BARIPADA (बारीपदा)", "6. ग्राम सभा / ग्राम का नाम"),
        ("7. Gram Panchayat & Block", "BARIPADA SADAR (बारीपदा सदर)", "7. ग्राम पंचायत एवं प्रखण्ड"),
        ("8. Sub-Division & District", "BARIPADA SUB-DIVISION, MAYURBHANJ (ODISHA)", "8. अनुमंडल एवं जिला"),
        ("9. Legal Category of Rights Recognized", "INDIVIDUAL FOREST RIGHTS (Section 3(1)(a))", "9. मान्यता प्राप्त वन अधिकार"),
        ("10. Recognized Extent of Forest Land", "2.50 HECTARES (6.177 ACRES / 6 Bigha 3 Katha)", "10. स्वीकृत वन भूमि का क्षेत्रफल"),
        ("11. Cadastral Survey / Khasra Plot No.", "PLOT NO: SY-108/4A | KHATA NO: KH-88/C", "11. भू-अभिलेख / खसरा संख्या"),
        ("12. Primary Land Use Recognized", "TRADITIONAL CULTIVATION & HOMESTEAD", "12. भूमि उपयोग का प्रकार"),
        ("13. Date of Gram Sabha Recommendation", "12th JUNE 2023 (Resolution No. GS-2023/14)", "13. ग्राम सभा अनुशंसा तिथि"),
        ("14. Date of SDLC Verification & Clearance", "18th AUGUST 2023 (Sub-Divisional Clearance)", "14. अनुमंडल समिति सत्यापन तिथि"),
        ("15. Date of DLC Final Title Grant", "15th SEPTEMBER 2023 (Approved by Collector)", "15. जिला स्तरीय समिति स्वीकृति तिथि"),
    ]

    start_y = 660
    row_height = 80

    for i, (en_label, val, hi_label) in enumerate(fields):
        y = start_y + (i * row_height)
        
        # Zebra background
        if i % 2 == 0:
            draw.rectangle([130, y - 10, W - 130, y + row_height - 15], fill=(248, 246, 238))
        
        # Labels
        draw.text((160, y), en_label, fill=(40, 50, 40))
        draw.text((160, y + 25), hi_label, fill=(110, 110, 110))
        
        # Colon
        draw.text((950, y + 10), ":", fill=(60, 60, 60))
        
        # Value
        draw.text((990, y + 10), val, fill=(10, 30, 20))

    # Schedule of Boundaries Section
    bound_y = start_y + (len(fields) * row_height) + 20
    draw.rectangle([130, bound_y, W - 130, bound_y + 360], fill=(242, 238, 224), outline=(180, 140, 60), width=2)
    
    draw.text((160, bound_y + 20), "SCHEDULE OF BOUNDARIES AS PER JOINT GPS FIELD DEMARCATION / सीमा विवरण:", fill=(10, 80, 40))
    
    boundaries = [
        ("• NORTH (उत्तर) : Traditional Village Footpath and Sal Forest Stand (Reserve Forest RF-12)"),
        ("• SOUTH (दक्षिण) : Natural Drainage Stream (Nala) & Cultivated Land of Sanatan Soren (FRA-OD-MAY-009)"),
        ("• EAST (पूर्व)   : Reserve Forest Demarcation Boundary Pillar No. BP-22"),
        ("• WEST (पश्चिम)  : Gram Sabha Community Common Grazing Land & Grazing Path"),
        ("• GPS SURVEY  : Centroid (86.75812° E, 21.94368° N) | WGS84 Geodesic Survey Validated: 2.50 Ha"),
    ]
    
    for j, b in enumerate(boundaries):
        draw.text((180, bound_y + 70 + (j * 55)), b, fill=(30, 30, 30))

    # Statutory Declaration Banner
    dec_y = bound_y + 400
    statutory_text = (
        "TERMS & CONDITIONS: This Title Deed confers inheritable, non-transferable, and non-alienable rights upon the title holder\n"
        "under Section 4(4) of the Scheduled Tribes and Other Traditional Forest Dwellers Act, 2006. The land shall not be alienated,\n"
        "transferred, or mortgaged. The rights holder is entitled to all converged benefits under PM-KISAN, PMKSY, PMAY-G, and VDVY."
    )
    draw.text((160, dec_y), statutory_text, fill=(80, 80, 80))

    # Signature and Seal Blocks
    sig_y = dec_y + 160
    draw.line([130, sig_y, W - 130, sig_y], fill=(180, 140, 60), width=2)

    # 3 Signatures: SDLC, DFO, District Magistrate
    sigs = [
        ("Sub-Divisional Officer (SDO)", "Sub-Divisional Level Committee", "Baripada, Mayurbhanj", 250),
        ("Divisional Forest Officer (DFO)", "Forest & Environment Dept", "Mayurbhanj Forest Division", 1050),
        ("District Magistrate & Collector", "Chairperson, District Level Committee", "District Mayurbhanj, Odisha", 1850),
    ]

    for title, dept, dist, x in sigs:
        # Stamp Box
        draw.rectangle([x, sig_y + 30, x + 420, sig_y + 180], outline=(100, 120, 140), width=1)
        draw.text((x + 120, sig_y + 60), "[OFFICIAL SEAL]", fill=(80, 100, 160))
        draw.text((x + 90, sig_y + 100), "DIGITALLY SIGNED", fill=(30, 120, 50))
        
        draw.text((x, sig_y + 200), title, fill=(20, 20, 20))
        draw.text((x, sig_y + 230), dept, fill=(70, 70, 70))
        draw.text((x, sig_y + 260), dist, fill=(100, 100, 100))

    # Save High-Res PNG
    png_path = os.path.join(out_dir, "official_fra_patta_title_deed_2023.png")
    img.save(png_path, "PNG", quality=95)
    print(f"Created Real PNG Document: {png_path}")

    # Save True Digital PDF
    pdf_path = os.path.join(out_dir, "official_fra_patta_title_deed_2023.pdf")
    img.save(pdf_path, "PDF", resolution=300.0)
    print(f"Created Real PDF Document: {pdf_path}")

if __name__ == "__main__":
    create_official_government_patta()
