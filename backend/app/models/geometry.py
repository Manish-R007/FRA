from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from datetime import datetime, timezone
from app.core.database import Base

class FRAGeometry(Base):
    __tablename__ = "fra_geometries"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("fra_claims.id"), nullable=False, index=True)
    # Stored as standard GeoJSON geometry JSON string / GeoJSON dictionary
    geometry = Column(Text, nullable=False)
    geometry_source = Column(String(50), nullable=False)  # DOCUMENT, GEOJSON, KML, SHAPEFILE, MANUAL, FIELD_SURVEY
    survey_reference = Column(String(100), nullable=True)
    calculated_area_m2 = Column(Float, nullable=False)  # Geodesic area in square meters
    calculated_area_hectares = Column(Float, nullable=False)  # Calculated area in hectares
    claimed_area_hectares = Column(Float, nullable=False)  # Area claimed in the document
    area_difference_percentage = Column(Float, default=0.0)  # Difference percentage
    flag_for_review = Column(Boolean, default=False)  # Set to true if area discrepancy > threshold
    centroid = Column(Text, nullable=True)  # JSON [longitude, latitude]
    bbox = Column(Text, nullable=True)  # JSON [minX, minY, maxX, maxY]
    geometry_status = Column(String(50), default="VALIDATED")  # VALIDATED, PENDING, CONFLICT, FLAGGED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
