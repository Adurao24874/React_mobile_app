import psycopg2
import sys

# The connection string provided in setup_db.py
DB_URL = "postgresql://postgres:Adarsh%40123@db.ytmuudbkuhkfqkzchtce.supabase.co:5432/postgres"

NEW_COLORS = {
    'GOOD': '#22c55e',
    'BAD': '#ef4444',
    'POTHOLE': '#dc2626',
    'HUMP': '#3b82f6'
}

def update_colors():
    print("🔌 Connecting to Supabase Postgres Database...")
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        print("🔨 Updating colors in 'road_conditions' table...")
        
        total_updated = 0
        for label, color in NEW_COLORS.items():
            query = "UPDATE public.road_conditions SET color_hex = %s WHERE condition_label = %s AND color_hex != %s"
            cur.execute(query, (color, label, color))
            updated = cur.rowcount
            total_updated += updated
            print(f"   ✅ Updated {updated} rows for label '{label}' to color '{color}'")
            
        # Commit the transaction
        conn.commit()
        print(f"✨ Success! Total rows updated: {total_updated}")
        
    except Exception as e:
        print(f"❌ Error updating colors: {e}")
    finally:
        if 'conn' in locals() and conn:
            cur.close()
            conn.close()
            print("🔌 Connection closed.")

if __name__ == "__main__":
    update_colors()
