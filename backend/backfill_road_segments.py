import os
import json
import sys
from shapely.geometry import shape, Point

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

def main():
    print("Fetching road segments...")
    segments = []
    from_idx = 0
    while True:
        res = supabase.table('road_segments').select('segment_id, latitude, longitude').range(from_idx, from_idx + 999).execute()
        data = res.data
        if not data: break
        segments.extend(data)
        from_idx += 1000
    
    if not segments:
        print("No road segments found.")
        return

    print(f"Found {len(segments)} road segments. Processing...")
    
    updated = 0
    batch = []
    
    for s in segments:
        lat = s.get('latitude')
        lon = s.get('longitude')
        if lat and lon:
            v_name = get_village_name(lat, lon)
            if v_name:
                batch.append({
                    "segment_id": s['segment_id'],
                    "village_name": v_name
                })
                
                # Upsert in chunks of 50
                if len(batch) >= 50:
                    try:
                        supabase.table('road_segments').upsert(batch).execute()
                        updated += len(batch)
                        print(f"Updated {updated} segments...")
                        batch = []
                    except Exception as e:
                        print(f"Failed to upsert batch: {e}")
    
    if batch:
        try:
            supabase.table('road_segments').upsert(batch).execute()
            updated += len(batch)
            print(f"Updated {updated} segments...")
        except Exception as e:
            print(f"Failed to upsert final batch: {e}")

    print(f"Done! Mapped and updated {updated} out of {len(segments)} road segments.")

if __name__ == "__main__":
    main()
