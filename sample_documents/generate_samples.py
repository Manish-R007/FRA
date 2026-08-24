import os
import json
from PIL import Image, ImageDraw, ImageFont

def generate_sample_patta_image_and_pdf():
    out_dir = os.path.join(os.getcwd(), "sample_documents")
    os.makedirs(out_dir, exist_ok=True)

    # 1. Generate Odisha FRA Patta (Individual Forest Rights - IFR)
    width, height = 1200, 1600
    img = Image.new("RGB", (width, height), color=(252, 250, 242)) # Parchment ivory paper
    draw = ImageDraw.Draw(img)

    # Draw border
    draw.rectangle([40, 40, width - 40, height - 40], outline=(100, 80, 50), width=4)
    draw.rectangle([50, 50, width - 50, height - 50], outline=(150, 120, 80), width=1)

    # Decorative header
    draw.rectangle([60, 60, width - 60, 220], fill=(240, 235, 220), outline=(150, 120, 80), width=2)
    
    # Text lines
    lines = [
        ("GOVERNMENT OF ODISHA", 100, 28, (30, 40, 30)),
        ("REVENUE & DISASTER MANAGEMENT DEPARTMENT", 135, 20, (60, 60, 60)),
        ("TITLE OF FOREST LAND UNDER FOREST RIGHTS ACT, 2006", 170, 24, (10, 80, 40)),
        ("FORM - PATTA / TITLE DEED [SECTION 3(1)(a)]", 200, 18, (100, 60, 20)),
        
        ("---------------------------------------------------------------------------------------------------------", 240, 16, (180, 180, 180)),
        ("Claim ID: FRA-OD-MAY-009", 280, 26, (10, 100, 50)),
        ("Name of Title Holder / Applicant: Sanatan Soren", 330, 22, (20, 20, 20)),
        ("Father's / Husband's Name: Late Budhu Soren", 370, 20, (30, 30, 30)),
        ("Age: 51 Years     |     Gender: Male", 410, 20, (30, 30, 30)),
        ("Community / Tribe: Santhal (Scheduled Tribe)", 450, 20, (30, 30, 30)),
        ("Village: Baripada", 490, 20, (20, 20, 20)),
        ("Gram Panchayat / Block: Baripada Sadar", 530, 20, (30, 30, 30)),
        ("District: Mayurbhanj     |     State: Odisha", 570, 20, (20, 20, 20)),
        ("Claim Category: Individual Forest Rights (IFR)", 620, 22, (10, 90, 40)),
        ("Extent of Forest Land: 2.80 Hectares (6.92 Acres)", 660, 22, (10, 90, 40)),
        ("Survey / Plot Number: PLOT-889/B", 700, 20, (20, 20, 20)),
        ("Khasra / Khata No: KH-112/A", 740, 20, (30, 30, 30)),
        ("Primary Land Use: Traditional Agriculture & Homestead", 780, 20, (30, 30, 30)),
        ("Date of Application: 14/02/2023", 820, 20, (30, 30, 30)),
        ("Date of Verification: 18/08/2023", 860, 20, (30, 30, 30)),
        
        ("---------------------------------------------------------------------------------------------------------", 900, 16, (180, 180, 180)),
        ("SCHEDULE OF BOUNDARIES (ACTUAL DEMARCATION):", 940, 20, (40, 40, 40)),
        ("North: Reserve Forest Compartment RF-14", 980, 18, (60, 60, 60)),
        ("South: Traditional Village Stream (Nala)", 1010, 18, (60, 60, 60)),
        ("East: Agricultural Land of Ramu Majhi (FRA-OD-MAY-001)", 1040, 18, (60, 60, 60)),
        ("West: Sal Agroforestry Patch", 1070, 18, (60, 60, 60)),
        
        ("---------------------------------------------------------------------------------------------------------", 1120, 16, (180, 180, 180)),
        ("This Title Deed confers inheritable, non-transferable, and non-alienable rights", 1160, 16, (70, 70, 70)),
        ("over the specified forest land parcel under the Scheduled Tribes and Other Traditional", 1185, 16, (70, 70, 70)),
        ("Forest Dwellers (Recognition of Forest Rights) Act, 2006.", 1210, 16, (70, 70, 70)),
        
        ("Sub-Divisional Level Committee (SDLC)", 1400, 16, (50, 50, 50)),
        ("District Level Committee (DLC)", 1400, 16, (50, 50, 50)),
        ("District Magistrate & Collector, Mayurbhanj", 1430, 18, (20, 20, 20)),
    ]

    for item in lines:
        text, y, size, color = item
        # Simple default font rendering
        draw.text((100, y), text, fill=color)

    # Save as PNG
    png_path = os.path.join(out_dir, "sample_fra_patta_odisha.png")
    img.save(png_path)
    print(f"Created: {png_path}")

    # Save as PDF
    pdf_path = os.path.join(out_dir, "sample_fra_patta_odisha.pdf")
    img.save(pdf_path, "PDF", resolution=100.0)
    print(f"Created: {pdf_path}")

    # 2. Generate Sample GeoJSON boundary matching this parcel
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "claim_id": "FRA-OD-MAY-009",
                    "applicant_name": "Sanatan Soren",
                    "village": "Baripada",
                    "district": "Mayurbhanj",
                    "state": "Odisha",
                    "survey_number": "PLOT-889/B",
                    "area_claimed_hectares": 2.80,
                    "land_use": "Agriculture & Homestead"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [86.751200, 21.941500],
                            [86.753800, 21.942900],
                            [86.755100, 21.941200],
                            [86.753900, 21.939800],
                            [86.751800, 21.940100],
                            [86.751200, 21.941500]
                        ]
                    ]
                }
            }
        ]
    }
    geojson_path = os.path.join(out_dir, "sample_boundary_baripada.geojson")
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)
    print(f"Created: {geojson_path}")

    # 3. Generate KML boundary format
    kml_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>FRA Land Boundary - Sanatan Soren</name>
    <description>Claim ID: FRA-OD-MAY-009, Mayurbhanj, Odisha</description>
    <Placemark>
      <name>FRA-OD-MAY-009</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              86.751200,21.941500,0
              86.753800,21.942900,0
              86.755100,21.941200,0
              86.753900,21.939800,0
              86.751800,21.940100,0
              86.751200,21.941500,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>"""
    kml_path = os.path.join(out_dir, "sample_boundary_baripada.kml")
    with open(kml_path, "w", encoding="utf-8") as f:
        f.write(kml_content)
    print(f"Created: {kml_path}")

if __name__ == "__main__":
    generate_sample_patta_image_and_pdf()
