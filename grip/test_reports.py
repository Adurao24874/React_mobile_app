from supabase import create_client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase = create_client(URL, KEY)

res = supabase.table('reports').select('id, village_name').execute()
print([r['village_name'] for r in res.data if r['village_name']])
