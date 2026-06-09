import os
import io
import json
import asyncio
import requests
import base64
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status, Security
from fastapi.security import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from ultralytics import YOLO
from PIL import Image
import secrets

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key: str = Security(api_key_header)):
    # Read from environment, or use a default for local development MVP
    expected_key = os.environ.get("GRIP_API_KEY", "grip_secure_ai_key_2026")
    if not api_key or not secrets.compare_digest(api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
        )
    return api_key

app = FastAPI(title="GRIP Data API - ML Enabled")

# 1. Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Mount Static Files
os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/sensors", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 3. Setup Supabase Client
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 3. Directories for local fallback storage
os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/sensors", exist_ok=True)

# 4. Load YOLO Models into Memory from the user's roadcrack folder
print("Loading YOLO Models...")
try:
    garbage_model = YOLO(os.path.join(BASE_DIR, "garbage.pt"))
    print("✅ Loaded Garbage YOLO Model")
except Exception as e:
    print(f"⚠️ Failed to load Garbage Model: {e}")
    garbage_model = None

try:
    pothole_model = YOLO(os.path.join(BASE_DIR, "pothole.pt"))
    print("✅ Loaded Pothole YOLO Model")
except Exception as e:
    print(f"⚠️ Failed to load Pothole Model: {e}")
    pothole_model = None


# 5. Helper Function to convert YOLO results back into clean JSON
def parse_yolo_results(results):
    predictions = []
    try:
        for res in results:
            boxes = getattr(res, 'boxes', None)
            if boxes is None: continue
            
            for box in boxes:
                # YOLOv8 boxes are PyTorch tensors, extract python types via .item()
                conf = float(box.conf[0].item())
                cls_idx = int(box.cls[0].item())
                cls_name = res.names[cls_idx]
                
                predictions.append({
                    "class": cls_name,
                    "confidence": conf
                })
        print(f"    ⚙️ parser extracted {len(predictions)} boxes")
    except Exception as e:
        print(f"    ❌ parse_yolo_results crashed: {e}")
    return predictions

# 6. Helper to call Roboflow REST API via threads to avoid blocking server
def fetch_roboflow_predictions(file_bytes):
    try:
        url = 'https://detect.roboflow.com/road-cracks-kkn7t/1'
        params = {
            'api_key': 'WAnUJl2kcHzSDzDTznMM',
            'confidence': 25,
            'overlap': 30
        }
        encoded_image = base64.b64encode(file_bytes).decode('ascii')
        
        # Use a short timeout so the backend never drops requests infinitely
        res = requests.post(url, params=params, data=encoded_image, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=15)
        
        if res.status_code != 200:
            return []
            
        return parse_roboflow_results(res.json())
    except Exception as e:
        print(f"⚠️ Roboflow REST predict failed: {e}")
        return []

# Helper to normalize Roboflow predictions back to our JSON schema
def parse_roboflow_results(rf_json):
    predictions = []
    if not isinstance(rf_json, dict) or 'predictions' not in rf_json:
        return predictions
        
    for p in rf_json['predictions']:
        # Format the roboflow structure to match the frontend expectations
        cls_name = p.get('class', 'road_crack')
        conf = float(p.get('confidence', 0))
        # Roboflow sometimes returns 0-100% instead of 0-1
        if conf > 1.0:
            conf = conf / 100.0
            
        predictions.append({
            "class": cls_name,
            "confidence": conf
        })
    return predictions


# --- Endpoints ---

