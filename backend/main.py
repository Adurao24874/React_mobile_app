import os
import io
import json
import asyncio
import requests
import base64
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from ultralytics import YOLO
from PIL import Image

app = FastAPI(title="GRIP Data API - ML Enabled")

# 1. Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Setup Supabase Client
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

# 3. Directories for local fallback storage
os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/sensors", exist_ok=True)

# 4. Load YOLO Models into Memory from the user's roadcrack folder
print("Loading YOLO Models...")
try:
    garbage_model = YOLO(r"C:\Users\adars\OneDrive\Desktop\roadcrack\garbage.pt")
    print("✅ Loaded Garbage YOLO Model")
except Exception as e:
    print(f"⚠️ Failed to load Garbage Model: {e}")
    garbage_model = None

try:
    pothole_model = YOLO(r"C:\Users\adars\OneDrive\Desktop\roadcrack\pothole.pt")
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
            "ai_predictions": json.dumps(predictions) # Storing the JSON results of what the AI found
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
