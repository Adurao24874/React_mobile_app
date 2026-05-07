import psycopg2

DB_URL = "postgresql://postgres:Adarsh%40123@db.ytmuudbkuhkfqkzchtce.supabase.co:5432/postgres"

def add_columns():
    print("Connecting to Supabase Postgres...")
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        print("Adding 'swerving_hits' column...")
        cur.execute("ALTER TABLE public.road_segments ADD COLUMN IF NOT EXISTS swerving_hits INTEGER DEFAULT 0;")
        
        print("Adding 'clear_hits' column...")
        cur.execute("ALTER TABLE public.road_segments ADD COLUMN IF NOT EXISTS clear_hits INTEGER DEFAULT 0;")
        
        print("Adding 'session_hits' column (text array)...")
        cur.execute("ALTER TABLE public.road_segments ADD COLUMN IF NOT EXISTS session_hits TEXT[] DEFAULT '{}';")
        
        conn.commit()
        print("Success! Columns added to 'road_segments'.")
        
    except Exception as e:
        print(f"Error adding columns: {e}")
    finally:
        if 'conn' in locals() and conn:
            cur.close()
            conn.close()
            print("Connection closed.")

if __name__ == "__main__":
    add_columns()
