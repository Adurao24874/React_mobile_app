import json
import os

geojson_path = os.path.join(os.path.dirname(__file__), '..', 'grip-dashboard', 'goa_villages.geojson')
out_path = os.path.join(os.path.dirname(__file__), '..', 'grip', 'src', 'data', 'village_mapping.json')

os.makedirs(os.path.dirname(out_path), exist_ok=True)

mapping = {}

with open(geojson_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    for feature in data.get('features', []):
        name = feature['properties'].get('NAME', '')
        taluka = feature['properties'].get('SUB_DIST', '')
        if name and taluka:
            mapping[name] = taluka

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, indent=2)

print(f"Extracted {len(mapping)} village mappings to {out_path}")
