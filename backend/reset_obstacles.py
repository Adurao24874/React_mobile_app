from supabase import create_client

supabase = create_client('https://ytmuudbkuhkfqkzchtce.supabase.co', 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem')

# Find all OBSTACLES
res = supabase.table('road_segments').select('segment_id').eq('label', 'OBSTACLE').execute()
obstacles = [r['segment_id'] for r in res.data]

print(f"Found {len(obstacles)} OBSTACLES. Downgrading to GOOD...")

# Downgrade them to GOOD
if obstacles:
    update_res = supabase.table('road_segments').update({'label': 'GOOD'}).in_('segment_id', obstacles).execute()
    print(f"Successfully downgraded {len(update_res.data)} segments.")
else:
    print("No obstacles found.")
