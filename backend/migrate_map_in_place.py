import os
import json
import time
import math
import numpy as np
import urllib.request
from datetime import datetime, timezone
from supabase import create_client, Client

# Hardcoded logic params from worker.py
GRID_SIZE = 0.000018
LATERAL_THRESHOLD = 0.5
COVERAGE_RATIO = 0.3
MIN_SAMPLES = 50

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"

# Increase timeout for large fetching
from supabase.lib.client_options import ClientOptions
opts = ClientOptions(postgrest_client_timeout=80) 
supabase: Client = create_client(URL, KEY, options=opts)

def reliable_execute(query_builder, retries=5):
    for i in range(retries):
        try:
            return query_builder.execute()
        except Exception as e:
            err_str = str(e).lower()
            if i < retries - 1 and ("ssl" in err_str or "eof" in err_str or "connection" in err_str or "timeout" in err_str):
                delay = 2 ** i
                print(f"        Connection glitch, retrying in {delay}s... ({i+1}/{retries})")
                time.sleep(delay)
                continue
            raise e

def sf(v): return 0.0 if math.isnan(float(v)) or math.isinf(float(v)) else float(v)

# -- OSM Junction Logic --
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JUNCTION_CELL_CACHE_PATH = os.path.join(BASE_DIR, "junction_cells.json")
JUNCTION_CELLS = set()

def _latlon_to_sid(lat, lon, grid_size=GRID_SIZE):
    return f"{int(lat / grid_size)}_{int(lon / grid_size)}"

def load_junction_cells():
    global JUNCTION_CELLS
    if os.path.exists(JUNCTION_CELL_CACHE_PATH):
        age_days = (datetime.now(timezone.utc) - datetime.fromtimestamp(
            os.path.getmtime(JUNCTION_CELL_CACHE_PATH), tz=timezone.utc
        )).days
        if age_days < 7:
            with open(JUNCTION_CELL_CACHE_PATH, 'r') as f:
                JUNCTION_CELLS = set(json.load(f))
            print(f"Loaded {len(JUNCTION_CELLS)} junction cells from cache.")
            return

    print("Fetching junction data from OpenStreetMap Overpass API...")
    query = """
    [out:json][timeout:60];
    (
      way["junction"="roundabout"]
        (14.8,73.6,15.9,74.35);
      node["highway"="traffic_signals"]
        (14.8,73.6,15.9,74.35);
      node["highway"="stop"]
        (14.8,73.6,15.9,74.35);
    );
    out geom;
    """
    try:
        url = "https://overpass-api.de/api/interpreter"
        data = urllib.request.urlopen(
            urllib.request.Request(
                url,
                data=query.encode('utf-8'),
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            ),
            timeout=60
        ).read()
        osm = json.loads(data)

        cells = set()
        for element in osm.get('elements', []):
            if element.get('type') == 'way':
                for node in element.get('geometry', []):
                    sid = _latlon_to_sid(node['lat'], node['lon'])
                    cells.add(sid)
                    x, y = map(int, sid.split('_'))
                    for dx in [-2, -1, 0, 1, 2]:
                        for dy in [-2, -1, 0, 1, 2]:
                            cells.add(f"{x+dx}_{y+dy}")

            elif element.get('type') == 'node':
                sid = _latlon_to_sid(element['lat'], element['lon'])
                x, y = map(int, sid.split('_'))
                for dx in [-2, -1, 0, 1, 2]:
                    for dy in [-2, -1, 0, 1, 2]:
                        cells.add(f"{x+dx}_{y+dy}")

        JUNCTION_CELLS = cells
        with open(JUNCTION_CELL_CACHE_PATH, 'w') as f:
            json.dump(list(JUNCTION_CELLS), f)
        print(f"Built and cached {len(JUNCTION_CELLS)} junction suppression cells.")

    except Exception as e:
        print(f"Overpass fetch failed, junction suppression disabled: {e}")
        JUNCTION_CELLS = set()

