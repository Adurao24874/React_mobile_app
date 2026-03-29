import os
from supabase import create_client, Client

# 1. Initialize Supabase
URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

print("Attempting to add 'condition_label' column to 'road_segments'...")
try:
    # We can't run arbitrary SQL easily with the client, but we can try to RPC or just ask the user.
    # However, let's try a clever trick: just try to fetch it. If it fails, we know it's missing.
    # Actually, the best way for the user is the SQL editor.
    # But I can try to use the supabase client to check if the column exists by doing a select.
    res = supabase.table('road_segments').select('condition_label').limit(1).execute()
    print("Column 'condition_label' already exists.")
except Exception as e:
    print(f"Column probably missing or error: {e}")
    print("Please run this in Supabase SQL Editor: ALTER TABLE road_segments ADD COLUMN IF NOT EXISTS condition_label TEXT;")

# Since I can't run ALTER TABLE directly through the postgrest client safely/easily, 
# I will just proceed with the migration script and it will error out if column is missing, 
# at which point I'll definitely ask the user.
