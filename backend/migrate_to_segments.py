import os
import time
from datetime import datetime, timezone
from supabase import create_client, Client
from collections import defaultdict
import numpy as np

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

LABEL_PRIORITY = {
    'POTHOLE': 6,
    'HUMP': 5,
    'RUMBLE': 4,
    'BAD': 3,
    'MINOR': 2,
    'GOOD': 1,
    'UNKNOWN': 0
}

def fetch_all():
    print("Fetching existing road_conditions data...")
    all_data = []
    from_idx = 0
    page_size = 1000
    while True:
        try:
            res = supabase.table('road_conditions').select('*').range(from_idx, from_idx + page_size - 1).execute()
            if not res.data: break
            all_data.extend(res.data)
            if len(res.data) < page_size: break
            from_idx += page_size
            print(f"  Fetched {len(all_data)} points...")
        except Exception as e:
            print(f"  Retry fetching at {from_idx}: {e}")
            time.sleep(2)
    return all_data

all_conditions = fetch_all()
print(f"Loaded {len(all_conditions)} total points.")

print("Grouping into grid segments...")
segment_groups = defaultdict(list)
GRID_SIZE = 0.00003

for pt in all_conditions:
    lat = pt.get('latitude')
    lon = pt.get('longitude')
    if not lat or not lon or lat == 0 or lon == 0: continue
    
    cell_x = int(lat / GRID_SIZE)
    cell_y = int(lon / GRID_SIZE)
    segment_id = f"{cell_x}_{cell_y}"
    segment_groups[segment_id].append(pt)

print(f"Total unique segments to ensure: {len(segment_groups)}")

segments_to_upsert = []
now_iso = datetime.now(timezone.utc).isoformat()

for seg_id, items in segment_groups.items():
    batch_rms = float(np.mean([i.get('vibration_intensity', 0.0) for i in items if i.get('vibration_intensity') is not None]))
    batch_count = 50 * len(items)
    
    # Pick the most severe label
    batch_label = 'GOOD'
    max_prio = 0
    for i in items:
        prio = LABEL_PRIORITY.get(i.get('condition_label', 'GOOD'), 0)
        if prio > max_prio:
            max_prio = prio
            batch_label = i.get('condition_label', 'GOOD')
    
    segments_to_upsert.append({
        "segment_id": seg_id,
        "latitude": items[0].get('latitude'),
        "longitude": items[0].get('longitude'),
        "avg_rms": float(batch_rms),
        "condition_label": batch_label,
        "lateral_variance": 0.0,
        "sample_count": batch_count,
        "last_updated": now_iso
    })

print("Upserting segments in robust batches...")
chunk_size = 10
success_count = 0

for i in range(0, len(segments_to_upsert), chunk_size):
    chunk = segments_to_upsert[i:i + chunk_size]
    retries = 5
    while retries > 0:
        try:
            supabase.table('road_segments').upsert(chunk).execute()
            success_count += len(chunk)
            print(f"  [{i//chunk_size + 1}] Upserted {len(chunk)} segments...")
            break
        except Exception as e:
            retries -= 1
            print(f"  ⚠️ Error in batch {i//chunk_size + 1}: {e}. Retrying ({retries} left)...")
            time.sleep(5)
    if retries == 0:
        print(f"  ❌ Failed batch {i//chunk_size + 1} completely.")

print(f"✅ Final Migration Status: {success_count} segments processed/updated.")
