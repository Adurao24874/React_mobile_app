import os
import time
import json
import asyncio
from supabase import create_client, Client
from PIL import Image
from ultralytics import YOLO

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

# 2. Load the Local AI Models
print("Loading YOLO AI Models into Memory...")
try:
    garbage_model = YOLO(r"C:\Users\adars\OneDrive\Desktop\roadcrack\garbage.pt")
    pothole_model = YOLO(r"C:\Users\adars\OneDrive\Desktop\roadcrack\pothole.pt")
    print("✅ AI Models Loaded and Ready.")
except Exception as e:
    print(f"❌ Critical Error loading AI Models: {e}")
    exit(1)

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
        with open('temp_worker_img.jpg', 'wb') as f:
            f.write(res)
            
        pil_img = Image.open('temp_worker_img.jpg').convert('RGB')
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

    # 4. Clean up Storage to preserve the 1GB Free Tier
    print("    🧹 Deleting massive Storage payload...")
    try:
        supabase.storage.from_('reports').remove([image_path])
        print("    ✨ Storage clean.")
    except Exception as e:
        print(f"    ⚠️ Failed to delete storage: {e}")
        
    print(f"--> 🏁 Finished Report [{report['id']}]\n")


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
        supabase.table('sensors').update({"status": "failed"}).eq("id", batch.get('id')).execute()
        return

    # 2. Run Python Telemetry Pipeline
    print("    🧠 Processing telemetry (High-Pass + Complementary Math)...")
    try:
        import pandas as pd
        from telemetry import classify_dataframe
        
        # Convert raw JSON dictionary array into a Pandas dataframe
        df = pd.DataFrame(readings)
        
        # classify_dataframe expects timestamp in ms, accel_x/y/z.
        # Let's map frontend names to legacy telemetry.py names
        df = df.rename(columns={
            'accelZ': 'accel_z',
            'gyroX': 'gyro_x',
            'gyroY': 'gyro_y',
            'gyroZ': 'gyro_z',
            'lat': 'latitude',
            'lng': 'longitude'
        })
        
        # The frontend only tags the VERY LAST sample in the array with GPS to save battery.
        # We need to forward-fill and back-fill the GPS coordinates so every sample has a location
        # before we pass it into the physics extraction engine.
        if 'latitude' in df.columns and 'longitude' in df.columns:
            df['latitude'] = df['latitude'].ffill().bfill()
            df['longitude'] = df['longitude'].ffill().bfill()
            
        # If the frontend didn't supply x/y accel, fill with 0
        if 'accel_x' not in df.columns: df['accel_x'] = 0.0
        if 'accel_y' not in df.columns: df['accel_y'] = 0.0
            
        # Run legacy apptesting extraction math (70 samples min = 0.7s)
        events, _ = classify_dataframe(
            df,
            min_samples=20, # Relaxing for dev testing
            use_gyro=True,
            axis_mode='z'
        )
        
        print(f"    🗺️ Extracted {len(events)} physical street map points.")
        
        # 3. Push coordinates to Map Visualization Database
        if len(events) > 0:
            print("    📤 Uploading coordinate clusters to Supabase Map Layer...")
            for event in events:
                if math.isnan(event['latitude']) or math.isnan(event['longitude']):
                    continue
                    
                supabase.table('road_conditions').insert({
                    'batch_id': batch.get('id'),
                    'latitude': event['latitude'],
                    'longitude': event['longitude'],
                    'vibration_intensity': event['vibration_intensity'],
                    'condition_label': event['label'], # GOOD, POTHOLE, MINOR, BAD, HUMP, RUMBLE
                    'color_hex': event['color_hex'],
                    'timestamp': event['timestamp']
                }).execute()
        
    except Exception as e:
        print(f"    ❌ Telemetry Physics failed: {e}")
        supabase.table('sensors').update({"status": "failed"}).eq("id", batch.get('id')).execute()
        return
    
    # Complete Workflow
    print("    📤 Marking batch Completed...")
    try:
        supabase.table('sensors').update({
            "status": "completed"
        }).eq("id", batch.get('id')).execute()
    except Exception as e:
        print(f"    ❌ Database update failed: {e}")
        return

    # 3. Clean up Storage limits
    print("    🧹 Deleting JSON telemetry from Storage...")
    try:
        supabase.storage.from_('reports').remove([file_path])
        print("    ✨ Storage clean.")
    except Exception as e:
        print(f"    ⚠️ Failed to delete storage: {e}")

    print(f"--> 🏁 Finished Sensors [{batch.get('batch_id')}]\n")

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
            .limit(1)\
            .execute()
            
        if pending_sensors.data and len(pending_sensors.data) > 0:
            process_sensors(pending_sensors.data[0])
            continue
            
    except Exception as e:
        print(f"⚠️ Polling Exception: {e}")

    # Don't fry the CPU while waiting
    time.sleep(2)
