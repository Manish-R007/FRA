from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from app.core.database import Base

class SatelliteAnalysis(Base):
    __tablename__ = "satellite_analyses"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("fra_claims.id"), nullable=False, index=True)
    geometry_id = Column(Integer, ForeignKey("fra_geometries.id"), nullable=True)
    satellite_source = Column(String(100), default="COPERNICUS/S2_HARMONIZED")
    acquisition_date = Column(String(50), nullable=False)
    cloud_percentage = Column(Float, default=0.0)
    image_url = Column(String(500), nullable=True)  # True color RGB image URL
    false_color_url = Column(String(500), nullable=True)  # Color infrared (CIR) URL
    ndvi_url = Column(String(500), nullable=True)  # NDVI raster URL
    ndwi_url = Column(String(500), nullable=True)  # NDWI raster URL
    ndbi_url = Column(String(500), nullable=True)  # NDBI raster URL
    mean_ndvi = Column(Float, nullable=True)
    mean_ndwi = Column(Float, nullable=True)
    mean_ndbi = Column(Float, nullable=True)
    processing_status = Column(String(50), default="COMPLETED")  # PENDING, PROCESSING, COMPLETED, FAILED
    model_name = Column(String(100), default="SegFormer-B2-RemoteSensing")
    model_version = Column(String(50), default="v2.1.0")
    confidence = Column(Float, default=0.89)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class LandCoverStatistic(Base):
    __tablename__ = "land_cover_statistics"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("satellite_analyses.id"), nullable=False, index=True)
    class_name = Column(String(50), nullable=False)  # forest, crop, water, building, bare_land, grassland, road, other
    pixel_count = Column(Integer, nullable=False)
    area_m2 = Column(Float, nullable=False)
    area_hectares = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)  # Percentage of total valid area
    confidence = Column(Float, default=0.90)


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("fra_claims.id"), nullable=False, index=True)
    analysis_id = Column(Integer, ForeignKey("satellite_analyses.id"), nullable=True)
    asset_type = Column(String(50), nullable=False)  # forest, crop, pond, water_body, building, homestead, road, farm
    geometry = Column(Text, nullable=False)  # GeoJSON polygon/point/linestring
    area_m2 = Column(Float, nullable=True)
    confidence = Column(Float, default=0.85)
    model_name = Column(String(100), default="SAM-v2+SegFormer")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
