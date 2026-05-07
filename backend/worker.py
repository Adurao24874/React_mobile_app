import os
import time
import json
import asyncio
import math
import threading
import urllib.request
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client
from PIL import Image
from ultralytics import YOLO
from spatial_grid import map_to_region, get_region_key
from region_analysis import find_avoided_regions, find_hotspot_regions, compute_density_ratio
from statistics import compute_rms, compute_deviation, compute_peak_acceleration

# Thresholds for Avoidance Detection
LATERAL_THRESHOLD = 0.5   # Adjust based on real-world sensitivity
COVERAGE_RATIO = 0.3      # Segment is considered 'avoided' if samples < 30% of neighbors
MIN_SAMPLES = 50          # Minimum samples for label confidence

# 1. Initialize Supabase with hardened connection settings
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"

# Increase timeout to 80s for unstable Goa network / large payloads
from supabase.lib.client_options import ClientOptions
opts = ClientOptions(postgrest_client_timeout=80) 
supabase: Client = create_client(URL, KEY, options=opts)

GOA_BOUNDS = {
    "min_lat": 14.8,
    "max_lat": 15.9,
    "min_lng": 73.6,
    "max_lng": 74.35,
}


def is_in_goa(lat, lng):
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return False
    return (
        GOA_BOUNDS["min_lat"] <= lat <= GOA_BOUNDS["max_lat"]
        and GOA_BOUNDS["min_lng"] <= lng <= GOA_BOUNDS["max_lng"]
    )

# 2. Load the Local AI Models
print("Loading YOLO AI Models into Memory...")
try:
    # Safely get the absolute directory path where this worker.py file is located
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Dynamically build the OS-agnostic paths to the models
    garbage_model_path = os.path.join(BASE_DIR, "garbage.pt")
    pothole_model_path = os.path.join(BASE_DIR, "pothole.pt")
    
    garbage_model = YOLO(garbage_model_path)
    pothole_model = YOLO(pothole_model_path)
    
    print("✅ AI Models Loaded and Ready.")
except Exception as e:
    print(f"❌ Critical Error loading AI Models: {e}")
    exit(1)

# 3. Start Heartbeat Thread (Updated to also handle Storage Retention)
def heartbeat_worker():
    print("Starting Server Heartbeat & Retention Monitor...")
    last_cleanup = datetime.now(timezone.utc) - timedelta(hours=1)
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            # 1. Update Heartbeat
            supabase.table('sensors').upsert({
                "id": "11111111-1111-1111-1111-111111111111",
                "batch_id": "SERVER_HEARTBEAT",
                "status": "online",
                "local_file_path": now.isoformat()
            }).execute()

            # 2. Run Retention Cleanup every hour
            if (now - last_cleanup).total_seconds() > 3600:
                print("🧹 Running Storage Retention Cleanup (24-hour policy)...")
                cutoff = (now - timedelta(hours=24)).isoformat()
                
                # Cleanup Old Reports (Photos)
                old_reports = supabase.table('reports').select('image_path').eq('status', 'completed').lt('created_at', cutoff).execute()
                for r in old_reports.data:
                    path = r.get('image_path')
                    if path:
                        try:
                            supabase.storage.from_('reports').remove([path])
                            # Clear path in DB so we don't try to delete again next hour
                            supabase.table('reports').update({"image_path": None}).eq('image_path', path).execute()
                        except: pass
                
                # Cleanup Old Sensors (JSON Telemetry)
                old_sensors = supabase.table('sensors').select('local_file_path').eq('status', 'completed').lt('created_at', cutoff).execute()
                for s in old_sensors.data:
                    path = s.get('local_file_path')
                    if path and path != 'SERVER_HEARTBEAT':
                        try:
                            supabase.storage.from_('reports').remove([path])
                            supabase.table('sensors').update({"local_file_path": "CLEANED"}).eq('local_file_path', path).execute()
                        except: pass
                
                last_cleanup = now
                print("✨ Retention Cleanup Complete.")

        except Exception as e:
            print(f"⚠️ Heartbeat/Retention Warning: {e}")
        
        time.sleep(10)

threading.Thread(target=heartbeat_worker, daemon=True).start()


