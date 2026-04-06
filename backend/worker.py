import os
import time
import json
import asyncio
import math
import threading
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client
from PIL import Image
from ultralytics import YOLO

# Thresholds for Avoidance Detection
LATERAL_THRESHOLD = 0.5   # Adjust based on real-world sensitivity
COVERAGE_RATIO = 0.3      # Segment is considered 'avoided' if samples < 30% of neighbors
MIN_SAMPLES = 50          # Minimum samples for label confidence

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

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
    print("💓 Starting Server Heartbeat & Retention Monitor...")
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
    print(f"\n--> 📥 Picking up Pending Report [{report['id']}]")
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

LABEL_PRIORITY = {
    'POTHOLE': 6,
    'HUMP': 5,
    'avoided_obstacle': 4.5,
    'RUMBLE': 4,
    'BAD': 3,
    'MINOR': 2,
    'GOOD': 1,
    'UNKNOWN': 0
}

def process_sensors(batch):
    print(f"\n--> 📥 Picking up Pending Sensor Batch [{batch.get('batch_id')}]")
    file_path = batch.get('local_file_path')
    
    # 1. Download JSON from Storage
    print(f"    ⬇️ Downloading {file_path} from Storage...")
    try:
        res = supabase.storage.from_('reports').download(file_path)
        payload = json.loads(res.decode('utf-8'))
        readings = payload.get('readings', [])
        print(f"    📊 Loaded {len(readings)} sensor samples into RAM")
    except Exception as e:
        print(f"    ❌ Failed to download or read sensors: {e}")
        supabase.table('sensors').update({"status": "failed"}).eq("id", batch['id']).execute()
        return

    # 2. Run Python Telemetry Pipeline
    print("    🧠 Processing telemetry (High-Pass + Complementary Math)...")
    try:
        import pandas as pd
        from telemetry import classify_dataframe
        
        # Convert raw JSON dictionary array into a Pandas dataframe
        df = pd.DataFrame(readings)
        
        if df.empty:
            print("    ⚠️ Telemetry skipped: batch has 0 readings.")
            # Skip physical analysis but don't fail the batch
            events, _ = [], pd.DataFrame()
        else:
            # classify_dataframe expects timestamp in ms, accel_x/y/z.
            # Let's map frontend names to legacy telemetry.py names
            df = df.rename(columns={
                'accelX': 'accel_x',
                'accelY': 'accel_y',
                'accelZ': 'accel_z',
                'gyroX': 'gyro_x',
                'gyroY': 'gyro_y',
                'gyroZ': 'gyro_z',
                'lat': 'latitude',
                'lng': 'longitude'
            })
            
            # Normalize GPS fields but do not forward/back-fill stale coordinates across entire batch.
            if 'latitude' in df.columns and 'longitude' in df.columns:
                df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
                df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

            # BACKEND SAFETY FILTER: Discard any sensor samples where vehicle is stopped or crawling
            if 'speed' in df.columns:
                df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
                df = df[df['speed'] >= 2.0]
                
            # Run legacy apptesting extraction math (70 samples min = 0.7s)
            events, _ = classify_dataframe(
                df,
                min_samples=50, # Set to 50 to match the new 50Hz app sampling rate
                use_gyro=True,
                axis_mode='gyro'
            )
        
        print(f"    🗺️ Extracted {len(events)} physical street map points.")
        
        # 3. Push coordinates to Map Visualization Database as Segments
        if len(events) > 0:
            print(f"    📤 Aggregating {len(events)} events into segments...")
            from collections import defaultdict
            import numpy as np
            
            # Group events into 3-meter bins
            segment_groups = defaultdict(list)
            GRID_SIZE = 0.00003
            
            skipped_coords = 0
            for event in events:
                lat = event.get('latitude')
                lon = event.get('longitude')
                if lat is None or lon is None or math.isnan(lat) or math.isnan(lon) or (lat == 0 and lon == 0):
                    skipped_coords += 1
                    continue

                if not is_in_goa(event['latitude'], event['longitude']):
                    continue
                    
                cell_x = int(lat / GRID_SIZE)
                cell_y = int(lon / GRID_SIZE)
                segment_id = f"{cell_x}_{cell_y}"
                
                segment_groups[segment_id].append(event)
            
            if skipped_coords > 0:
                print(f"    ⚠️ Skipped {skipped_coords} events due to missing/zero GPS coordinates")
                
            if not segment_groups:
                print("    ⚠️ No valid segments found to upload (all events lacked coordinates).")
            else:
                print(f"    📦 Grouped into {len(segment_groups)} unique segments.")
                seg_ids = list(segment_groups.keys())
                existing_map = {}
                try:
                    # Fetch existing segments to do running averages
                    res = supabase.table('road_segments').select('*').in_('segment_id', seg_ids).execute()
                    if res.data:
                        for row in res.data:
                            existing_map[row['segment_id']] = row
                except Exception as e:
                    print(f"        ⚠️ Failed to fetch existing segments: {e}")
                
                segments_to_upsert = []
                now_iso = datetime.now(timezone.utc).isoformat()
                
                for seg_id, items in segment_groups.items():
                    # STEP 1: COMPUTE BATCH STATS
                    batch_rms = float(np.mean([i['vibration_intensity'] for i in items if 'vibration_intensity' in i]))
                    batch_accel = float(np.mean([i.get('accel_z', 0.0) for i in items])) # avg_vertical_accel
                    batch_count = sum([i.get('samples', 50) for i in items])
                    batch_lateral_var = float(np.mean([i.get('lateral_variance', 0.0) for i in items]))
                    
                    # Pick the highest priority label seen in the batch as a starting point
                    batch_label = 'GOOD'
                    max_prio = 0
                    for i in items:
                        prio = LABEL_PRIORITY.get(i.get('label', 'GOOD'), 0)
                        if prio > max_prio:
                            max_prio = prio
                            batch_label = i.get('label', 'GOOD')
                    
                    # STEP 2: WEIGHTED UPDATE
                    if seg_id in existing_map:
                        existing = existing_map[seg_id]
                        old_rms = existing.get('avg_rms') or 0.0
                        old_accel = existing.get('avg_accel') or 0.0
                        old_count = existing.get('sample_count') or 0
                        old_lateral = existing.get('lateral_variance') or 0.0
                        old_label = existing.get('label') or 'smooth'
                        
                        total_count = old_count + batch_count
                        new_rms = ((old_rms * old_count) + (batch_rms * batch_count)) / total_count
                        new_accel = ((old_accel * old_count) + (batch_accel * batch_count)) / total_count
                        new_lateral = ((old_lateral * old_count) + (batch_lateral_var * batch_count)) / total_count
                        
                        segments_to_upsert.append({
                            "segment_id": seg_id,
                            "latitude": existing.get('latitude', items[0]['latitude']),
                            "longitude": existing.get('longitude', items[0]['longitude']),
                            "avg_rms": float(new_rms),
                            "avg_accel": float(new_accel),
                            "lateral_variance": float(new_lateral),
                            "sample_count": total_count,
                            "condition_label": batch_label,
                            "last_updated": now_iso
                        })
                    else:
                        segments_to_upsert.append({
                            "segment_id": seg_id,
                            "latitude": items[0]['latitude'],
                            "longitude": items[0]['longitude'],
                            "avg_rms": batch_rms,
                            "avg_accel": batch_accel,
                            "lateral_variance": batch_lateral_var,
                            "sample_count": batch_count,
                            "condition_label": batch_label,
                            "last_updated": now_iso
                        })
                        
                try:
                    # Initial Upsert to update basic stats
                    supabase.table('road_segments').upsert(segments_to_upsert).execute()
                    print(f"    ✅ Updated stats for {len(segments_to_upsert)} segments.")
                    
                    # STEP 3-8: SPATIAL AVOIDANCE ANALYSIS
                    print("    🔍 Performing Spatial Avoidance Analysis...")
                    all_updated_ids = [s['segment_id'] for s in segments_to_upsert]
                    
                    for seg in segments_to_upsert:
                        seg_id = seg['segment_id']
                        try:
                            parts = seg_id.split('_')
                            x, y = int(parts[0]), int(parts[1])
                        except: continue
                        
                        # Define neighbors
                        neighbor_ids = [f"{x+1}_{y}", f"{x-1}_{y}", f"{x}_{y+1}", f"{x}_{y-1}", f"{x+1}_{y+1}", f"{x-1}_{y-1}"]
                        
                        # STEP 3: FETCH NEIGHBORS
                        n_res = supabase.table('road_segments').select('*').in_('segment_id', neighbor_ids).execute()
                        neighbors = n_res.data if n_res.data else []
                        
                        if not neighbors: continue
                        
                        # Compute neighbor stats
                        n_avg_count = np.mean([n['sample_count'] for n in neighbors])
                        n_lat_avg = np.mean([n['lateral_variance'] for n in neighbors])
                        
                        self_count = seg['sample_count']
                        is_low_coverage = self_count < (COVERAGE_RATIO * n_avg_count)
                        confirmed_avoidance = n_lat_avg > LATERAL_THRESHOLD
                        
                        # STEP 6: SCORES
                        bump_score = seg['avg_rms']
                        avoidance_score = (n_avg_count - self_count) + (n_lat_avg * 10) # Weighted
                        
                        # STEP 7: CLASSIFY
                        # Start with the high-fidelity label from the telemetry pipeline
                        final_label = seg.get('condition_label', 'GOOD')
                        
                        # Apply spatial overrides or RMS upgrades while respecting high-priority existing labels
                        if bump_score > 3.0: 
                            final_label = "POTHOLE"
                        elif is_low_coverage and confirmed_avoidance: 
                            final_label = "avoided_obstacle"
                        elif bump_score > 1.5:
                            # Only upgrade to 'rough' if we don't already have a more specific label
                            if final_label in ['GOOD', 'smooth', 'UNKNOWN']:
                                final_label = "rough"
                        
                        # Final normalization to uppercase for consistency with legend where appropriate
                        if final_label == 'smooth': final_label = 'GOOD'
                        
                        # STEP 8: PRIORITY MERGE (Prevent downgrading from a previous rider)
                        # We use the 'old_label' we fetched earlier from existing data
                        old_label = existing.get('label') if 'existing' in locals() else 'GOOD'
                        if old_label is None: old_label = 'GOOD'
                        
                        new_prio = LABEL_PRIORITY.get(final_label, 0)
                        old_prio = LABEL_PRIORITY.get(old_label, 0)
                        
                        # Only update if the new finding is MORE SEVERE or EQUAL to the old one.
                        # This prevents a 'Good' ride from hiding a real 'Pothole'.
                        if new_prio < old_prio:
                            # Keep the old, more severe label
                            final_label = old_label
                        
                        # STEP 9: STORE RESULT
                        conf = min(1.0, self_count / 200.0) # Simple confidence
                        supabase.table('road_segments').update({
                            "label": final_label,
                            "confidence_score": float(conf)
                        }).eq("segment_id", seg_id).execute()
                        
                    print("    ✨ Avoidance labels prioritized and updated.")
                    
                except Exception as insert_err:
                    print(f"        ⚠️ Spatial Analysis error: {insert_err}")
                    
        # STEP 9: CLEANUP
        print(f"    🧹 Cleaning up processed batch [{batch['id']}]...")
        # REMOVED: Do not delete row, so that we can mark it 'completed' and 24h retention can handle it.
        # supabase.table('sensors').delete().eq("id", batch['id']).execute()
        print("    ✅ Batch processed, proceeding to mark complete.")
        
    except Exception as e:
        print(f"    ❌ Telemetry Physics failed: {e}")
        supabase.table('sensors').update({"status": "failed"}).eq("id", batch['id']).execute()
        return
    
    # Complete Workflow
    print("    📤 Marking batch Completed...")
    try:
        supabase.table('sensors').update({
            "status": "completed"
        }).eq("id", batch['id']).execute()
    except Exception as e:
        print(f"    ❌ Database update failed: {e}")
        return

    print(f"--> 🏁 Finished Sensors [{batch.get('batch_id')}]\n")

if __name__ == "__main__":
    print("=======================================")
    print("🤖 GRIP Python Asynchronous Worker 🤖")
    print("=======================================")
    print("Polling Supabase every 2 seconds...")

    while True:
        try:
            # Check active Reports (Camera images)
            pending_reports = supabase.table('reports')\
                .select('*')\
                .eq('status', 'pending')\
                .limit(1)\
                .execute()
                
            if pending_reports.data and len(pending_reports.data) > 0:
                process_report(pending_reports.data[0])
                continue # Prioritize finishing all queue items quickly
                
            # Check passive Sensors (Telemetry)
            # Assuming the 'sensors' table has a 'status' column we can rely on
            pending_sensors = supabase.table('sensors')\
                .select('*')\
                .eq('status', 'pending')\
                .neq('batch_id', 'SERVER_HEARTBEAT')\
                .limit(1)\
                .execute()
                
            if pending_sensors.data and len(pending_sensors.data) > 0:
                process_sensors(pending_sensors.data[0])
                continue
                
        except Exception as e:
            print(f"⚠️ Polling Exception: {e}")

        # Don't fry the CPU while waiting
        time.sleep(2)