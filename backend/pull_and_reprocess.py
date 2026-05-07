import json, os
from datetime import datetime, timezone
from supabase import create_client
from worker import process_sensors

supabase = create_client('https://ytmuudbkuhkfqkzchtce.supabase.co', 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem')
today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

print('Listing files in storage...')
files = supabase.storage.from_('reports').list('sensors')
todays_files = [f for f in files if f.get('updated_at', '').startswith(today) and f['name'].endswith('.json')]
print(f'Found {len(todays_files)} files uploaded today.')

reprocessed = 0
for file_meta in todays_files:
    file_path = f"sensors/{file_meta['name']}"
    
    res = supabase.table('sensors').select('*').eq('local_file_path', file_path).execute()
    batch_data = res.data[0] if res.data else None
    
    if not batch_data:
        # Create it!
        batch_id = file_meta['name'].replace('batch_', '').replace('.json', '')
        
        insert_data = {
            'batch_id': batch_id,
            'local_file_path': file_path,
            'status': 'pending'
        }
        ins = supabase.table('sensors').insert(insert_data).execute()
        if ins.data:
            batch_data = ins.data[0]
            print(f'Inserted dummy row for {batch_id}')
            
    if batch_data:
        # Reprocess it
        process_sensors(batch_data)
        reprocessed += 1

print(f'Reprocessed {reprocessed} batches.')
