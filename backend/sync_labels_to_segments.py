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
        print("🔍 Fetching all road_conditions...")
        # Fetch in pages if necessary, but 1000 might fit for now if small
        res = supabase.table('road_conditions').select('*').execute()
        conditions = res.data
        if not conditions:
            print("📭 No road_conditions found.")
            return

        print(f"📦 Found {len(conditions)} condition points. Grouping into segments...")
        segment_labels = defaultdict(lambda: 'GOOD')
        segment_prio = defaultdict(int)

        for c in conditions:
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
        print(f"⚙️ Mapped to {seg_count} segments. Syncing to road_segments table...")
        
        # Batch updates to be efficient
        updates = []
        for i, (seg_id, label) in enumerate(segment_labels.items()):
            # We only update segments that actually exist in road_segments
            # Use upsert with only segment_id and label? 
            # Actually, to avoid overwriting other data if they don't exist, we should check existence
            # or just use update by segment_id.
            
            try:
                supabase.table('road_segments').update({"label": label}).eq("segment_id", seg_id).execute()
                if (i + 1) % 50 == 0:
                    print(f"   Progress: {i+1}/{seg_count}")
            except Exception as e:
                print(f"   ⚠️ Error updating {seg_id}: {e}")

        print("✨ Sync complete!")

    except Exception as e:
        print(f"❌ Sync failed: {e}")

if __name__ == "__main__":
    sync()
