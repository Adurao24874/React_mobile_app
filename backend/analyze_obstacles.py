import json
import numpy as np
from supabase import create_client

supabase = create_client('https://ytmuudbkuhkfqkzchtce.supabase.co', 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem')

def fetch_neighbors(sid):
    x, y = map(int, sid.split('_'))
    n_sids = [f"{x+dx}_{y+dy}" for dx in [-1,0,1] for dy in [-1,0,1] if not (dx==0 and dy==0)]
    res = supabase.table('road_segments').select('sample_count, lateral_variance').in_('segment_id', n_sids).execute()
    return res.data

res = supabase.table('road_segments').select('*').eq('label', 'OBSTACLE').execute()
obstacles = res.data

try:
    jc_data = json.load(open('junction_cells.json'))
    jc = set(jc_data.get('junction_cells', []) if isinstance(jc_data, dict) else jc_data)
except:
    jc = set()

junction_count = 0
convergence_count = 0
valid_count = 0

for obs in obstacles:
    sid = obs['segment_id']
    if sid in jc:
        junction_count += 1
        continue
        
    neighbors = fetch_neighbors(sid)
    if not neighbors:
        continue
        
    avg_neighbor_samples = np.mean([n.get('sample_count', 0) for n in neighbors])
    self_samples = obs.get('sample_count', 0)
    
    # Check if this looks like GPS convergence (very low neighbor count overall, or high variance)
    if avg_neighbor_samples < 50:
        convergence_count += 1
    else:
        valid_count += 1

print(f"Total OBSTACLES: {len(obstacles)}")
print(f" - False Positives (Junctions): {junction_count}")
print(f" - Likely False Positives (GPS Convergence / Low Data): {convergence_count}")
print(f" - Potentially Valid Obstacles: {valid_count}")
