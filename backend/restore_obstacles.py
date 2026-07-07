import numpy as np
import json
from supabase import create_client

supabase = create_client('https://ytmuudbkuhkfqkzchtce.supabase.co', 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem')

print("Fetching all segments...")
all_segments = {}
start = 0
step = 1000

while True:
    res = supabase.table('road_segments').select('segment_id, sample_count, lateral_variance').range(start, start + step - 1).execute()
    data = res.data
    if not data:
        break
    for r in data:
        all_segments[r['segment_id']] = r
    start += step
    print(f"Fetched {len(all_segments)}...")

print(f"Total segments: {len(all_segments)}")

COVERAGE_RATIO = 0.3
MIN_SAMPLES = 50
LATERAL_THRESHOLD = 0.5

try:
    jc_data = json.load(open('junction_cells.json'))
    JUNCTION_CELLS = set(jc_data.get('junction_cells', []) if isinstance(jc_data, dict) else jc_data)
except:
    JUNCTION_CELLS = set()

def get_neighbors(sid):
    x, y = map(int, sid.split('_'))
    n_sids = [f"{x+dx}_{y+dy}" for dx in [-1,0,1] for dy in [-1,0,1] if not (dx==0 and dy==0)]
    return [all_segments[n] for n in n_sids if n in all_segments]

print("Re-evaluating obstacles based on old logic...")
to_restore = []

for sid, data in all_segments.items():
    self_samples = data.get('sample_count', 0)
    if self_samples < MIN_SAMPLES:
        continue
    if sid in JUNCTION_CELLS:
        continue
        
    neighbors = get_neighbors(sid)
    if not neighbors:
        continue
        
    avg_neighbor_samples = float(np.mean([n.get('sample_count', 0) for n in neighbors]))
    avg_neighbor_lateral = float(np.mean([float(n.get('lateral_variance') or 0.0) for n in neighbors]))
    
    coverage_ratio = (self_samples / avg_neighbor_samples if avg_neighbor_samples > 0 else 1.0)
    
    cond_a = coverage_ratio < COVERAGE_RATIO and self_samples >= MIN_SAMPLES
    cond_b = avg_neighbor_lateral > LATERAL_THRESHOLD
    
    if cond_a and cond_b:
        to_restore.append(sid)

print(f"Found {len(to_restore)} segments that should be OBSTACLES based on the old 50-sample rule.")
if to_restore:
    chunk_size = 50
    for i in range(0, len(to_restore), chunk_size):
        chunk = to_restore[i:i+chunk_size]
        supabase.table('road_segments').update({'label': 'OBSTACLE'}).in_('segment_id', chunk).execute()
    print("Successfully restored them!")
