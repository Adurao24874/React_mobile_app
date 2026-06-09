import time
from worker import supabase, get_village_name

def backfill_road_segments():
    print("Fetching road segments without village_name...")
    # we need to get items where village_name is null
    res = supabase.table('road_segments').select('segment_id, latitude, longitude').is_('village_name', 'null').limit(5000).execute()
    data = res.data
    print(f"Found {len(data)} road segments to backfill.")
    
    updates = []
    for row in data:
        lat, lon = row['latitude'], row['longitude']
        v_name = get_village_name(lat, lon)
        if v_name:
            updates.append({
                'segment_id': row['segment_id'],
                'village_name': v_name
            })
    
    print(f"Generated {len(updates)} updates. Updating in batches of 100...")
    for i in range(0, len(updates), 100):
        batch = updates[i:i+100]
        supabase.table('road_segments').upsert(batch).execute()
        print(f"Updated {i+len(batch)}/{len(updates)}")
        time.sleep(0.1)

    print("Done!")

if __name__ == "__main__":
    backfill_road_segments()
