import os
from supabase import create_client, Client

# Credentials from worker.py
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

NEW_COLORS = {
    'GOOD': '#22c55e',
    'BAD': '#ef4444',
    'POTHOLE': '#dc2626',
    'HUMP': '#3b82f6'
}

def update_colors():
    print("🔌 Connecting to Supabase via API...")
    try:
        total_updated = 0
        for label, color in NEW_COLORS.items():
            print(f"🔨 Updating color for label '{label}' to '{color}'...")
            
            # Use Supabase client to update
            res = supabase.table('road_conditions')\
                .update({'color_hex': color})\
                .eq('condition_label', label)\
                .neq('color_hex', color)\
                .execute()
            
            updated = len(res.data) if res.data else 0
            total_updated += updated
            print(f"   ✅ Updated {updated} rows.")
            
        print(f"✨ Success! Total rows updated: {total_updated}")
        
    except Exception as e:
        print(f"❌ Error updating colors: {e}")

if __name__ == "__main__":
    update_colors()
