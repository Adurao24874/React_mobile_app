import os
import glob
from worker import process_sensors
import datetime

folder_path = r"C:\Users\adars\OneDrive\Desktop\Mobapp\backend\uploads\sensors"
json_files = glob.glob(os.path.join(folder_path, "*.json"))

print(f"Found {len(json_files)} files to reprocess.")

for file_path in json_files:
    batch_id = os.path.basename(file_path).replace('batch_', '').replace('.json', '')
    
    batch = {
        'id': f'local_import_{batch_id}',
        'batch_id': batch_id,
        'local_file_path': file_path
    }
    
    try:
        print(f"Reprocessing {file_path}...")
        success = process_sensors(batch)
        if success:
            print(f"Finished {file_path}. Deleting local file...")
            os.remove(file_path)
        else:
            print(f"Processing failed for {file_path}. Keeping local file.")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

print("Done reprocessing all local files.")