# Helper to normalize YOLO tensor outputs
def parse_yolo_results(results):
    predictions = []
    try:
        for res in results:
            boxes = getattr(res, 'boxes', None)
            if boxes is None: continue
            
            for box in boxes:
                conf = float(box.conf[0].item())
                cls_idx = int(box.cls[0].item())
                cls_name = res.names[cls_idx]
                
                predictions.append({
                    "class": cls_name,
                    "confidence": conf
                })
    except Exception as e:
        print(f"    ❌ parse_yolo_results crashed: {e}")
    return predictions

# Process a single pending image report
def process_report(report):
    print(f"\n--> Picking up Pending Report [{report['id']}]")
    image_path = report.get('image_path')
    if not image_path:
        print("    ⚠️ No image_path found, marking as failed.")
        supabase.table('reports').update({"status": "failed"}).eq("id", report['id']).execute()
        return

    # 1. Download payload directly from Supabase Storage into RAM
    print(f"    ⬇️ Downloading {image_path} from Storage...")
    try:
        # Supabase python client storage download returns bytes
        res = supabase.storage.from_('reports').download(image_path)
        # res is a bytes array
        
        # Save temp image relative to the script directory to avoid permission issues
        temp_img_path = os.path.join(BASE_DIR, 'temp_worker_img.jpg')
        with open(temp_img_path, 'wb') as f:
            f.write(res)
            
        pil_img = Image.open(temp_img_path).convert('RGB')
    except Exception as e:
        print(f"    ❌ Failed to download or read image: {e}")
        supabase.table('reports').update({"status": "failed"}).eq("id", report['id']).execute()
        return

    # 2. Run Inference
    print("    🧠 Running YOLO Inference...")
    predictions = []
    
    # Run Potholes
    p_res = pothole_model.predict(source=pil_img, conf=0.15, save=False, verbose=False)
    p_parsed = parse_yolo_results(p_res)
    predictions.extend(p_parsed)
    
    # Run Garbage
    g_res = garbage_model.predict(source=pil_img, conf=0.15, save=False, verbose=False)
    g_parsed = parse_yolo_results(g_res)
    predictions.extend(g_parsed)
    
    # Determine type
    original_type = report.get('issue_type', '')
    detected_type = original_type if original_type and original_type.lower() != 'auto' else 'Unknown'
    
    if predictions:
        predictions.sort(key=lambda x: x['confidence'], reverse=True)
        # Save the exact AI Prediction Class (e.g. 'deep_pothole', 'plastic_waste') per user request
        exact_class = str(predictions[0]['class'])
        detected_type = exact_class.replace('_', ' ').title()
            
    print(f"    ✅ Detection complete: {detected_type} with {len(predictions)} boxes")

    # 3. Push results back and complete the workflow
    print("    📤 Updating Database...")
    try:
        supabase.table('reports').update({
            "status": "completed",
            "issue_type": detected_type,
            "ai_predictions": json.dumps(predictions)
        }).eq("id", report['id']).execute()
    except Exception as e:
        print(f"    ❌ Database update failed: {e}")
        return

    # Results are updated in the DB, and the file is kept in Storage for 24h by the retention monitor
    print(f"--> 🏁 Finished Report [{report['id']}]\n")

