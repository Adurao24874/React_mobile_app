import time
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def create_users():
    res = supabase.table('departments').select('*').execute()
    departments = res.data
    
    print(f"Found {len(departments)} departments")
    
    for dept in departments:
        email = dept.get('contact_email')
        dept_type = dept.get('department_type')
        if not email:
            print(f"Skipping {dept.get('department_name')}: no email")
            continue
            
        print(f"Signing up user for {dept.get('department_name')} ({email})...")
        try:
            # We use signup via auth.
            # On supabase python client:
            resp = supabase.auth.sign_up({"email": email, "password": "password"})
            print(f"Successfully signed up {email}")
        except Exception as e:
            print(f"Failed to sign up {email}: {e}")
            
        time.sleep(0.5)

if __name__ == "__main__":
    create_users()
