import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const safeUserEmail = user.email.trim().toLowerCase();
    const { data: allDepts } = await supabase.from("departments").select("*");

    const aeDept = allDepts?.find(d => d.contact_email && d.contact_email.trim().toLowerCase() === safeUserEmail);

    let workerProfile = null;
    let myDept = aeDept;
    let role = 'JE';
    let eeDistrict = null;
    
    if (aeDept) {
      role = 'AE';
    } else {
      const { data: worker } = await supabase.from("field_workers").select("*").ilike("email", safeUserEmail).single();
      workerProfile = worker;
      if (workerProfile) {
        if (workerProfile.hierarchy_level === 5) {
          role = 'CE';
        } else if (workerProfile.hierarchy_level === 4) {
          role = 'EE';
          eeDistrict = workerProfile.specialty.includes("North") ? "North Goa" : "South Goa";
        } else {
          role = 'JE';
          myDept = allDepts?.find(d => String(d.id) === String(workerProfile.department_id));
        }
      }
    }

    if (!aeDept && !workerProfile) return NextResponse.json({ success: false, error: "Profile not found." }, { status: 403 });

    let relevantWorkOrders: any[] = [];
    let departmentWorkers: any[] = [];

    if (role === 'CE') {
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id");
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map(w => w.id);
      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds).neq("status", "Resolved").neq("status", "Completed");
        relevantWorkOrders = wo || [];
      }
    } else if (role === 'EE') {
      const districtDepts = allDepts?.filter(d => d.district === eeDistrict) || [];
      const deptIds = districtDepts.map(d => d.id);
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").in("department_id", deptIds);
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map(w => w.id);
      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds).neq("status", "Resolved").neq("status", "Completed");
        relevantWorkOrders = wo || [];
      }
    } else if (role === 'AE') {
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").eq("department_id", myDept?.id);
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map(w => w.id);
      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds).neq("status", "Resolved").neq("status", "Completed");
        relevantWorkOrders = wo || [];
      }
    } else {
      const { data: wo } = await supabase.from("work_orders").select("*").eq("worker_id", workerProfile.id).neq("status", "Resolved").neq("status", "Completed");
      relevantWorkOrders = wo || [];
    }

    const reportIds = relevantWorkOrders.map(wo => String(wo.report_id));
    if (reportIds.length === 0) return NextResponse.json({ success: true, role, reports: [] });

    const { data: allReports } = await supabase.from("dashboard_reports").select("*").in("id", reportIds);
    const now = new Date().getTime();

    const activeTickets = relevantWorkOrders.map(wo => {
      const report = allReports?.find(r => String(r.id) === String(wo.report_id));
      
      let assignedWorkerName = "Unknown JE";
      if (role === 'AE' || role === 'EE' || role === 'CE') {
          const worker = departmentWorkers.find(w => String(w.id) === String(wo.worker_id));
          if (worker) {
              assignedWorkerName = worker.worker_name;
              if (role === 'EE' || role === 'CE') {
                  const wDept = allDepts?.find(d => d.id === worker.department_id);
                  if (wDept) assignedWorkerName += ` (${wDept.taluka_name})`;
              }
          }
      } else {
          assignedWorkerName = workerProfile.worker_name;
      }

      let riskStatus = "On Track";
      let hoursRemaining = 99;

      if (wo.due_date) {
        const dueTime = new Date(wo.due_date).getTime();
        hoursRemaining = Math.round((dueTime - now) / (1000 * 60 * 60));
        if (hoursRemaining < 0) riskStatus = "Breached";
        else if (hoursRemaining < 24) riskStatus = "High Risk";
      }

      return {
        id: String(wo.report_id),
        issue_type: report?.issue_type || "Infrastructure Issue",
        village_name: report?.village_name || "Location Logged",
        timestamp: report?.created_at,
        status: wo.status || "Pending",
        latitude: report?.latitude,
        longitude: report?.longitude,
        image_path: report?.image_path || null,
        worker_name: assignedWorkerName,
        hours_remaining: Math.abs(hoursRemaining),
        risk_status: riskStatus
      };
    });

    return NextResponse.json({ success: true, role, reports: activeTickets });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}