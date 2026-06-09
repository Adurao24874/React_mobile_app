import sys; sys.path.append('C:\\\\Users\\\\adars\\\\OneDrive\\\\Desktop\\\\Mobapp')
import time
from backend.worker import supabase

def test_login_flow():
    email = 'admin.ponda_mc@grip.local'
    print(f"Testing flow for {email}...")

    # 1. Routing query in GovLogin / GovDashboardRedirect
    print("\n--- 1. App.tsx Routing Query ---")
    res1 = supabase.table('departments').select('department_type').eq('contact_email', email).execute()
    print("Result:", res1.data)
    if res1.data:
        dtype = res1.data[0].get('department_type', '').upper()
        if 'PWD' in dtype:
            print("Action: Navigate to /gov/pwd")
        elif 'PANCHAYAT' in dtype or 'MUNICIPAL' in dtype:
            print("Action: Navigate to /gov/panchayat")
        else:
            print("Action: Navigate to /gov/pwd (fallback)")

    # 2. PanchayatDashboard Query
    print("\n--- 2. PanchayatDashboard Query ---")
    res2 = supabase.table('departments').select('department_name').eq('contact_email', email).execute()
    print("Result:", res2.data)
    if res2.data:
        print("Action: Set title to", res2.data[0].get('department_name'))
    else:
        print("Action: Fallback to Torxem Village Panchayat")

    # 3. GovernmentDashboard Query (if it went there)
    print("\n--- 3. GovernmentDashboard Query ---")
    res3 = supabase.table('departments').select('department_name, taluka_name, department_type').eq('contact_email', email).execute()
    print("Result:", res3.data)

test_login_flow()
