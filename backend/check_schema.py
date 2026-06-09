import os
from supabase import create_client, Client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase: Client = create_client(URL, KEY)

def check_schema():
    try:
        # Get one row to see columns of road_segments
        res = supabase.table('road_segments').select('*').limit(1).execute()
        if res.data:
            print("Columns in road_segments:")
            print(list(res.data[0].keys()))
        else:
            print("No rows in road_segments")
            
        # Get one row to see columns of reports
        res_rep = supabase.table('reports').select('*').limit(1).execute()
        if res_rep.data:
            print("Columns in reports:")
            print(list(res_rep.data[0].keys()))
        else:
            print("No rows in reports")

        # Get one row to see columns of field_workers
        try:
            res_fw = supabase.table('field_workers').select('*').limit(1).execute()
            if res_fw.data:
                print("Columns in field_workers:")
                print(list(res_fw.data[0].keys()))
        except Exception as e:
            print(f"Error checking field_workers: {e}")

        # Get one row to see columns of work_orders
        try:
            res_wo = supabase.table('work_orders').select('*').limit(1).execute()
            if res_wo.data:
                print("Columns in work_orders:")
                print(list(res_wo.data[0].keys()))
        except Exception as e:
            print(f"Error checking work_orders: {e}")

        # Get one row to see columns of issue_categories
        try:
            res_ic = supabase.table('issue_categories').select('*').limit(1).execute()
            if res_ic.data:
                print("Columns in issue_categories:")
                print(list(res_ic.data[0].keys()))
        except Exception as e:
            print(f"Error checking issue_categories: {e}")

        # Get one row to see columns of departments
        try:
            res_dept = supabase.table('departments').select('*').limit(1).execute()
            if res_dept.data:
                print("Columns in departments:")
                print(list(res_dept.data[0].keys()))
        except Exception as e:
            print(f"Error checking departments: {e}")

            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()

