import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def list_storage():
    try:
        # List files in the 'reports' bucket
        # Note: 'uploads/sensors' might be a folder prefix
        res = supabase.storage.from_('reports').list('uploads/sensors')
        if res:
            print(f"Found {len(res)} files in uploads/sensors")
            for f in res[:10]:
                print(f"File: {f['name']}, Created: {f['created_at']}")
        else:
            print("No files found in uploads/sensors")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_storage()