@app.post("/upload/issue")
async def upload_issue(
    image: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    timestamp: int = Form(...),
    type: str = Form(...)
):
    """
    1. Receives 'Active' reports like Garbage Dumping or Potholes
    2. Runs the image through the correct YOLO model
    3. Saves data to Supabase 
    """
    
    # Read the image bits
    content = await image.read()
    
    # Save the file locally so we don't lose the image
    file_path = f"uploads/images/{image.filename}"
    with open(file_path, "wb") as f:
        f.write(content)
        
    print(f"✅ Received {type} issue at ({lat}, {lng})")
    
    # --------------------------
    # AI INFERENCE STEP
    # --------------------------
    predictions = []
    
    # Convert bytes into PIL image for YOLO
    pil_img = Image.open(io.BytesIO(content))
    if pil_img.mode != 'RGB':
        pil_img = pil_img.convert('RGB')
        
    print("Running Auto Inference...")
    
    # Define blocking functions wrapper allowing them to be run asynchronously via to_thread
    def run_garbage_model():
        if garbage_model:
            try:
                res = garbage_model.predict(source=pil_img, conf=0.15, save=False)
                parsed = parse_yolo_results(res)
                print(f"  🟢 Garbage model finished: {len(parsed)} results")
                return parsed
            except Exception as e:
                print(f"  ❌ Garbage model crashed: {e}")
        return []
        
    def run_pothole_model():
        if pothole_model:
            try:
                res = pothole_model.predict(source=pil_img, conf=0.15, save=False)
                parsed = parse_yolo_results(res)
                print(f"  🟢 Pothole model finished: {len(parsed)} results")
                return parsed
            except Exception as e:
                print(f"  ❌ Pothole model crashed: {e}")
        return []
        
    # Execute all 3 models concurrently so the server stays fast!
    g_preds, p_preds, rf_preds = await asyncio.gather(
        asyncio.to_thread(run_garbage_model),
        asyncio.to_thread(run_pothole_model),
        asyncio.to_thread(fetch_roboflow_predictions, content)
    )
    
    predictions.extend(g_preds)
    predictions.extend(p_preds)
    predictions.extend(rf_preds)
        
    # Clean the type parameter to handle quotes or spaces from FormData
    clean_type = type.strip().strip('\"').strip('\'') if type else ""
    
    # Auto-determine the primary issue type based on highest confidence
    detected_type = clean_type if clean_type and clean_type.lower() != 'auto' else 'Unknown'
    if predictions:
        # Sort predictions by confidence descending
        predictions.sort(key=lambda x: x['confidence'], reverse=True)
        top_pred = predictions[0]['class'].lower()
        if 'garbage' in top_pred:
            detected_type = 'Garbage'
        elif 'pothole' in top_pred or 'crack' in top_pred:
            detected_type = 'Pothole'
        else:
            detected_type = top_pred.capitalize()

    # --------------------------
    # SUPABASE DATABASE INSERTION
    # --------------------------
    # We are logging the issue directly into a table named 'reports'
    try:
        data, count = supabase.table("reports").insert({
            "issue_type": detected_type,
            "latitude": lat,
            "longitude": lng,
            "timestamp": timestamp,
            "image_path": file_path, # In production this would be an S3 bucket URL
            "ai_predictions": json.dumps(predictions), # Storing the JSON results of what the AI found
            "status": "pending"
        }).execute()
        
        print(f"📦 Successfully logged report to Supabase: {detected_type}")
    except Exception as e:
        print(f"⚠️ Supabase Insert Failed (Does 'reports' table exist?): {e}")

    return {
        "status": "success", 
        "message": "Issue AI-processed and uploaded successfully", 
        "filename": image.filename,
        "ai_results": predictions,
        "detected_type": detected_type
    }


# --------------------------
# CLOUD ORCHESTRATION WEBHOOK
# --------------------------
from shapely.geometry import shape, Point

# Load Goa Villages for routing
GOA_VILLAGES = []
geojson_path = os.path.join(BASE_DIR, '..', 'grip-dashboard', 'goa_villages.geojson')
try:
    with open(geojson_path, 'r', encoding='utf-8') as f:
        geo_data = json.load(f)
        for feature in geo_data.get('features', []):
            poly = shape(feature['geometry'])
            name = feature['properties'].get('NAME', 'Unknown Village')
            GOA_VILLAGES.append((name, poly))
except Exception as e:
    print(f"⚠️ Failed to load geojson: {e}")

def get_village_name(lat, lon):
    if not lat or not lon: return None
    pt = Point(lon, lat)
    for name, poly in GOA_VILLAGES:
        if poly.contains(pt):
            return name
    return None

class WebhookRecord(BaseModel):
    id: str

class SupabaseWebhookPayload(BaseModel):
    record: WebhookRecord

