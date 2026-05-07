
import os
from supabase import create_client, Client

SUPABASE_URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
SUPABASE_KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def migrate_existing_data():
    print("--- Starting Data Migration ---")
    
    # 1. Rename 'avoided_obstacle' to 'OBSTACLE' in 'label' column
    print("Renaming 'avoided_obstacle' to 'OBSTACLE' in label column...")
    res = supabase.table('road_segments').update({"label": "OBSTACLE"}).eq("label", "avoided_obstacle").execute()
    print(f"Updated {len(res.data) if res.data else 0} records for OBSTACLE.")

    # 2. Sync 'label' from 'condition_label' where 'label' is null
    print("Syncing NULL labels from condition_label...")
    # Fetch records where label is null
    null_labels = supabase.table('road_segments').select('segment_id', 'condition_label').is_('label', 'null').execute()
    
    if null_labels.data:
        print(f"Found {len(null_labels.data)} records with NULL labels.")
        for i in range(0, len(null_labels.data), 100):
            batch = null_labels.data[i:i+100]
            for row in batch:
                # If condition_label is 'avoided_obstacle', we use 'OBSTACLE'
                final_label = row['condition_label']
                if final_label == 'avoided_obstacle':
                    final_label = 'OBSTACLE'
                
                supabase.table('road_segments').update({"label": final_label}).eq("segment_id", row['segment_id']).execute()
            print(f"  Processed {i + len(batch)} records...")
    else:
        print("No NULL labels found.")

    print("--- Migration Complete ---")

if __name__ == "__main__":
    migrate_existing_data()
