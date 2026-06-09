import json
import os
from shapely.geometry import shape

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
geojson_path = os.path.join(BASE_DIR, '..', 'grip-dashboard', 'goa_villages.geojson')
mapping_path = os.path.join(BASE_DIR, '..', 'grip', 'src', 'data', 'village_mapping.json')

with open(mapping_path, 'r', encoding='utf-8') as f:
    village_to_taluka = json.load(f)

taluka_bounds = {}

with open(geojson_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    for feature in data.get('features', []):
        poly = shape(feature['geometry'])
        name = feature['properties'].get('NAME', 'Unknown Village')
        taluka = village_to_taluka.get(name)
        if taluka:
            minx, miny, maxx, maxy = poly.bounds
            if taluka not in taluka_bounds:
                taluka_bounds[taluka] = [minx, miny, maxx, maxy]
            else:
                taluka_bounds[taluka][0] = min(taluka_bounds[taluka][0], minx)
                taluka_bounds[taluka][1] = min(taluka_bounds[taluka][1], miny)
                taluka_bounds[taluka][2] = max(taluka_bounds[taluka][2], maxx)
                taluka_bounds[taluka][3] = max(taluka_bounds[taluka][3], maxy)

# Format to print as TS code
print("export const TALUKA_BOUNDS: Record<string, {minLng: number, minLat: number, maxLng: number, maxLat: number}> = {")
for taluka, bounds in taluka_bounds.items():
    print(f'  "{taluka.lower()}": {{ minLng: {bounds[0]}, minLat: {bounds[1]}, maxLng: {bounds[2]}, maxLat: {bounds[3]} }},')
print("};")
