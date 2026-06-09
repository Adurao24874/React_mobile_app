import os
import json
from supabase import create_client, Client
from shapely.geometry import shape, Point

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

# 2. Load GeoJSON
GOA_VILLAGES = []
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
geojson_path = os.path.join(BASE_DIR, '..', 'grip-dashboard', 'goa_villages.geojson')

with open(geojson_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    for feature in data.get('features', []):
        poly = shape(feature['geometry'])
        name = feature['properties'].get('NAME', 'Unknown Village')
        GOA_VILLAGES.append((name, poly))

print(f"Loaded {len(GOA_VILLAGES)} villages.")

def get_village_name(lat, lon):
    if not lat or not lon: return None
    pt = Point(lon, lat)
    for name, poly in GOA_VILLAGES:
        if poly.contains(pt):
            return name
    return None

# 3. Fetch missing reports
res = supabase.table('reports').select('*').is_('village_name', 'null').execute()
reports = res.data
print(f"Found {len(reports)} reports missing village_name.")

updated = 0
for r in reports:
    if r.get('latitude') and r.get('longitude'):
        v_name = get_village_name(r['latitude'], r['longitude'])
        if v_name:
            supabase.table('reports').update({"village_name": v_name}).eq("id", r['id']).execute()
            updated += 1
            print(f"Updated {r['id']} -> {v_name}")

print(f"\nSuccessfully backfilled {updated} reports!")
