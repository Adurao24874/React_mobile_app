import json
from sqlalchemy import create_engine, text

# Connect to your local database
# We are switching from the Pooler (port 6543) to the Direct Connection (port 5432)
engine = create_engine("postgresql://postgres:GripGoaProject2026@db.ytmuudbkuhkfqkzchtce.supabase.co:5432/postgres")

print("Loading GeoJSON file...")
with open('goa_villages.geojson', 'r') as f:
    geojson = json.load(f)

with engine.begin() as conn:
    # 1. Create the village table (Now including sub_district)
    conn.execute(text("""
        DROP TABLE IF EXISTS goa_villages;
        CREATE TABLE goa_villages (
            id SERIAL PRIMARY KEY,
            village_name VARCHAR(255),
            sub_district VARCHAR(255),
            geom GEOMETRY(MultiPolygon, 4326)
        );
    """))

    print("Table created. Inserting villages into PostGIS...")
    
    # 2. Loop through the file and insert each village
    for feature in geojson['features']:
        # Grab the exact uppercase keys from your GeoJSON properties!
        v_name = feature['properties'].get('NAME', 'Unknown Village') 
        sub_dist = feature['properties'].get('SUB_DIST', 'Unknown')
        
        # Convert the geometry coordinates back to a string for PostGIS
        geom_str = json.dumps(feature['geometry'])

        # Insert using the built-in PostGIS GeoJSON reader
        conn.execute(text("""
            INSERT INTO goa_villages (village_name, sub_district, geom)
            VALUES (:name, :sub_dist, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)))
        """), {"name": v_name, "sub_dist": sub_dist, "geom": geom_str})

print(f"✅ Successfully imported {len(geojson['features'])} villages into GRIP!")