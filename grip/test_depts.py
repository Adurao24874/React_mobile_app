from supabase import create_client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase = create_client(URL, KEY)

res = supabase.table('departments').select('department_name, contact_email, taluka_name').execute()
print(res.data)