# -- Migration Execution --
def run_migration():
    print("--- Starting In-Place Map Migration ---")
    
    # 1. Load Junctions
    load_junction_cells()
    
    # 2. Download entire road_segments table
    print("Downloading all existing road segments...")
    page_size = 1000
    all_segments = []
    
    # Simple pagination fetch since we might have many points
    # NOTE: Since no offset/limit with ID, we'll just query repeatedly with a range
    # Or just fetch all using PostgREST standard limit
    last_id = None
    while True:
        query = supabase.table('road_segments').select('*').limit(page_size)
        if last_id:
            query = query.gt('segment_id', last_id)
        query = query.order('segment_id', desc=False)
        
        res = reliable_execute(query)
        data = res.data if res else []
        if not data:
            break
        all_segments.extend(data)
        last_id = data[-1]['segment_id']
        print(f"    ... fetched {len(all_segments)} rows")
        if len(data) < page_size:
            break
            
    print(f"Successfully loaded {len(all_segments)} segments.")
    if len(all_segments) == 0:
        print("Empty table. Exiting.")
        return

    # 3. Build fast lookup map
    existing_map = {row['segment_id']: row for row in all_segments}
    
    # 4. Process
    print("Recomputing grid snaps and predictive spatial avoidance...")
    updated_rows = []
    
    for seg in all_segments:
        seg_id = seg['segment_id']
        try:
            x, y = map(int, seg_id.split('_'))
        except ValueError:
            continue
        
        # A) Perfect Grid Snapping Fix
        snapped_lat = (x + 0.5) * GRID_SIZE
        snapped_lng = (y + 0.5) * GRID_SIZE
        
        # B) Spatial Analysis
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                n_id = f"{x + dx}_{y + dy}"
                if n_id in existing_map:
                    neighbors.append(existing_map[n_id])
                    
        old_label = seg.get('label') or 'GOOD'
        new_label = old_label
        sw_hits = seg.get('swerving_hits') or 0
        cl_hits = seg.get('clear_hits') or 0
        
        if neighbors:
            avg_neighbor_samples = float(np.mean([n.get('sample_count', 0) for n in neighbors]))
            avg_neighbor_lateral = float(np.mean([float(n.get('lateral_variance') or 0.0) for n in neighbors]))
            
            self_samples = float(seg.get('sample_count') or 0)
            coverage_ratio = (self_samples / avg_neighbor_samples if avg_neighbor_samples > 0 else 1.0)
            
            cond_a = coverage_ratio < COVERAGE_RATIO and self_samples >= MIN_SAMPLES
            cond_b = avg_neighbor_lateral > LATERAL_THRESHOLD
            
            if cond_a and cond_b and seg_id not in JUNCTION_CELLS:
                new_label = 'OBSTACLE'
            elif coverage_ratio >= COVERAGE_RATIO and old_label == 'OBSTACLE':
                # Heal it, traffic has returned to normal
                new_label = 'GOOD'
                sw_hits = 0
                cl_hits = 0
        else:
            # Fallback
            if sw_hits >= 3 and cl_hits < 3:
                new_label = 'OBSTACLE'
                
        # Only push fields that actually need updating
        updated_row = {
            "segment_id": seg_id,
            "latitude": sf(snapped_lat),
            "longitude": sf(snapped_lng),
            "label": new_label,
            "swerving_hits": int(sw_hits),
            "clear_hits": int(cl_hits)
        }
        updated_rows.append(updated_row)
        
    # 5. Upsert
    print(f"Upserting {len(updated_rows)} corrected rows back to Supabase...")
    success_count = 0
    for i in range(0, len(updated_rows), 100):
        chunk = updated_rows[i:i+100]
        try:
            reliable_execute(supabase.table('road_segments').upsert(chunk))
            success_count += len(chunk)
            print(f"    ... {success_count}/{len(updated_rows)}")
        except Exception as e:
            print(f"    Chunk Upsert Error: {e}")
            
    print("In-Place Map Migration Complete!")

if __name__ == "__main__":
    run_migration()
