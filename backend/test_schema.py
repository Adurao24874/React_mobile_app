import os
from supabase import create_client
import dotenv

dotenv.load_dotenv(".env")
supabase = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))

res = supabase.table("reports").select("id, ai_predictions, status").order("created_at", desc=True).limit(2).execute()
print(res.data)