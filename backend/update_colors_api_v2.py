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
            # We remove the neq filter for now to be absolutely sure we hit everything
            res = supabase.table('road_conditions')\
                .update({'color_hex': color})\
                .eq('condition_label', label)\
                .execute()
            
            # If res.data is empty, it might be because the table has RLS or we need to specify count
            # but usually it returns the list of changed rows.
            # Let's count how many rows currently have this label but wrong color
            updated = len(res.data) if res.data else 0
            total_updated += updated
            print(f"   ✅ Done (Update triggered for label '{label}').")
            
        print(f"✨ Success! Migration triggered.")
        
    except Exception as e:
        print(f"❌ Error updating colors: {e}")

if __name__ == "__main__":
    update_colors()
