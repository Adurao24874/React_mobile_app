import os
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
        PAGE_SIZE = 1000
        
        while True:
            res = supabase.table('road_conditions').select('*').range(start, start + PAGE_SIZE - 1).execute()
            data = res.data
            if not data: break
            all_conditions.extend(data)
            print(f"   Fetched {len(all_conditions)} so far...")
            if len(data) < PAGE_SIZE: break
            start += PAGE_SIZE

        if not all_conditions:
            print("📭 No road_conditions found.")
            return

        print(f"📦 Total: {len(all_conditions)} condition points. Grouping...")
        segment_labels = defaultdict(lambda: 'GOOD')
        segment_prio = defaultdict(int)

        for c in all_conditions:
            lat = c.get('latitude')
            lng = c.get('longitude')
            label = c.get('condition_label')
            if not lat or not lng or not label: continue
            
            seg_x = int(lat / GRID_SIZE)
            seg_y = int(lng / GRID_SIZE)
            seg_id = f"{seg_x}_{seg_y}"
            
            prio = LABEL_PRIORITY.get(label.upper(), 0)
            if prio > segment_prio[seg_id]:
                segment_prio[seg_id] = prio
                segment_labels[seg_id] = label.upper()

        seg_count = len(segment_labels)
        print(f"⚙️ mapped to {seg_count} unique segments. Updating road_segments...")
        
        # We can use upsert to do this faster if we have segment_id as primary key
        # But we don't want to lose other columns.
        # Actually, road_segments has segment_id as unique identifier.
        
        updates = []
        for seg_id, label in segment_labels.items():
            updates.append({"segment_id": seg_id, "label": label})
            
            if len(updates) >= 100:
                print(f"   Upserting batch of {len(updates)}...")
                supabase.table('road_segments').upsert(updates, on_conflict='segment_id').execute()
                updates = []
        
        if updates:
            print(f"   Upserting last batch of {len(updates)}...")
            supabase.table('road_segments').upsert(updates, on_conflict='segment_id').execute()

        print("✨ Sync complete!")

    except Exception as e:
        print(f"❌ Sync failed: {e}")

if __name__ == "__main__":
    sync()
