import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def verify():
    try:
        # Check for segments with null latitude
        res = supabase.table('road_segments').select('segment_id').is_('latitude', 'null').execute()
        null_lats = len(res.data)
        print(f"Segments with NULL latitude: {null_lats}")
        
        # Check for segments with 0 latitude
        res = supabase.table('road_segments').select('segment_id').eq('latitude', 0).execute()
        zero_lats = len(res.data)
        print(f"Segments with 0 latitude: {zero_lats}")
        
        # Get count of labeled segments
        res = supabase.table('road_segments').select('label').not_('label', 'is', 'null').execute()
        labeled_count = len(res.data)
        print(f"Total labeled segments: {labeled_count}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
