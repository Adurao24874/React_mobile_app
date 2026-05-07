import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def check_conditions():
    try:
        # Get a few sample conditions
        res = supabase.table('road_conditions').select('*').limit(10).execute()
        if res.data:
            print("Sample Road Conditions:")
            for row in res.data:
                print(f"ID: {row.get('id')}, Label: {row.get('condition_label')}, Lat: {row.get('latitude')}, Lng: {row.get('longitude')}")
        else:
            print("No road_conditions found.")
            
        # Count labels
        res = supabase.table('road_conditions').select('condition_label').execute()
        labels = {}
        for row in res.data:
            l = row.get('condition_label')
            labels[l] = labels.get(l, 0) + 1
        print("\nLabel Counts (road_conditions):")
        for l, count in labels.items():
            print(f"{l}: {count}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_conditions()
