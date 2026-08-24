import json
import xml.etree.ElementTree as ET
from typing import Dict, Any, Tuple, List, Optional
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import transform
import pyproj
from app.core.config import settings

# Geodesic calculator on WGS84 ellipsoid
geod = pyproj.Geod(ellps="WGS84")

def calculate_geodesic_area(geojson_geom: Dict[str, Any]) -> Tuple[float, float]:
    """
    Calculates accurate geodesic area on WGS84 ellipsoid in square meters and hectares.
    Never uses planar approximation for EPSG:4326.
    """
    geom = shape(geojson_geom)
    if not geom.is_valid:
        geom = geom.buffer(0)  # Fix minor self-intersections
        
    if isinstance(geom, Polygon):
        poly_area, _ = geod.geometry_area_perimeter(geom)
        total_area_m2 = abs(poly_area)
    elif isinstance(geom, MultiPolygon):
        total_area_m2 = sum(abs(geod.geometry_area_perimeter(p)[0]) for p in geom.geoms)
    else:
        total_area_m2 = 0.0
        
    hectares = total_area_m2 / 10000.0
    return total_area_m2, hectares

def calculate_centroid_and_bbox(geojson_geom: Dict[str, Any]) -> Tuple[List[float], List[float]]:
    """
    Calculates the spatial centroid [lon, lat] and bounding box [minX, minY, maxX, maxY].
    """
    geom = shape(geojson_geom)
    centroid_pt = geom.centroid
    centroid = [round(centroid_pt.x, 6), round(centroid_pt.y, 6)]
    bounds = geom.bounds  # (minx, miny, maxx, maxy)
    bbox = [round(b, 6) for b in bounds]
    return centroid, bbox

def validate_and_process_geometry(
    geojson_geom: Dict[str, Any],
    claimed_area_hectares: float
) -> Dict[str, Any]:
    """
    Validates polygon geometry, checks for invalid topology, computes real geodesic area,
    computes area discrepancy against claimed Patta area, and flags for review if discrepancy > 5%.
    """
    if "type" not in geojson_geom or "coordinates" not in geojson_geom:
        raise ValueError("Invalid GeoJSON geometry: Missing type or coordinates")
    
    geom_type = geojson_geom.get("type")
    if geom_type not in ["Polygon", "MultiPolygon"]:
        raise ValueError(f"Unsupported geometry type: {geom_type}. Must be Polygon or MultiPolygon.")
    
    geom = shape(geojson_geom)
    if not geom.is_valid:
        geom = geom.buffer(0)
    
    if geom.is_empty:
        raise ValueError("Geometry is empty or degenerate")
        
    area_m2, area_ha = calculate_geodesic_area(geojson_geom)
    centroid, bbox = calculate_centroid_and_bbox(geojson_geom)
    
    # Calculate discrepancy percentage
    if claimed_area_hectares > 0:
        difference_pct = abs(claimed_area_hectares - area_ha) / claimed_area_hectares * 100.0
    else:
        difference_pct = 0.0
        
    flag_for_review = difference_pct > settings.AREA_DISCREPANCY_THRESHOLD_PERCENT
    
    return {
        "geometry": mapping(geom),
        "calculated_area_m2": round(area_m2, 2),
        "calculated_area_hectares": round(area_ha, 4),
        "claimed_area_hectares": round(claimed_area_hectares, 4),
        "area_difference_percentage": round(difference_pct, 2),
        "flag_for_review": flag_for_review,
        "centroid": centroid,
        "bbox": bbox,
        "geometry_status": "FLAGGED" if flag_for_review else "VALIDATED"
    }

def parse_kml_to_geojson(kml_content: str) -> Dict[str, Any]:
    """
    Parses a KML string and extracts polygon coordinates into GeoJSON Polygon/MultiPolygon format.
    """
    root = ET.fromstring(kml_content)
    # Handle KML namespace
    namespaces = {'kml': 'http://www.opengis.net/kml/2.2'}
    
    coordinates_nodes = root.findall('.//kml:coordinates', namespaces)
    if not coordinates_nodes:
        # Try without namespace
        coordinates_nodes = root.findall('.//coordinates')
        
    if not coordinates_nodes:
        raise ValueError("No coordinates found in KML file")
        
    polygons = []
    for coord_elem in coordinates_nodes:
        coord_text = coord_elem.text.strip()
        coords_raw = coord_text.split()
        ring = []
        for c in coords_raw:
            parts = c.split(',')
            if len(parts) >= 2:
                lon = float(parts[0])
                lat = float(parts[1])
                ring.append([lon, lat])
        if len(ring) >= 3:
            # Ensure ring is closed
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            polygons.append([ring])
            
    if not polygons:
        raise ValueError("Failed to extract valid polygon rings from KML")
        
    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    else:
        return {"type": "MultiPolygon", "coordinates": polygons}

def parse_geojson_file(content: str) -> Dict[str, Any]:
    """
    Parses a GeoJSON string (Feature, FeatureCollection, or Geometry) into a clean Geometry.
    """
    data = json.loads(content)
    if data.get("type") == "FeatureCollection":
        if not data.get("features"):
            raise ValueError("FeatureCollection is empty")
        feature = data["features"][0]
        return feature.get("geometry")
    elif data.get("type") == "Feature":
        return data.get("geometry")
    elif data.get("type") in ["Polygon", "MultiPolygon"]:
        return data
    else:
        raise ValueError(f"Unrecognized GeoJSON structure: {data.get('type')}")
