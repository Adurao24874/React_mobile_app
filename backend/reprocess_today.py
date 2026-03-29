import os
import json
import math
import pandas as pd
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client
from telemetry import classify_dataframe

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def reprocess_batch(batch):
    batch_id = batch.get('batch_id')
    file_path = batch.get('local_file_path')
    print(f"\n🔄 Reprocessing Batch: {batch_id}")
    
    # Download JSON from Storage
    try:
        res = supabase.storage.from_('reports').download(file_path)
        payload = json.loads(res.decode('utf-8'))
        readings = payload.get('readings', [])
        print(f"    📊 Loaded {len(readings)} samples.")
    except Exception as e:
        print(f"    ❌ Failed to download: {e}")
        return

    # Process Telemetry
    try:
        df = pd.DataFrame(readings)
        # Map incoming names (some might be legacy missing X/Y, some might be new)
        rename_map = {
            'accelX': 'accel_x', 'accelY': 'accel_y', 'accelZ': 'accel_z',
            'gyroX': 'gyro_x', 'gyroY': 'gyro_y', 'gyroZ': 'gyro_z',
            'lat': 'latitude', 'lng': 'longitude'
        }
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
        
        # Fill missing data
        if 'latitude' in df.columns:
            df['latitude'] = df['latitude'].ffill().bfill()
            df['longitude'] = df['longitude'].ffill().bfill()
        if 'accel_x' not in df.columns: df['accel_x'] = 0.0
        if 'accel_y' not in df.columns: df['accel_y'] = 0.0

        events, _ = classify_dataframe(
            df,
            min_samples=50,
            use_gyro=True,
            axis_mode='gyro' # Using new tuned logic
        )
        print(f"    🗺️ Extracted {len(events)} events.")

        if len(events) > 0:
            # Delete OLD records for this batch
            print(f"    🗑️ Clearing old points for {batch_id}...")
            supabase.table('road_conditions').delete().eq('batch_id', batch_id).execute()

            # Insert NEW records
            print(f"    📤 Uploading {len(events)} new points...")
            success_count = 0
            for event in events:
                if math.isnan(event['latitude']) or math.isnan(event['longitude']) or (event['latitude'] == 0 and event['longitude'] == 0):
                    continue
                try:
                    supabase.table('road_conditions').insert({
                        'batch_id': batch_id,
                        'latitude': event['latitude'],
                        'longitude': event['longitude'],
                        'vibration_intensity': event['vibration_intensity'],
                        'condition_label': event['label'],
                        'color_hex': event['color_hex'],
                        'timestamp': int(event['timestamp'])
                    }).execute()
                    success_count += 1
                except Exception as e:
                    print(f"        ⚠️ Insert err: {e}")
            print(f"    ✅ Done: {success_count} points updated.")

    except Exception as e:
        print(f"    ❌ Processing failed: {e}")

def run():
    # Define "Today" (UTC)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today.isoformat()
    print(f"🔍 Searching for batches uploaded since {today_iso}...")

    try:
        batches = supabase.table('sensors')\
            .select('*')\
            .gte('created_at', today_iso)\
            .neq('batch_id', 'SERVER_HEARTBEAT')\
            .execute()
        
        data = batches.data
        if not data:
            print("📭 No batches found for today.")
            return

        print(f"📂 Found {len(data)} batches. Starting re-analysis...")
        for b in data:
            reprocess_batch(b)

    except Exception as e:
        print(f"❌ Query failed: {e}")

if __name__ == "__main__":
    run()
