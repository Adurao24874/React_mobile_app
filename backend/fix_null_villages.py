import json
import os
from shapely.geometry import shape, Point
from supabase import create_client

# 1. Initialize Supabase
supabase_url = os.environ.get("SUPABASE_URL", "https://ytmuudbkuhkfqkzchtce.supabase.co")
supabase_key = os.environ.get("SUPABASE_KEY", "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem")
supabase = create_client(supabase_url, supabase_key)

# 2. Load GeoJSON
GOA_VILLAGES = []
try:
    with open('goa_villages.geojson', 'r') as f:
        data = json.load(f)
        for feature in data['features']:
            name = feature['properties'].get('NAME_3') or feature['properties'].get('name')
            poly = shape(feature['geometry'])
            GOA_VILLAGES.append((name, poly))
    print(f"Loaded {len(GOA_VILLAGES)} village boundaries.")
except Exception as e:
    print(f"Error loading geojson: {e}")
    exit(1)

def get_village_name(lat, lon):
    if not lat or not lon: return None
    pt = Point(lon, lat)
    for name, poly in GOA_VILLAGES:
        if poly.contains(pt):
            return name
    return None

# 3. Fetch reports with NULL village_name
# 3. Fetch all reports to double check
reports = supabase.table('reports').select('*').execute()
pending_reports = [r for r in reports.data if not r.get('village_name')]

print(f"Found {len(pending_reports)} reports with NULL village name. Fixing...")

updated_count = 0
for report in pending_reports:
    lat = report.get('latitude')
    lon = report.get('longitude')
    
    if lat and lon:
        v_name = get_village_name(lat, lon)
        if v_name:
            print(f"Report {report['id'][:8]} -> {v_name}")
            supabase.table('reports').update({"village_name": v_name}).eq("id", report['id']).execute()
            updated_count += 1
        else:
            print(f"Report {report['id'][:8]} -> No match for coords {lat}, {lon}")

print(f"\nSuccessfully fixed {updated_count} records!")
