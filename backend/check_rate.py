import json
import pandas as pd
from supabase import create_client

supabase = create_client('https://ytmuudbkuhkfqkzchtce.supabase.co', 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem')
files = supabase.storage.from_('reports').list('sensors')
if not files:
    print("No files found.")
    exit(0)

file_path = f"sensors/{files[0]['name']}"
print(f"Downloading {file_path}...")
res = supabase.storage.from_('reports').download(file_path)
payload = json.loads(res.decode('utf-8'))
readings = payload.get('readings', [])

df = pd.DataFrame(readings)
df['sec'] = pd.to_numeric(df['timestamp'], errors='coerce') // 1000
secs = df['sec'].unique()
secs.sort()

print("Time sequence:")
for i in range(1, len(secs)):
    diff = secs[i] - secs[i-1]
    if diff > 1:
        print(f"GAP DETECTED: {diff} seconds missing between {secs[i-1]} and {secs[i]}")

print("Total duration:", secs[-1] - secs[0], "seconds")
print(df.groupby('sec').size())
