# Copernicus Sentinel Hub Integration Guide

Comprehensive technical documentation for the **Copernicus Sentinel Hub (Copernicus Data Space Ecosystem - CDSE)** integration within the Forest Rights Act (FRA) Atlas and WebGIS Decision Support System.

---

## Table of Contents

1. [Architecture & Separation of Concerns](#1-architecture--separation-of-concerns)
2. [Copernicus Sentinel Hub Authentication](#2-copernicus-sentinel-hub-authentication)
3. [Environment Variables & Configuration](#3-environment-variables--configuration)
4. [How to Obtain CDSE Credentials](#4-how-to-obtain-cdse-credentials)
5. [Parcel Geometry & Strict AOI Clipping](#5-parcel-geometry--strict-aoi-clipping)
6. [Cloud Masking & SCL Classification](#6-cloud-masking--scl-classification)
7. [Spectral Visualizations (True Color RGB & Color Infrared CIR)](#7-spectral-visualizations-true-color-rgb--color-infrared-cir)
8. [Spectral Indices (NDVI, NDWI, NDBI)](#8-spectral-indices-ndvi-ndwi-ndbi)
9. [Parcel-Level Statistics Calculation](#9-parcel-level-statistics-calculation)
10. [API Reference & Endpoints](#10-api-reference--endpoints)
11. [How to Run the Backend & Frontend](#11-how-to-run-the-backend--frontend)
12. [Testing Procedure & Verification](#12-testing-procedure--verification)
13. [Limitations & Assumptions](#13-limitations--assumptions)

---

## 1. Architecture & Separation of Concerns

The integration strictly maintains the architectural boundary between **Human Visualization** and **Geospatial AI Decision Support**:

```
                                  Copernicus Sentinel-2 L2A Data
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
        VISUALIZATION PIPELINE                                        ANALYSIS PIPELINE
  (Evalscript v3 Color Mapping)                               (Float32 Pixel Arrays & SCL Mask)
                 │                                                             │
                 ▼                                                             ▼
  - True Color RGB (B04, B03, B02)                            - Numerical NDVI: (B08 - B04)/(B08 + B04)
  - Color Infrared CIR (B08, B04, B03)                        - Numerical NDWI: (B03 - B08)/(B03 + B08)
  - Colorized NDVI (RdYlGn Ramp)                              - Numerical NDBI: (B11 - B08)/(B11 + B08)
  - Colorized NDWI (RdYlBu Ramp)                              - SCL Cloud Masking (0,1,3,7,8,9,10 filtered)
  - Colorized NDBI (Settlement Ramp)                                           │
                 │                                                             ▼
                 ▼                                            - Min, Max, Mean, Median, Std Dev, Pixel Count
    WebGIS Map ImageOverlay & UI                              - Land Cover % (Vegetation, Water, Built-up)
                 │                                                             │
                 ▼                                                             ▼
     Human Review & Inspection                                 Deterministic DSS Scheme Rules
                                                               (PM-KISAN, PMKSY, VDVY, PMAY-G)
```

> [!IMPORTANT]
> Government scheme convergence recommendations (DSS) consume purely numerical geospatial statistics (`mean_ndvi`, `crop_pct`, `water_pct`, etc.), NEVER image RGB colors or visual heuristics.

---

## 2. Copernicus Sentinel Hub Authentication

Sentinel Hub CDSE utilizes **OAuth2 Client Credentials Grant**:

- **Token URL:** `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`
- **Request Format:**
  ```http
  POST /auth/realms/CDSE/protocol/openid-connect/token HTTP/1.1
  Host: identity.dataspace.copernicus.eu
  Content-Type: application/x-www-form-urlencoded

  grant_type=client_credentials&client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>
  ```
- **Token Caching:** The backend service (`SentinelHubClient`) caches the `access_token` in memory with an expiration timestamp (`expires_in - 60s`). It reuses the active token across all parcel requests and automatically refreshes it prior to expiry.
- **Security:** Sentinel Hub credentials exist exclusively in backend environment variables and are **never** exposed to the frontend, API responses, or error traces.

---

## 3. Environment Variables & Configuration

Configure the following variables in `backend/.env`:

| Variable | Description | Default / Example Value |
|---|---|---|
| `SENTINEL_HUB_CLIENT_ID` | OAuth2 Client ID from CDSE | *(Set your client ID)* |
| `SENTINEL_HUB_CLIENT_SECRET` | OAuth2 Client Secret from CDSE | *(Set your client secret)* |
| `SENTINEL_HUB_TOKEN_URL` | OpenID Connect Token Endpoint | `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token` |
| `SENTINEL_HUB_PROCESS_URL` | Process API v1 Endpoint | `https://sh.dataspace.copernicus.eu/process/v1` |
| `SENTINEL_HUB_CATALOG_URL` | STAC Catalog API v1.0 Endpoint | `https://sh.dataspace.copernicus.eu/catalog/v1.0` |
| `SENTINEL_HUB_MAX_CLOUD_COVER` | Default maximum cloud threshold (%) | `20.0` |
| `SENTINEL_HUB_DEFAULT_RESOLUTION` | Default pixel resolution (meters) | `10.0` |

---

## 4. How to Obtain CDSE Credentials

1. Register an account at the official **Copernicus Data Space Ecosystem (CDSE)** portal: [https://dataspace.copernicus.eu/](https://dataspace.copernicus.eu/)
2. Navigate to the **User Account Dashboard** -> **OAuth Clients**: [https://identity.dataspace.copernicus.eu/auth/realms/CDSE/account](https://identity.dataspace.copernicus.eu/auth/realms/CDSE/account)
3. Click **Create Client**, name your application (e.g. `FRA-Atlas-DecisionSupport`), and select `Client Credentials` flow.
4. Copy the generated `Client ID` and `Client Secret` into `backend/.env`.

---

## 5. Parcel Geometry & Strict AOI Clipping

1. The parcel boundary is retrieved from the PostgreSQL/SQLite database (`FRAGeometry`).
2. Coordinate reference system is standard **EPSG:4326 (WGS84)** in `[longitude, latitude]` ordering.
3. The geometry is validated and repaired via `shapely.geometry.shape(geom).buffer(0)` if self-intersections exist.
4. When calling the Sentinel Hub Process API, the polygon is transmitted in `bounds.geometry`:
   ```json
   {
     "bounds": {
       "geometry": {
         "type": "Polygon",
         "coordinates": [[[86.74512, 21.93245], [86.74685, 21.93312], ...]]
       },
       "properties": {
         "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
       }
     }
   }
   ```
5. In Evalscript v3, `sample.dataMask === 0` identifies pixels outside the parcel polygon and renders them with full transparency (`[0, 0, 0, 0]`), guaranteeing strict parcel clipping.

---

## 6. Cloud Masking & SCL Classification

Sentinel-2 L2A provides a 20m Scene Classification Layer (SCL). The pipeline masks the following SCL classes:

| SCL Class ID | Classification | Mask Status |
|---|---|---|
| **0** | No Data | **Masked** |
| **1** | Saturated / Defective Pixel | **Masked** |
| **2** | Dark Area / Topographic Shadow | *Retained if valid* |
| **3** | Cloud Shadows | **Masked** |
| **4** | Vegetation | **Valid Pixel** |
| **5** | Bare Soil / Non-Vegetated | **Valid Pixel** |
| **6** | Water | **Valid Pixel** |
| **7** | Cloud Low Probability / Unclassified | **Masked** |
| **8** | Cloud Medium Probability | **Masked** |
| **9** | Cloud High Probability | **Masked** |
| **10** | Thin Cirrus | **Masked** |
| **11** | Snow / Ice | *Retained if valid* |

Only valid pixels inside the polygon and outside cloud/shadow areas are used for statistical aggregation.

---

## 7. Spectral Visualizations (True Color RGB & Color Infrared CIR)

### True Color RGB (B04, B03, B02)
- **Red:** Band 4 (Red, 665 nm)
- **Green:** Band 3 (Green, 560 nm)
- **Blue:** Band 2 (Blue, 490 nm)
- **Scaling:** Reflectance values are stretched by a factor of 2.5 and clamped to `[0, 255]`.

### Color Infrared CIR (B08, B04, B03)
- **Red:** Band 8 (NIR, 842 nm)
- **Green:** Band 4 (Red, 665 nm)
- **Blue:** Band 3 (Green, 560 nm)
- Generates false-color infrared where healthy chlorophyllic vegetation appears bright crimson red.

---

## 8. Spectral Indices (NDVI, NDWI, NDBI)

All indices are computed mathematically with division-by-zero protection (`denom > 0.0001`):

### Normalized Difference Vegetation Index (NDVI)
$$\text{NDVI} = \frac{\text{B08} - \text{B04}}{\text{B08} + \text{B04}}$$
- **Color Ramp:** Red ($<0.1$, bare), Yellow ($0.1 - 0.3$, sparse), Light Green ($0.3 - 0.5$, crops), Dark Green ($>0.5$, forest canopy).

### Normalized Difference Water Index (NDWI)
$$\text{NDWI} = \frac{\text{B03} - \text{B08}}{\text{B03} + \text{B08}}$$
- **Color Ramp:** Blue ($>0.1$, surface water), Teal-green ($-0.1 - 0.1$, moist soil), Tan/Red ($<-0.1$, dry soil).

### Normalized Difference Built-up Index (NDBI)
$$\text{NDBI} = \frac{\text{B11} - \text{B08}}{\text{B11} + \text{B08}}$$
- **Color Ramp:** Red ($>0.05$, built-up/settlement), Yellow ($-0.05 - 0.05$, mixed), Blue ($<-0.05$, vegetation/water).
- Native resolution of Band 11 (20m SWIR-1) is handled during resampling.

---

## 9. Parcel-Level Statistics Calculation

The endpoint `GET /api/sentinel/statistics/{parcel_id}` calculates:

1. **NDVI Metrics:**
   - Minimum, Maximum, Mean, Median, Standard Deviation ($\sigma$), Valid Pixel Count.
2. **NDWI Metrics:**
   - Minimum, Maximum, Mean, Valid Pixel Count.
3. **NDBI Metrics:**
   - Minimum, Maximum, Mean, Valid Pixel Count.
4. **Configurable Land Characteristics:**
   - $\text{Vegetation Area } \% = \frac{\text{Pixels with NDVI} \ge 0.40}{\text{Total Valid Pixels}} \times 100$
   - $\text{Water Area } \% = \frac{\text{Pixels with NDWI} > 0.05}{\text{Total Valid Pixels}} \times 100$
   - $\text{Built-up Area } \% = \frac{\text{Pixels with NDBI} > 0.05}{\text{Total Valid Pixels}} \times 100$

---

## 10. API Reference & Endpoints

| Endpoint | Method | Description | Example Query Parameters |
|---|---|---|---|
| `/api/sentinel/statistics/{parcel_id}` | `GET` | Numerical parcel statistics and metadata | `?start_date=2026-01-01&end_date=2026-08-01&max_cloud=20` |
| `/api/sentinel/true-color/{parcel_id}` | `GET` | True Color RGB layer metadata / image | `?format=json` or `?format=png` |
| `/api/sentinel/cir/{parcel_id}` | `GET` | Color Infrared CIR layer | `?format=json` or `?format=png` |
| `/api/sentinel/ndvi/{parcel_id}` | `GET` | NDVI layer | `?format=json` or `?format=png` |
| `/api/sentinel/ndwi/{parcel_id}` | `GET` | NDWI layer | `?format=json` or `?format=png` |
| `/api/sentinel/ndbi/{parcel_id}` | `GET` | NDBI layer | `?format=json` or `?format=png` |
| `/api/sentinel/image/{parcel_id}/{layer}` | `GET` | Direct PNG raster for WebGIS Leaflet overlays | Layer: `rgb`, `cir`, `ndvi`, `ndwi`, `ndbi` |
| `/api/sentinel/process/{parcel_id}` | `POST` | Full analysis pipeline + DSS execution | Requires Authenticated Officer Role |

### Example Response: `/api/sentinel/statistics/1`
```json
{
  "claim_id": "FRA-OD-MAY-001",
  "parcel_id": 1,
  "ndvi": {
    "min": 0.1542,
    "max": 0.8621,
    "mean": 0.6245,
    "median": 0.6410,
    "std_dev": 0.1432,
    "valid_pixel_count": 2380
  },
  "ndwi": {
    "min": -0.4210,
    "max": 0.1824,
    "mean": -0.1180,
    "median": -0.1240,
    "std_dev": 0.1082,
    "valid_pixel_count": 2380
  },
  "ndbi": {
    "min": -0.5120,
    "max": 0.1640,
    "mean": -0.2390,
    "median": -0.2450,
    "std_dev": 0.1145,
    "valid_pixel_count": 2380
  },
  "land_characteristics": {
    "vegetation_area_percentage": 78.45,
    "water_area_percentage": 4.12,
    "builtup_area_percentage": 3.85
  },
  "metadata": {
    "satellite_source": "Copernicus Sentinel-2 L2A (Surface Reflectance)",
    "platform": "Sentinel-2A/B (Harmonized L2A)",
    "acquisition_date": "2026-08-01",
    "cloud_coverage_percentage": 2.4,
    "processing_date": "2026-08-25T06:20:00Z",
    "resolution_meters": 10.0,
    "bands_used": ["B02 (Blue)", "B03 (Green)", "B04 (Red)", "B08 (NIR)", "B11 (SWIR-1)", "SCL"],
    "cloud_masking_applied": true,
    "masked_scl_classes": ["0 - No Data", "1 - Saturated / Defective", "3 - Cloud Shadows", "7 - Cloud Low Probability", "8 - Cloud Medium Probability", "9 - Cloud High Probability", "10 - Thin Cirrus"],
    "parcel_area_hectares": 2.38
  }
}
```

---

## 11. How to Run the Backend & Frontend

### 1. Start the Backend API
```powershell
cd d:\FRA-atlas-and-DSS\backend
$env:PYTHONPATH="."
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Start the Frontend Application
```powershell
cd d:\FRA-atlas-and-DSS\frontend
npm run dev
```
WebGIS application will be live at: [http://localhost:3000](http://localhost:3000)

---

## 12. Testing Procedure & Verification

Execute the test suite containing unit, integration, and endpoint tests:

```powershell
cd d:\FRA-atlas-and-DSS\backend
$env:PYTHONPATH="."
.\.venv\Scripts\pytest.exe -v
```

### Tested Capabilities:
- [x] CDSE OAuth2 token management and expiry handling
- [x] Evalscript v3 generation for all 6 layer types
- [x] Dynamic ground pixel dimension calculation
- [x] Full parcel spectral processing and statistics computation
- [x] SCL cloud masking and polygon boundary clipping
- [x] All 6 Sentinel API endpoints (`/statistics`, `/true-color`, `/cir`, `/ndvi`, `/ndwi`, `/ndbi`)
- [x] Direct image serving (`/image/{parcel_id}/{layer}`)
- [x] Error handling (invalid geometry, missing parcel, unknown layer)

---

## 13. Limitations & Assumptions

1. **Resolution:** Band 2, 3, 4, and 8 have a native spatial resolution of 10m; Band 11 (SWIR-1) has a native resolution of 20m.
2. **Cloud Threshold:** If cloud cover over the entire Sentinel-2 tile exceeds the configured threshold (default 20%), the catalog query searches for earlier low-cloud acquisitions within the specified date range.
3. **Offline / Unconfigured Mode:** If CDSE credentials are not set in `.env`, the service uses high-fidelity physical spectral simulation to allow continuous local development and testing.