@app.post("/ai/process-report")
async def process_report_webhook(payload: SupabaseWebhookPayload, api_key: str = Depends(get_api_key)):
    try:
        report_id = payload.record.id
        print(f"\n--> 🚀 [WEBHOOK] Processing Report {report_id}")
        
        # 1. Fetch report details
        res = supabase.table('reports').select('*').eq('id', report_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        report = res.data[0]
        image_path = report.get('image_path')
        
        # 🚨 INFINITE LOOP PROTECTION: If AI has already processed this, or it failed, SKIP IT!
        if report.get('ai_predictions') is not None or report.get('status') == 'failed':
            print(f"--> 🛑 [WEBHOOK] Report {report_id} already processed. Skipping to prevent loop.")
            return {"status": "skipped", "reason": "already processed"}
            
        if not image_path:
            supabase.table('reports').update({"status": "failed"}).eq("id", report_id).execute()
            raise HTTPException(status_code=400, detail="No image_path in report")

        # 2. Download from Supabase with retry (Race Condition Fix)
        img_bytes = None
        for attempt in range(10):
            try:
                img_bytes = supabase.storage.from_('reports').download(image_path)
                break # Success!
            except Exception as e:
                if attempt == 9:
                    raise Exception(f"Image failed to upload to storage after 10 seconds: {e}")
                import time
                time.sleep(1) # Wait for mobile app to finish uploading
                
        local_dir = os.path.join(BASE_DIR, 'uploads', 'images')
        filename = os.path.basename(image_path)
        local_img_path = os.path.join(local_dir, filename)
        
        with open(local_img_path, 'wb') as f:
            f.write(img_bytes)
            
        pil_img = Image.open(local_img_path).convert('RGB')
        
        # Cleanup storage to save space
        try:
            supabase.storage.from_('reports').remove([image_path])
        except: pass

        # 3. Run Inference
        predictions = []
        if pothole_model:
            p_res = pothole_model.predict(source=pil_img, conf=0.15, save=False, verbose=False)
            predictions.extend(parse_yolo_results(p_res))
        if garbage_model:
            g_res = garbage_model.predict(source=pil_img, conf=0.15, save=False, verbose=False)
            predictions.extend(parse_yolo_results(g_res))

        original_type = report.get('issue_type', '')
        detected_type = original_type if original_type and original_type.lower() != 'auto' else 'Unknown'
        
        if predictions:
            predictions.sort(key=lambda x: x['confidence'], reverse=True)
            exact_class = str(predictions[0]['class'])
            detected_type = exact_class.replace('_', ' ').title()

        # 4. Update Database
        update_payload = {
            "status": "pending",
            "issue_type": detected_type,
            "ai_predictions": json.dumps(predictions),
            "image_path": f"uploads/images/{filename}"
        }

        if not report.get('village_name') and report.get('latitude') and report.get('longitude'):
            v_name = get_village_name(report['latitude'], report['longitude'])
            if v_name: update_payload['village_name'] = v_name

        supabase.table('reports').update(update_payload).eq("id", report_id).execute()
        
        print(f"--> ✅ [WEBHOOK] Finished Report {report_id}")
        return {"status": "success", "issue_type": detected_type, "predictions": len(predictions)}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"CRITICAL ERROR IN WEBHOOK: {error_trace}")
        with open("crash_log.txt", "w") as f:
            f.write(error_trace)
        raise HTTPException(status_code=500, detail=str(e))




# Models for Sensor Batch endpoint
class SensorReading(BaseModel):
    accelZ: float
    gyroX: float
    gyroY: float
    gyroZ: float
    lat: Optional[float] = None
    lng: Optional[float] = None
    timestamp: int

class SensorBatch(BaseModel):
    id: str
    readings: List[SensorReading]

@app.post("/upload/sensors")
async def upload_sensors(batch: SensorBatch):
    """
    Receives 'Passive' monitor batches like Pothole telemetry.
    Saves the JSON to logging folder, and pushes summary string to Supabase.
    """
    file_path = f"uploads/sensors/{batch.id}.json"
    
    # Save bulk telemetry file locally
    with open(file_path, "w") as f:
        json.dump(batch.model_dump(), f, indent=2)
        
    print(f"✅ Received sensor batch {batch.id} with {len(batch.readings)} readings")
    
    # Insert batch record into Supabase 'sensors' table
    try:
        # Assuming the table just keeps a log of file IDs for now
        data, count = supabase.table("sensors").insert({
            "batch_id": batch.id,
            "reading_count": len(batch.readings),
            "local_file_path": file_path
        }).execute()
        
        print(f"📦 Successfully logged sensor batch to Supabase")
    except Exception as e:
        print(f"⚠️ Supabase Insert Failed (Does 'sensors' table exist?): {e}")
    
    return {"status": "success", "message": "Sensors uploaded successfully"}


@app.get("/")
def health_check():
    has_garbage = garbage_model is not None
    has_pothole = pothole_model is not None
    return {
        "status": "online", 
        "message": "GRIP Data API + Supabase + YOLO is running",
        "models_loaded": {
            "garbage": has_garbage,
            "pothole": has_pothole
        }
    }
