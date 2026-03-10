import psycopg2
import sys

# The connection string provided by the user
DB_URL = "postgresql://postgres:Adarsh%40123@db.ytmuudbkuhkfqkzchtce.supabase.co:5432/postgres"

def create_tables():
    print("🔌 Connecting to Supabase Postgres Database...")
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        print("🔨 Connected! Creating 'reports' table if it doesn't exist...")
        create_reports_query = """
        CREATE TABLE IF NOT EXISTS public.reports (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            issue_type TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            timestamp BIGINT,
            image_path TEXT,
            ai_predictions JSONB
        );
        """
        cur.execute(create_reports_query)
        
        print("🔨 Creating 'sensors' table if it doesn't exist...")
        create_sensors_query = """
        CREATE TABLE IF NOT EXISTS public.sensors (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            batch_id TEXT,
            reading_count INTEGER,
            local_file_path TEXT
        );
        """
        cur.execute(create_sensors_query)
        
        print("🔨 Creating 'server_status' table if it doesn't exist...")
        create_server_status_query = """
        CREATE TABLE IF NOT EXISTS public.server_status (
            id INTEGER PRIMARY KEY,
            last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            status TEXT
        );
        INSERT INTO public.server_status (id, status) VALUES (1, 'offline') ON CONFLICT (id) DO NOTHING;
        """
        cur.execute(create_server_status_query)

        # Commit the transaction
        conn.commit()
        print("✅ Success! All tables exist and are ready for FastAPI & Worker.")
        
    except Exception as e:
        print(f"❌ Error setting up tables: {e}")
    finally:
        if 'conn' in locals() and conn:
            cur.close()
            conn.close()
            print("🔌 Connection closed.")

if __name__ == "__main__":
    create_tables()
