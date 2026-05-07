import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def check_segments():
    try:
        # Get a few sample segments
        res = supabase.table('road_segments').select('*').limit(10).execute()
        if res.data:
            print("Sample Segments:")
            for row in res.data:
                print(f"ID: {row.get('segment_id')}, Label: {row.get('label')}, RMS: {row.get('avg_rms')}, Lateral: {row.get('lateral_variance')}")
        else:
            print("No segments found.")
            
        # Count labels
        res = supabase.table('road_segments').select('label').execute()
        labels = {}
        for row in res.data:
            l = row.get('label')
            labels[l] = labels.get(l, 0) + 1
        print("\nLabel Counts:")
        for l, count in labels.items():
            print(f"{l}: {count}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_segments()
