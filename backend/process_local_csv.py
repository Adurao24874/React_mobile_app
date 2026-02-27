import pandas as pd
import math
from supabase import create_client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase = create_client(URL, KEY)

from telemetry import classify_dataframe

print("Loading CSV...")
df = pd.read_csv(r"C:\Users\adars\Downloads\road_data_1768031731203.csv")

print(f"Loaded {len(df)} samples. Running math extraction...")
events, _ = classify_dataframe(
    df,
    min_samples=20, # Relaxing for dev testing
    use_gyro=True,
    axis_mode='z'
)

print(f"Extracted {len(events)} valid road conditions. Uploading to Map Layer Database...")

batch_id = "test-real-csv"

count = 0
for event in events:
    if math.isnan(event['latitude']) or math.isnan(event['longitude']):
        continue
        
    supabase.table('road_conditions').insert({
        'batch_id': batch_id,
        'latitude': event['latitude'],
        'longitude': event['longitude'],
        'vibration_intensity': event['vibration_intensity'],
        'condition_label': event['label'], 
        'color_hex': event['color_hex'],
        'timestamp': event['timestamp']
    }).execute()
    count += 1
    
print(f"✅ Successfully plotted {count} live coordinates onto the map!")
