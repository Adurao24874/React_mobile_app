import os
import json
from shapely.geometry import shape, Point
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'grip'))
from test_depts import supabase

# Load GeoJSON
GOA_VILLAGES = []
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
geojson_path = os.path.join(BASE_DIR, '..', 'grip-dashboard', 'goa_villages.geojson')
try:
    with open(geojson_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for feature in data.get('features', []):
            poly = shape(feature['geometry'])
            name = feature['properties'].get('NAME', 'Unknown Village')
            GOA_VILLAGES.append((name, poly))
    print(f"Loaded {len(GOA_VILLAGES)} village boundaries.")
except Exception as e:
    print(f"Failed to load geojson: {e}")
    exit(1)

def get_village_name(lat, lon):
    if not lat or not lon: return None
    pt = Point(lon, lat)
    for name, poly in GOA_VILLAGES:
        if poly.contains(pt):
            return name
    return None

print("Fetching reports...")
res = supabase.table('reports').select('id, latitude, longitude').execute()
reports = res.data

updated = 0
for r in reports:
    lat = r.get('latitude')
    lon = r.get('longitude')
    if lat and lon:
        v_name = get_village_name(lat, lon)
        if v_name:
            # Update report
            supabase.table('reports').update({'village_name': v_name}).eq('id', r['id']).execute()
            updated += 1
            if updated % 10 == 0:
                print(f"Updated {updated} reports...")

print(f"Done! Mapped and updated {updated} out of {len(reports)} reports.")
