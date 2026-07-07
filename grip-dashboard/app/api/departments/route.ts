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

    const safeUserEmail = user.email?.trim().toLowerCase() || "";
    const { data: allDepts } = await supabase.from("departments").select("*");

    // 1. THE BULLETPROOF IDENTITY CHECK (AE, JE, EE, or CE?)
    const aeDept = allDepts?.find(d => d.contact_email && d.contact_email.trim().toLowerCase() === safeUserEmail);

    let workerProfile: any = null;
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
          role = 'CE'; // Chief Engineer detected!
        } else if (workerProfile.hierarchy_level === 4) {
          role = 'EE'; // Executive Engineer detected!
          eeDistrict = workerProfile.specialty.includes("North") ? "North Goa" : "South Goa";
        } else {
          role = 'JE';
          myDept = allDepts?.find(d => String(d.id) === String(workerProfile.department_id));
        }
      }
    }

    if (!aeDept && !workerProfile) return NextResponse.json({ success: false, error: "ACCESS DENIED: Profile not found." }, { status: 403 });

    const userName = role === 'AE' ? aeDept.officer_in_charge : workerProfile.worker_name;
    const userLevel = role === 'AE' ? 1 : workerProfile.hierarchy_level;
    const userTaluka = role === 'CE' ? "State of Goa" : role === 'EE' ? `${eeDistrict} District` : (myDept?.taluka_name || "Unknown");

    // 2. FETCH WORK ORDERS BASED ON ROLE
    let relevantWorkOrders: any[] = [];
    let departmentWorkers: any[] = [];

    if (role === 'CE') {
      // CE View: Get EVERYTHING
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id");
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map(w => w.id);

      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
        relevantWorkOrders = wo || [];
      }
    } else if (role === 'EE') {
      const districtDepts = allDepts?.filter(d => d.district === eeDistrict) || [];
      const deptIds = districtDepts.map(d => d.id);
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").in("department_id", deptIds);
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map(w => w.id);

      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
        relevantWorkOrders = wo || [];
      }
    } else if (role === 'AE') {
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").eq("department_id", myDept?.id);
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map(w => w.id);

      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
        relevantWorkOrders = wo || [];
      }
    } else {
      const { data: wo } = await supabase.from("work_orders").select("*").eq("worker_id", workerProfile.id);
      relevantWorkOrders = wo || [];
    }

    // 3. FETCH MAP DATA AND PROCESS
    const { data: allReports } = await supabase.from("dashboard_reports").select("*");
    const { data: allWorkOrders } = await supabase.from("work_orders").select("report_id, department_id");

    const processedTickets = allReports?.map((report) => {
        const matchingWorkOrder = relevantWorkOrders.find((wo) => String(wo.report_id) === String(report.id));
        const isMine = !!matchingWorkOrder;

        let assignedWorkerName = "Other Division";
        if (isMine) {
            if (role === 'AE' || role === 'EE' || role === 'CE') {
                const assignedWorker = departmentWorkers.find(w => String(w.id) === String(matchingWorkOrder.worker_id));
                if (assignedWorker) {
                    assignedWorkerName = assignedWorker.worker_name;
                    // For EE & CE, add the division name so they know where the JE is located
                    if (role === 'EE' || role === 'CE') {
                        const wDept = allDepts?.find(d => d.id === assignedWorker.department_id);
                        if (wDept) assignedWorkerName += ` (${wDept.taluka_name})`;
                    }
                } else {
                    assignedWorkerName = "Unassigned JE";
                }
            } else {
                assignedWorkerName = workerProfile.worker_name;
            }
        }

        let type = report.issue_type || "Pothole / Issue";
        if (type.toLowerCase().includes("massive") || type.toLowerCase().includes("high severity")) type = "Major Pothole";

        let resolvedDepartmentName = report.assigned_department || report.village_name;
        if (!resolvedDepartmentName) {
            const globalWorkOrder = allWorkOrders?.find((wo) => String(wo.report_id) === String(report.id));
            if (globalWorkOrder) {
                const wDept = allDepts?.find(d => String(d.id) === String(globalWorkOrder.department_id));
                if (wDept) {
                    resolvedDepartmentName = wDept.department_name;
                }
            }
        }

        return {
          id: report.id,
          latitude: report.latitude, 
          longitude: report.longitude,
          display_type: type,
          status: matchingWorkOrder ? matchingWorkOrder.status : "Pending",
          is_my_territory: isMine,
          worker_name: assignedWorkerName,
          ai_predictions: report.ai_predictions,
          assigned_department: resolvedDepartmentName || "Location Unknown",
        };
      }) || [];

    const activeTicketsOnly = processedTickets.filter((t) => {
      const statusText = (t.status || "").toLowerCase();
      const isResolved = statusText === "resolved" || statusText === "completed";
      const isPotholeOrMine = t.display_type.toLowerCase().includes("pothole") || t.is_my_territory;
      return !isResolved && isPotholeOrMine;
    });

    const displayDepartmentName = role === 'CE' ? "Goa State Operations" : role === 'EE' ? `${eeDistrict} Operations` : (myDept?.department_name || "Unknown");

    return NextResponse.json({
      success: true,
      currentUser: { name: userName, level: userLevel, taluka: userTaluka, role: role },
      departments: [{
          department_name: displayDepartmentName,
          tickets: activeTicketsOnly,
          total_reports: activeTicketsOnly.length,
          pending_reports: activeTicketsOnly.filter((t) => t.is_my_territory).length,
      }],
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}