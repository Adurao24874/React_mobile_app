import os
import time
from datetime import datetime, timezone
from supabase import create_client, Client
from collections import defaultdict
import numpy as np
import math

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"

# Increase timeout
from supabase.lib.client_options import ClientOptions
opts = ClientOptions(postgrest_client_timeout=80) 
supabase: Client = create_client(URL, KEY, options=opts)

LABEL_PRIORITY = {
    'POTHOLE': 6,
    'HUMP': 5,
    'OBSTACLE': 4.5,
    'RUMBLE': 4,
    'BAD': 3,
    'MINOR': 2,
    'GOOD': 1,
    'UNKNOWN': 0
}

GRID_SIZE = 0.000018  # Approx 2x2 meters

def fetch_all():
    print("Fetching existing road_segments data...")
    all_data = []
    from_idx = 0
    page_size = 1000
    while True:
        try:
            res = supabase.table('road_segments').select('*').range(from_idx, from_idx + page_size - 1).execute()
            if not res.data: break
            all_data.extend(res.data)
            if len(res.data) < page_size: break
            from_idx += page_size
            print(f"  Fetched {len(all_data)} points...")
        except Exception as e:
            print(f"  Retry fetching at {from_idx}: {e}")
            time.sleep(2)
    return all_data

all_segments = fetch_all()
print(f"Loaded {len(all_segments)} total old segments.")

print("Grouping into new 0.000018 grid segments...")
segment_groups = defaultdict(list)

for pt in all_segments:
    lat = pt.get('latitude')
    lon = pt.get('longitude')
    if not lat or not lon or lat == 0 or lon == 0: continue
    
    cell_x = int(lat / GRID_SIZE)
    cell_y = int(lon / GRID_SIZE)
    new_seg_id = f"{cell_x}_{cell_y}"
    segment_groups[new_seg_id].append(pt)

print(f"Total NEW unique segments: {len(segment_groups)}")

segments_to_upsert = []
now_iso = datetime.now(timezone.utc).isoformat()

def sf(v): return 0.0 if math.isnan(float(v)) or math.isinf(float(v)) else float(v)

for seg_id, items in segment_groups.items():
    sid_x, sid_y = map(int, seg_id.split('_'))
    snapped_lat = (sid_x + 0.5) * GRID_SIZE
    snapped_lng = (sid_y + 0.5) * GRID_SIZE

    total_count = sum(i.get('sample_count', 0) for i in items)
    if total_count == 0:
        total_count = 50 * len(items)

    # Weighted average of RMS and lateral variance
    total_rms_weight = sum((i.get('avg_rms') or 0.0) * (i.get('sample_count') or 50) for i in items)
    total_lat_weight = sum((i.get('lateral_variance') or 0.0) * (i.get('sample_count') or 50) for i in items)

    new_rms = total_rms_weight / total_count if total_count > 0 else 0.0
    new_lateral = total_lat_weight / total_count if total_count > 0 else 0.0

    total_sw_hits = sum(i.get('swerving_hits', 0) for i in items)
    total_cl_hits = sum(i.get('clear_hits', 0) for i in items)
    
    # Merge session hits
    all_sessions = []
    for i in items:
        sh = i.get('session_hits')
        if isinstance(sh, list):
            all_sessions.extend(sh)
    unique_sessions = list(set(all_sessions))[:50]

    # Worst label wins
    batch_label = 'GOOD'
    max_prio = 0
    for i in items:
        # Check 'label' or 'condition_label' depending on old data formats
        lbl = i.get('label') or i.get('condition_label') or 'GOOD'
        prio = LABEL_PRIORITY.get(lbl, 0)
        if prio > max_prio:
            max_prio = prio
            batch_label = lbl
            
    # Apply obstacle rules if needed
    if total_sw_hits >= 3:
        batch_label = 'OBSTACLE'

    segments_to_upsert.append({
        "segment_id": seg_id,
        "latitude": sf(snapped_lat),
        "longitude": sf(snapped_lng),
        "avg_rms": sf(new_rms),
        "lateral_variance": sf(new_lateral),
        "sample_count": int(total_count),
        "label": batch_label,
        "swerving_hits": int(total_sw_hits),
        "clear_hits": int(total_cl_hits),
        "session_hits": unique_sessions,
        "last_updated": now_iso
    })

print(f"Deleting existing old segments to prevent duplicates...")
# To delete all rows safely, we can delete them in batches by ID or just delete all where segment_id is not null
delete_res = supabase.table('road_segments').delete().neq('segment_id', 'DUMMY_NEVER_MATCH').execute()
print(f"Deleted old segments. Status: {len(delete_res.data)} removed.")

print("Inserting new merged segments in robust batches...")
chunk_size = 50
success_count = 0

for i in range(0, len(segments_to_upsert), chunk_size):
    chunk = segments_to_upsert[i:i + chunk_size]
    retries = 5
    while retries > 0:
        try:
            supabase.table('road_segments').insert(chunk).execute()
            success_count += len(chunk)
            print(f"  [{i//chunk_size + 1}] Inserted {len(chunk)} segments...")
            break
        except Exception as e:
            retries -= 1
            print(f"  ⚠️ Error in batch {i//chunk_size + 1}: {e}. Retrying ({retries} left)...")
            time.sleep(3)
    if retries == 0:
        print(f"  ❌ Failed batch {i//chunk_size + 1} completely.")

print(f"✅ Final Migration Status: {success_count} / {len(segments_to_upsert)} new segments successfully inserted.")
