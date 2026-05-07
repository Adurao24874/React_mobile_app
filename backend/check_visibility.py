import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def check_visibility():
    try:
        # Check count
        res = supabase.table('road_segments').select('count', count='exact').execute()
        total = res.count
        print(f"Total segments: {total}")
        
        # Check a few labeled segments
        res = supabase.table('road_segments').select('*').not_('label', 'is', 'null').limit(5).execute()
        print("\nLabeled Segments (Sample):")
        for row in res.data:
            print(f"ID: {row.get('segment_id')}, Label: {row.get('label')}, Last Updated: {row.get('last_updated')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_visibility()
