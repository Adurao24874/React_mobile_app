import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def check_schema():
    try:
        # Get one row to see columns
        res = supabase.table('road_segments').select('*').limit(1).execute()
        if res.data:
            print("Columns in road_segments:")
            print(res.data[0].keys())
        else:
            print("No rows in road_segments")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
