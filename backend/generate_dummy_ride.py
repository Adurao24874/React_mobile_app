import json
import time
import math
import uuid
import uuid
from supabase import create_client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase = create_client(URL, KEY)

# Starting near Sabnis Valley (from the user's reference map)
start_lat = 15.5450 
start_lng = 73.8150

# We want roughly 60 seconds of driving at 50Hz = 3000 samples
SAMPLES = 3000
HZ = 50.0
time_step = 1.0 / HZ

# Simulate driving south down CHOGM road
# Earth radius in meters
R = 6378137 

readings = []
base_time = int(time.time() * 1000) - (SAMPLES * int(time_step * 1000))

# Simulate a mostly smooth road (accelZ ~ 9.8) with a few massive potholes
for i in range(SAMPLES):
    t_ms = base_time + int(i * time_step * 1000)
    
    # Progress physically down the road
    # Roughly 10 meters per second (36 km/h)
    distance_driven = (i / HZ) * 10.0 
    
    # Move mostly south-east
    dLat = -(distance_driven / R) * (180 / math.pi) * 0.8
    dLng = (distance_driven / (R * math.cos(math.pi * start_lat / 180))) * (180 / math.pi) * 0.4
    
    current_lat = start_lat + dLat
    current_lng = start_lng + dLng
    
    # Base gravity
    z_accel = 9.8 
    
    # Inject a pothole every 500 samples (every 10 seconds)
    if i % 500 > 480:
        z_accel += math.sin(i) * 15.0 # Massive violent spike (Pothole)
    elif i % 500 > 450:
         z_accel += math.sin(i) * 6.0 # Minor bump before
    else:
        # Normal road noise
        z_accel += (math.sin(i * 10) * 1.5)
        
    readings.append({
        "accelZ": z_accel,
        "gyroX": math.sin(i * 0.1) * 0.5,
        "gyroY": math.cos(i * 0.1) * 0.5,
        "gyroZ": (math.sin(i * 0.05) * 0.2) + 0.1, # Slight turning
        "lat": current_lat,
        "lng": current_lng,
        "timestamp": t_ms
    })

batch_id = str(uuid.uuid4())
file_name = f"sensors/batch_{batch_id}.json"

payload = {
    "id": batch_id,
    "readings": readings
}

print(f"Generated {len(readings)} dummy samples. Uploading to Storage...")

with open('temp_test.json', 'w') as f:
    json.dump(payload, f)

json_bytes = json.dumps(payload).encode('utf-8')

# 1. Upload to storage
res = supabase.storage.from_('reports').upload(file_name, json_bytes, file_options={"content-type": "application/json"})
print("Uploaded to storage:", res)

# 2. Insert tracking row into sensors table
print("Inserting sensor database row...")
res2 = supabase.table('sensors').insert({
    "batch_id": batch_id,
    "reading_count": len(readings),
    "local_file_path": file_name,
    "status": "pending"
}).execute()

print("✅ Dummy payload fully dispatched into queue! Watch worker.py pick it up.")
