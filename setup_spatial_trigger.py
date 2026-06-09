from sqlalchemy import create_engine, text

# Connect to the Supabase database
engine = create_engine("postgresql://postgres:GripGoaProject2026@db.ytmuudbkuhkfqkzchtce.supabase.co:5432/postgres")

print("Applying Geo-Spatial Trigger to Database...")

with engine.begin() as conn:
    # 1. Backfill all existing reports that have a missing village_name
    result = conn.execute(text("""
        UPDATE reports r
        SET village_name = v.village_name
        FROM goa_villages v
        WHERE r.village_name IS NULL
          AND r.latitude IS NOT NULL
          AND r.longitude IS NOT NULL
          AND ST_Contains(v.geom, ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326));
    """))
    print(f"✅ Successfully backfilled {result.rowcount} existing reports with their Goa Village name!")

    # 2. Create the Trigger Function to do this automatically in the future
    conn.execute(text("""
        CREATE OR REPLACE FUNCTION assign_village_to_report()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
                SELECT village_name INTO NEW.village_name
                FROM goa_villages
                WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326))
                LIMIT 1;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))

    # 3. Attach the Trigger to the reports table
    conn.execute(text("""
        DROP TRIGGER IF EXISTS trigger_assign_village ON reports;
        CREATE TRIGGER trigger_assign_village
        BEFORE INSERT OR UPDATE OF latitude, longitude ON reports
        FOR EACH ROW
        WHEN (NEW.village_name IS NULL)
        EXECUTE FUNCTION assign_village_to_report();
    """))
    
    print("✅ Successfully installed the automated PostGIS Spatial Trigger!")
    print("All future reports will now automatically get their village_name assigned natively by the database.")
