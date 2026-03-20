import sys
import argparse
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def rerun_batch(batch_id: str):
    print(f"🔄 Preparing to rerun batch: {batch_id}")
    
    # 1. Check if batch exists in sensors table
    res = supabase.table('sensors').select('*').eq('batch_id', batch_id).execute()
    if not res.data:
        print(f"❌ Error: Batch ID {batch_id} not found in the sensors table.")
        return

    sensor_record = res.data[0]
    
    # 2. Delete existing road_conditions for this batch
    print(f"🧹 Clearing existing processed road conditions for {batch_id}...")
    del_res = supabase.table('road_conditions').delete().eq('batch_id', batch_id).execute()
    print(f"    ✅ Deleted {len(del_res.data)} old map points.")
    
    # 3. Set status back to pending
    print(f"⚙️ Setting batch status to 'pending'...")
    supabase.table('sensors').update({"status": "pending"}).eq("batch_id", batch_id).execute()
    
    print(f"✅ Batch {batch_id} is queued for processing! The worker will pick it up shortly.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rerun a specific sensor batch.")
    parser.add_argument("batch_id", help="The UUID of the batch to rerun")
    args = parser.parse_args()
    
    rerun_batch(args.batch_id)