def reliable_execute(query_builder, retries=5):
    for i in range(retries):
        try:
            return query_builder.execute()
        except Exception as e:
            err_str = str(e).lower()
            # Retry on SSL/Transport errors
            if i < retries - 1 and ("ssl" in err_str or "eof" in err_str or "connection" in err_str or "timeout" in err_str):
                delay = 2 ** i
                print(f"        Connection glitch, retrying in {delay}s... ({i+1}/{retries})")
                time.sleep(delay)
                continue
            raise e

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2.0)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def interpolate_segments(lat1, lon1, lat2, lon2, step=3.0):
    dist = haversine_m(lat1, lon1, lat2, lon2)
    if dist <= step: return []
    num_steps = int(dist // step)
    points = []
    for i in range(1, num_steps + 1):
        ratio = i / (num_steps + 1)
        points.append((lat1 + (lat2 - lat1) * ratio, lon1 + (lon2 - lon1) * ratio))
    return points

LABEL_PRIORITY = {
    'POTHOLE': 6,
    'HUMP': 5,
    'OBSTACLE': 4.5,
    'RUMBLE': 4,
    'BAD': 3,
    'MINOR': 2,
    'GOOD': 1,
    'UNKNOWN': 0
}

def fetch_neighbors(seg_id: str, existing_map: dict) -> list:
    """
    Given a segment_id like '833444_-226814', return the data rows
    for all 8 surrounding grid cells from the already-loaded existing_map.
    """
    try:
        x, y = map(int, seg_id.split('_'))
    except ValueError:
        return []
    
    neighbors = []
    for dx in [-1, 0, 1]:
        for dy in [-1, 0, 1]:
            if dx == 0 and dy == 0:
                continue  # skip self
            neighbor_id = f"{x + dx}_{y + dy}"
            if neighbor_id in existing_map:
                neighbors.append(existing_map[neighbor_id])
    return neighbors

JUNCTION_CELL_CACHE_PATH = os.path.join(BASE_DIR, "junction_cells.json")
JUNCTION_CELLS: set = set()

def _latlon_to_sid(lat, lon, grid_size=0.000018):
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
            print(f"✅ Loaded {len(JUNCTION_CELLS)} junction cells from cache.")
            return

    print("🌐 Fetching junction data from OpenStreetMap Overpass API...")
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
        print(f"✅ Built and cached {len(JUNCTION_CELLS)} junction suppression cells.")

    except Exception as e:
        print(f"⚠️ Overpass fetch failed, junction suppression disabled: {e}")
        JUNCTION_CELLS = set()

# Run once at startup
load_junction_cells()

def process_sensors(batch):
    print(f"\n--> Picking up Pending Sensor Batch [{batch.get('batch_id')}]")
    
    # Immediately mark as processing to prevent race conditions
    if not batch.get('id', '').startswith('local_import_'):
        supabase.table('sensors').update({"status": "processing"}).eq("id", batch['id']).execute()
        
    file_path = batch.get('local_file_path')
    
    # 1. Load JSON (from Storage or Local File)
    readings = []
    try:
        if batch.get('id', '').startswith('local_import_'):
            print(f"    📖 Reading local file: {file_path}")
            with open(file_path, 'r') as f:
                payload = json.load(f)
            readings = payload.get('readings', [])
        else:
            print(f"    ⬇️ Downloading {file_path} from Storage...")
            res = supabase.storage.from_('reports').download(file_path)
            payload = json.loads(res.decode('utf-8'))
            readings = payload.get('readings', [])
            
        print(f"    📊 Loaded {len(readings)} sensor samples into RAM")
    except Exception as e:
        print(f"    ❌ Failed to load sensors: {e}")
        if not batch.get('id', '').startswith('local_import_'):
            supabase.table('sensors').update({"status": "failed"}).eq("id", batch['id']).execute()
        return

    # 2. Run Python Telemetry Pipeline
    print("    🧠 Processing telemetry (High-Pass + Complementary Math)...")
    try:
        import pandas as pd
        from telemetry import classify_dataframe
        
        df = pd.DataFrame(readings)
        
        if df.empty:
            print("    ⚠️ Telemetry skipped: batch has 0 readings.")
            events = []
        else:
            df = df.rename(columns={
                'accelX': 'accel_x', 'accelY': 'accel_y', 'accelZ': 'accel_z',
                'gyroX': 'gyro_x', 'gyroY': 'gyro_y', 'gyroZ': 'gyro_z',
                'lat': 'latitude', 'lng': 'longitude'
            })
            
            if 'latitude' in df.columns and 'longitude' in df.columns:
                df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
                df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

            if 'speed' in df.columns:
                df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
                df = df[df['speed'] >= 2.0]
                
            events, _ = classify_dataframe(
                df,
                min_samples=50,
                use_gyro=True,
                axis_mode='gyro'
            )
        
        print(f"    🗺️ Extracted {len(events)} physical street map points.")
        
        # 3. SPATIAL AGGREGATION WITH INTERPOLATION
        if len(events) > 0:
            print(f"    📤 Aggregating and Interpolating {len(events)} events...")
            from collections import defaultdict
            import numpy as np
            
            segment_groups = defaultdict(list)
            GRID_SIZE = 0.000018  # Approx 2x2 meters
            
            def generate_sid(lat, lon):
                # Standardize grid cells for better merging and return EXACT snapped center
                sid_x = int(lat / GRID_SIZE)
                sid_y = int(lon / GRID_SIZE)
                snapped_lat = (sid_x + 0.5) * GRID_SIZE
                snapped_lng = (sid_y + 0.5) * GRID_SIZE
                return f"{sid_x}_{sid_y}", snapped_lat, snapped_lng

            sorted_events = sorted(events, key=lambda x: x['timestamp'])

            
            for i, ev in enumerate(sorted_events):
                lat_p, lng_p = ev['latitude'], ev['longitude']
                if lat_p is None or lng_p is None or math.isnan(lat_p) or math.isnan(lng_p) or (lat_p == 0 and lng_p == 0) or not is_in_goa(lat_p, lng_p):
                    continue
                
                # 3.1 Primary Point
                seg_p, snapped_lat, snapped_lng = generate_sid(lat_p, lng_p)
                # Store snapped coordinates in event to use as single source of truth
                ev['_snapped_lat'] = snapped_lat
                ev['_snapped_lng'] = snapped_lng
                segment_groups[seg_p].append(ev)
                
                # 3.2 Path Filling (Interpolate to next point if exists)
                if i < len(sorted_events) - 1:
                    next_ev = sorted_events[i+1]
                    time_gap = next_ev['timestamp'] - ev['timestamp']
                    spatial_gap = haversine_m(lat_p, lng_p, next_ev['latitude'], next_ev['longitude'])
                    
                    # Only interpolate if within 1s AND 10m
                    if time_gap < 1000 and spatial_gap < 10.0:
                        gaps = interpolate_segments(lat_p, lng_p, next_ev['latitude'], next_ev['longitude'])
                        for g_lat, g_lng in gaps:
                            g_seg, g_snapped_lat, g_snapped_lng = generate_sid(g_lat, g_lng)
                            if g_seg != seg_p:
                                # Create a virtual event for this segment, wiping out inherited hazard data
                                g_ev = ev.copy()
                                g_ev['latitude'], g_ev['longitude'] = g_lat, g_lng
                                g_ev['_snapped_lat'] = g_snapped_lat
                                g_ev['_snapped_lng'] = g_snapped_lng
                                g_ev['label'] = 'GOOD'
                                g_ev['vibration_intensity'] = 0.0
                                g_ev['lateral_variance'] = 0.0
                                g_ev['_is_interpolated'] = True
                                segment_groups[g_seg].append(g_ev)
            
            if not segment_groups:
                print("    ⚠️ No valid segments found.")
            else:
                print(f"    📦 Mapped into {len(segment_groups)} road segments.")
                expanded_seg_ids = set()
                for seg_id in segment_groups.keys():
                    try:
                        x, y = map(int, seg_id.split('_'))
                        for dx in [-1, 0, 1]:
                            for dy in [-1, 0, 1]:
                                expanded_seg_ids.add(f"{x + dx}_{y + dy}")
                    except ValueError:
                        continue
                
                seg_ids_list = list(expanded_seg_ids)
                existing_map = {}
                for i in range(0, len(seg_ids_list), 200):
                    chunk = seg_ids_list[i:i+200]
                    res = reliable_execute(supabase.table('road_segments').select('*').in_('segment_id', chunk))
                    if res.data:
                        for row in res.data: existing_map[row['segment_id']] = row
                
                segments_to_upsert = []
                now_iso = datetime.now(timezone.utc).isoformat()
                
                batch_id = batch.get('batch_id')
                if not batch_id or batch_id == 'unknown':
                    batch_id = f"unknown_{int(time.time())}"
                    
                def sf(v): return 0.0 if math.isnan(float(v)) or math.isinf(float(v)) else float(v)

                for seg_id, items in segment_groups.items():
                    # Check if all items are pure interpolations (path-filling only)
                    real_items = [i for i in items if not i.get('_is_interpolated')]
                    if not real_items:
                        continue # Don't write pure interpolation cells to the DB

                    batch_rms = float(np.mean([i['vibration_intensity'] for i in items]))
                    batch_count = sum([i.get('samples', 50) for i in items])
                    batch_lateral_var = float(np.mean([i.get('lateral_variance', 0.0) for i in items]))
                    
                    batch_label = 'GOOD'
                    max_prio = 0
                    for i in items:
                        p = LABEL_PRIORITY.get(i.get('label', 'GOOD'), 0)
                        if p > max_prio: max_prio = p; batch_label = i.get('label', 'GOOD')
                    
                    # Snap coordinates to grid center using the single source of truth
                    snapped_lat = items[0]['_snapped_lat']
                    snapped_lng = items[0]['_snapped_lng']

                    if seg_id in existing_map:
                        existing = existing_map[seg_id]
                        old_count = existing.get('sample_count') or 0
                        total_count = old_count + batch_count
                        new_rms = ((float(existing.get('avg_rms') or 0.0) * old_count) + (batch_rms * batch_count)) / total_count
                        new_lateral = ((float(existing.get('lateral_variance') or 0.0) * old_count) + (batch_lateral_var * batch_count)) / total_count
                        
                        # MULTI-SESSION AVOIDANCE & REPAIR LOGIC
                        sw_hits = existing.get('swerving_hits') or 0
                        cl_hits = existing.get('clear_hits') or 0
                        sess_hits = existing.get('session_hits') or []
                        
                        existing_label = existing.get('label') or 'GOOD'
                        existing_prio = LABEL_PRIORITY.get(existing_label, 0)
                        batch_prio = LABEL_PRIORITY.get(batch_label, 0)
                        
                        # TIME-BASED DECAY FOR GHOST OBSTACLES
                        last_updated = existing.get('last_updated')
                        if last_updated:
                            # Safely handle potential parsing issues
                            try:
                                # Supabase isoformat sometimes includes 'Z' or offset, replace Z with +00:00 for strict parsing
                                lu_str = last_updated.replace('Z', '+00:00')
                                age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(lu_str)).days
                                # Decay 1 swerving hit per 30 days of no new data
                                sw_hits = max(0, sw_hits - (age_days // 30))
                                
                                # Re-evaluate completely healed decayed obstacles from fresh data
                                if sw_hits == 0 and existing_label == 'OBSTACLE':
                                    existing_label = batch_label
                                    existing_prio = LABEL_PRIORITY.get(existing_label, 0) # Keep priority in sync
                            except Exception:
                                pass
                        
                        if batch_id not in sess_hits:
                            if batch_lateral_var > LATERAL_THRESHOLD:
                                sw_hits += 1
                                cl_hits = 0 # Reset clearing if we swerve again
                            elif batch_prio <= 2 and existing_prio > 2:
                                # Multi-person repair logic: road was bad, now reported good
                                cl_hits += 1
                            elif existing_label == 'OBSTACLE':
                                cl_hits += 1
                            elif batch_prio >= existing_prio and existing_prio > 2:
                                cl_hits = 0 # Only block healing for genuinely bad roads
                            
                            sess_hits.append(batch_id)
                            if len(sess_hits) > 50: sess_hits.pop(0)

                        final_label = existing_label
                        
                        # Upgrade immediately if new condition is worse
                        if batch_prio > existing_prio:
                            final_label = batch_label
                            
                        # If multiple people pass without issue, the road is fixed!
                        if cl_hits >= 3:
                            sw_hits = 0
                            cl_hits = 0
                            final_label = batch_label # Returns to normal (GOOD/MINOR)
                            
                        final_total_count = int(total_count)
                        final_rms = sf(new_rms)
                        final_lateral = sf(new_lateral)
                    else:
                        # New segments start with swerved_hits=1 if this batch swerved
                        sw_hits = 1 if batch_lateral_var > LATERAL_THRESHOLD else 0
                        cl_hits = 0
                        sess_hits = [batch_id]
                        final_label = batch_label # Labels don't become OBSTACLE on first hit
                        final_total_count = int(batch_count)
                        final_rms = sf(batch_rms)
                        final_lateral = sf(batch_lateral_var)

                    # ── PREDICTIVE SPATIAL AVOIDANCE ──────────────────
                    neighbors = fetch_neighbors(seg_id, existing_map)

                    if neighbors:
                        avg_neighbor_samples = float(np.mean([
                            n.get('sample_count', 0) for n in neighbors
                        ]))
                        avg_neighbor_lateral = float(np.mean([
                            float(n.get('lateral_variance') or 0.0) for n in neighbors
                        ]))
                        
                        self_samples = float(final_total_count)
                        coverage_ratio = (self_samples / avg_neighbor_samples
                                           if avg_neighbor_samples > 0 else 1.0)
                        
                        # Condition A: Path density (people avoiding this cell)
                        cond_a = coverage_ratio < COVERAGE_RATIO and self_samples >= MIN_SAMPLES

                        # Condition B: Neighbors confirm swerving around it
                        cond_b = avg_neighbor_lateral > LATERAL_THRESHOLD

                        if cond_a and cond_b and seg_id not in JUNCTION_CELLS:
                            final_label = 'OBSTACLE'
                        
                        # Autonomous resolution: traffic returns to normal
                        elif coverage_ratio >= COVERAGE_RATIO and final_label == 'OBSTACLE':
                            final_label = batch_label  # Road is clear again
                            sw_hits = 0
                            cl_hits = 0
                    else:
                        # No neighbors yet — fall back to single-segment sw_hits logic
                        if sw_hits >= 3 and cl_hits < 3:
                            final_label = 'OBSTACLE'

                    segments_to_upsert.append({
                        "segment_id": seg_id,
                        "latitude": sf(snapped_lat),
                        "longitude": sf(snapped_lng),
                        "avg_rms": final_rms,
                        "lateral_variance": final_lateral,
                        "sample_count": final_total_count,
                        "label": final_label,
                        "swerving_hits": int(sw_hits),
                        "clear_hits": int(cl_hits),
                        "session_hits": sess_hits,
                        "last_updated": now_iso
                    })
                
                # Tiny Chunk Upsert
                for i in range(0, len(segments_to_upsert), 20):
                    chunk = segments_to_upsert[i:i+20]
                    # Dynamically inject confidence score before upsert to avoid redundant loop
                    for c in chunk:
                        c['confidence_score'] = min(1.0, c['sample_count'] / 500.0)
                    reliable_execute(supabase.table('road_segments').upsert(chunk))
                    time.sleep(0.1)
                
                print(f"    ✅ Aggregated updates complete.")
                
                # BATCH SUMMARY (per user request)
                print("\n    📊 --- BATCH SUMMARY ---")
                from collections import Counter
                counts = Counter([seg['label'] for seg in segments_to_upsert])
                for label, count in sorted(counts.items(), key=lambda x: LABEL_PRIORITY.get(x[0], 0), reverse=True):
                    print(f"    {label:<15} : {count}")
                print("    ------------------------\n")
                
        print(f"    Batch processed successfully.")
  print(f"    Batch processed successfully.")
>>>>>>> d52475d (Finalize spatial telemetry pipeline, avoidance logic, and government dashboard integration)
        
    except Exception as e:
        print(f"    ❌ Critical Error: {e}")
        if not batch.get('id', '').startswith('local_import_'):
            supabase.table('sensors').update({"status": "failed"}).eq("id", batch['id']).execute()
        return
    
    # Complete Workflow
    if not batch.get('id', '').startswith('local_import_'):
        print("    Marking batch Completed...")
        supabase.table('sensors').update({"status": "completed"}).eq("id", batch['id']).execute()

    print(f"--> Finished Sensors [{batch.get('batch_id')}]\n")

if __name__ == "__main__":
    import sys
    # Handle direct file processing
    if len(sys.argv) > 1 and sys.argv[1].endswith(".json"):
        lp = sys.argv[1]
        print(f"--- Local Batch Mode: {lp} ---")
        try:
            # We don't read data here, process_sensors will do it
            dummy = {
                "id": "local_import_" + datetime.now().strftime("%H%M%S"),
                "batch_id": os.path.basename(lp),
                "local_file_path": lp
            }
            process_sensors(dummy)
            print("--- Local Processing Done ---")
        except Exception as ex: print(f"Failed: {ex}")
        sys.exit(0)

    print("=======================================")
    print("GRIP Python Asynchronous Worker")
    print("=======================================")
    print("Polling Supabase every 2 seconds...")

    while True:
        try:
            # Check active Reports (Camera images)
            pending_reports = supabase.table('reports').select('*').eq('status', 'pending').limit(1).execute()
            for r in pending_reports.data:
                process_report(r)

            # Check active Sensors (JSON Telemetry)
            pending_sensors = supabase.table('sensors').select('*').eq('status', 'pending').limit(1).execute()
            for s in pending_sensors.data:
                process_sensors(s)

        except Exception as e:
            print(f"⚠️ Polling Exception: {e}")
        time.sleep(2)