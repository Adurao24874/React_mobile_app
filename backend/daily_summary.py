
import os
import json
from datetime import datetime, date
from supabase import create_client, Client
from dotenv import load_dotenv
from collections import Counter

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in environment.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_today_summary():
    print(f"--- GRIP DAILY SUMMARY: {date.today()} ---")
    
    # 1. Fetch sensor segments processed today
    # Assuming 'last_updated' is used for segments
    today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
    
    try:
        # We fetch road_segments updated today
        response = supabase.table("road_segments").select("label").gte("last_updated", today_start).execute()
        
        counts = Counter([row['label'] for row in response.data])
        
        print("\n[ROAD SEGMENTS UPDATED TODAY]")
        if not counts:
            print("No segments updated today.")
        for label, count in sorted(counts.items(), key=lambda x: x[1], reverse=True):
            display_label = str(label) if label is not None else "NONE"
            print(f"  {display_label:20}: {count}")
            
        # 2. Fetch total unique session IDs processed today via 'sensors' table if helpful
        # But 'road_segments' is the source of truth for the map.
        
        # 3. Specific check for high-priority events
        potholes = counts.get('POTHOLE', 0)
        obstacles = counts.get('OBSTACLE', 0)
        
        print("\n[HIGH PRIORITY EVENTS]")
        print(f"  Potholes Detected    : {potholes}")
        print(f"  Obstacles Avoided    : {obstacles}")
        
        if potholes > 0 or obstacles > 0:
            print("\n  STATUS: High-priority data is PRESENT in database.")
        else:
            print("\n  STATUS: No high-priority events found today yet.")
            
    except Exception as e:
        print(f"Error fetching summary: {e}")

if __name__ == "__main__":
    get_today_summary()
