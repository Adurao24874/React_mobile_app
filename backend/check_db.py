from supabase import create_client, Client

# Credentials from worker.py
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def check_db():
    print("🔌 Connecting to Supabase via API...")
    try:
        # Fetch some records to see labels and colors
        res = supabase.table('road_conditions').select('condition_label, color_hex').limit(10).execute()
        if res.data:
            print("Current labels and colors in DB (limit 10):")
            for row in res.data:
                print(f"Label: {row['condition_label']}, Color: {row['color_hex']}")
        else:
            print("No records found in 'road_conditions'.")
            
        # Count unique labels
        # Note: Supabase/PostgREST doesn't support direct select distinct counts easily via client, 
        # so we fetch unique labels if possible or just check a larger sample.
        res_all = supabase.table('road_conditions').select('condition_label').limit(1000).execute()
        if res_all.data:
            labels = set(r['condition_label'] for r in res_all.data)
            print(f"Unique labels in sample: {labels}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_db()
