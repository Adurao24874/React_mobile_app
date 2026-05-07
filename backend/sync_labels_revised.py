import os
import time
import numpy as np
from collections import defaultdict
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

GRID_SIZE = 0.00003
LABEL_PRIORITY = {
    'POTHOLE': 6,
    'HUMP': 5,
    'RUMBLE': 4,
    'BAD': 3,
    'MINOR': 2,
    'GOOD': 1,
    'UNKNOWN': 0
}

def sync():
    try:
        print("🔍 Fetching ALL road_conditions with pagination...")
        all_conditions = []
        start = 0
        PAGE_SIZE = 500 # Smaller page size to avoid SSL issues
        
        while True:
            try:
                res = supabase.table('road_conditions').select('*').range(start, start + PAGE_SIZE - 1).execute()
                data = res.data
                if not data: break
                all_conditions.extend(data)
                print(f"   Fetched {len(all_conditions)} so far...")
                if len(data) < PAGE_SIZE: break
                start += PAGE_SIZE
            except Exception as e:
                print(f"   ⚠️ Page fetch failed, retrying in 2s: {e}")
                time.sleep(2)
                continue

        if not all_conditions:
            print("📭 No road_conditions found.")
            return

        print(f"📦 Total: {len(all_conditions)} condition points. Grouping...")
        segment_data = defaultdict(lambda: {"lats": [], "lngs": [], "labels": []})

        for c in all_conditions:
            lat = c.get('latitude')
            lng = c.get('longitude')
            label = c.get('condition_label')
            if not lat or not lng or not label: continue
            
            seg_x = int(lat / GRID_SIZE)
            seg_y = int(lng / GRID_SIZE)
            seg_id = f"{seg_x}_{seg_y}"
            
            segment_data[seg_id]["lats"].append(lat)
            segment_data[seg_id]["lngs"].append(lng)
            segment_data[seg_id]["labels"].append(label.upper())

        updates = []
        seg_count = len(segment_data)
        print(f"⚙️ Mapped to {seg_count} unique segments. Preparing upserts...")
        
        for i, (seg_id, data) in enumerate(segment_data.items()):
            avg_lat = float(np.mean(data["lats"]))
            avg_lng = float(np.mean(data["lngs"]))
            
            best_label = 'GOOD'
            max_prio = 0
            for l in data["labels"]:
                p = LABEL_PRIORITY.get(l, 0)
                if p > max_prio:
                    max_prio = p
                    best_label = l
            
            updates.append({
                "segment_id": seg_id,
                "latitude": avg_lat,
                "longitude": avg_lng,
                "label": best_label,
                "last_updated": "2026-03-24T21:15:00Z"
            })
            
            if len(updates) >= 30: # Smaller batch size for upserts
                print(f"   Upserting batch {i+1}/{seg_count}...")
                success = False
                while not success:
                    try:
                        supabase.table('road_segments').upsert(updates, on_conflict='segment_id').execute()
                        success = True
                    except Exception as e:
                        print(f"   ⚠️ Upsert failed, retrying: {e}")
                        time.sleep(2)
                updates = []
        
        if updates:
            print(f"   Upserting final batch...")
            supabase.table('road_segments').upsert(updates, on_conflict='segment_id').execute()

        print("✨ Sync complete! ALL points should now be visible.")

    except Exception as e:
        print(f"❌ Sync critical failure: {e}")

if __name__ == "__main__":
    sync()
