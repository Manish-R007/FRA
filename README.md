# FRA ATLAS AI
### AI-Powered Forest Rights Act Atlas and WebGIS-Based Decision Support System (DSS)
**Ministry of Tribal Affairs (MoTA) • Smart India Hackathon (SIH) 2025**

---

## 🌲 System Overview

**FRA ATLAS AI** is a complete, production-ready prototype developed to solve the Ministry of Tribal Affairs problem statement:
> *"Development of AI-powered FRA Atlas and WebGIS-based Decision Support System (DSS) for Integrated Monitoring of Forest Rights Act (FRA) Implementation."*

The system digitizes FRA documents, manages Individual (IFR), Community (CR), and Community Forest Resource (CFR) claims, stores actual land boundaries on WGS84 ellipsoid coordinates (never artificial squares), visualizes claims on a high-performance WebGIS portal, retrieves Sentinel-2 satellite imagery, performs 8-class AI semantic land-cover segmentation and asset detection, and delivers transparent, rule-based government welfare scheme convergence (PM-KISAN, PMKSY, PMAY-G, VDVY, JJM, MGNREGA) grounded with RAG policy document citations.

---

## 🏛️ Key Architectural Pillars

### 1. Document OCR & Anti-Hallucination LLM Extraction
- Multi-format ingestion (`.pdf`, `.png`, `.jpg`, `.jpeg`).
- Digital PDF stream parser and adaptive grayscale/contrast/sharpening preprocessing with **Tesseract OCR** returning token confidences.
- LLM structured extraction converting raw text into strict JSON without inventing missing fields (`null` for unknown).
- **Split-Screen Human Verification Workstation** allowing officers to review, edit, confirm, or reject claims with cryptographic audit trails.

### 2. Actual Land Boundary Geodesic GIS Engine
- Accepts real multi-point geometries via **GeoJSON**, **KML**, **Shapefile**, and interactive Leaflet polygon drawing/vertex editing.
- Geodesic area calculation on WGS84 ellipsoid using `pyproj` and `shapely`.
- **Area Discrepancy Detection**: Compares claimed Patta area with GIS surveyed area. Flags discrepancies $> 5\%$ automatically with `FLAG FOR REVIEW`.

### 3. Sentinel-2 Remote Sensing & Spectral Indices
- Target satellite source: `COPERNICUS/S2_HARMONIZED`.
- Cloud filtering ($< 20\%$) and polygon clipping strictly to actual parcel boundaries.
- Multispectral index computations:
  - **NDVI** (Vegetation): $(B8 - B4) / (B8 + B4)$
  - **NDWI** (Water): $(B3 - B8) / (B3 + B8)$
  - **NDBI** (Built-up): $(B11 - B8) / (B11 + B8)$
- Renders True Color RGB, False Color Infrared (CIR), NDVI, NDWI, and NDBI raster overlays.

### 4. 8-Class Semantic Segmentation & Asset Vectorization
- Classifies pixels into 8 discrete classes: `forest`, `crop`, `water`, `building`, `bare_land`, `grassland`, `road`, and `other`.
- Computes pixel count, $m^2$ area, and percentages normalized strictly to $100.0\%$.
- Vectorizes continuous spatial clusters into discrete GeoJSON asset polygons (ponds, agricultural plots, forest stands, homesteads).

### 5. Deterministic Rules-Based Decision Support System & RAG
- Rule-based multi-factor evaluation across welfare schemes:
  - **PM-KISAN**: Approved IFR + $>15\%$ crop cover.
  - **PMKSY**: Crop cover $>20\%$ + Low surface water $<4\%$ $\to$ **HIGH Priority** Micro-Irrigation subsidy.
  - **PMAY-G**: Approved homestead rights under Section 3(1)(a) + stable ground $\to$ ₹1.30 Lakh housing grant.
  - **VDVY**: CFR/CR rights or $>30\%$ forest canopy $\to$ Van Dhan Vikas Kendra cluster grant.
  - **MGNREGA-FRA**: 150 days guaranteed wage labor + ₹2,00,000 land development grant.
  - **JJM**: Household tap water connections for tribal habitations.
- **RAG Vector Search**: Dense embeddings with cosine similarity retrieving official policy document quotes and page numbers for statutory justification.
- **Village Convergence Prioritization**: District and Block heatmap ranking villages by priority (`HIGH`, `MEDIUM`, `LOW`).

### 6. Cryptographic Audit Trail (SHA-256 Hash Chain)
- Immutable chained block logs:
  $$H_i = \text{SHA-256}(H_{i-1} \,\|\, \text{user\_id} \,\|\, \text{action} \,\|\, \text{entity} \,\|\, \text{entity\_id} \,\|\, \text{timestamp} \,\|\, \text{new\_value})$$
- Automated audit integrity validator testing chain continuity from the genesis hash.

---

## 👥 Role-Based Access Control (RBAC) Matrix

| Role | Claims Management | Document Verification | GIS & Polygon Drawing | Satellite Analysis | DSS & RAG | Schemes Management | Audit Logs |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **ADMIN** | Full Access | Full Access | Full Access | Full Access | Full Access | Full Access | Full Access |
| **STATE_OFFICER** | State Scoped | State Scoped | State Scoped | State Scoped | Full Access | Read Only | State Scoped |
| **DISTRICT_OFFICER** | District Scoped | District Scoped | District Scoped | District Scoped | District Scoped | Read Only | District Scoped |
| **FIELD_OFFICER** | Field Scoped | Field Scoped | Field Scoped | View | View | Read Only | No |
| **ANALYST** | View All | View All | Advanced GIS | Full Remote Sensing | Full Access | Read Only | View All |
| **CITIZEN** | Own Claims | View Status | View Boundary | View Analysis | View Recs | View Catalog | No |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+ (or Python 3.12)
- Node.js 18+ (or Node.js 22)
- Git & Docker (Optional)

### Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

# Run initial database seeder (seeds users, realistic claims, polygons, schemes, RAG docs)
python -m app.seed.seed_data

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Endpoint: [http://localhost:8000/health](http://localhost:8000/health)

### Running Backend Tests
```bash
cd backend
python -m pytest -v
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:3000](http://localhost:3000)

### Quick Demo Login Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **ADMIN** | `admin@fra.gov.in` | `Admin@2025!` |
| **STATE_OFFICER** | `state.officer@fra.gov.in` | `State@2025!` |
| **DISTRICT_OFFICER** | `district.officer@fra.gov.in` | `District@2025!` |
| **FIELD_OFFICER** | `field.officer@fra.gov.in` | `Field@2025!` |
| **ANALYST** | `analyst@fra.gov.in` | `Analyst@2025!` |
| **CITIZEN** | `citizen@fra.gov.in` | `Citizen@2025!` |

---

## 🐳 Docker Deployment

```bash
docker-compose up --build
```
This deploys:
1. `fra_backend_api` on port `8000`
2. `fra_frontend_webgis` on port `3000`
3. `fra_postgres_postgis` on port `5432`
4. `fra_redis` on port `6379`

---

## 📄 License & Attribution
Developed for the **Ministry of Tribal Affairs (MoTA)**, Government of India.
Smart India Hackathon 2025.
