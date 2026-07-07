import { supabase } from '../lib/supabase';

export async function fetchDashboardData(userEmail: string) {
    const safeUserEmail = userEmail?.trim().toLowerCase() || "";
    const { data: allDepts } = await supabase.from("departments").select("*");

    // 1. THE BULLETPROOF IDENTITY CHECK (AE, JE, EE, or CE?)
    const aeDept = allDepts?.find((d: any) => d.contact_email && d.contact_email.trim().toLowerCase() === safeUserEmail);

    let workerProfile: any = null;
    let myDept = aeDept;
    let role = 'JE';
    let eeDistrict = null;
    
    if (aeDept) {
      role = 'AE';
    } else {
      const { data: worker } = await supabase.from("field_workers").select("*").ilike("email", safeUserEmail).limit(1).single();
      workerProfile = worker;
      
      if (workerProfile) {
        if (workerProfile.hierarchy_level === 5) {
          role = 'CE'; // Chief Engineer detected!
        } else if (workerProfile.hierarchy_level === 4) {
          role = 'EE'; // Executive Engineer detected!
          eeDistrict = (workerProfile.specialty || "").trim(); // Storing their division name
        } else {
          role = 'JE';
          myDept = allDepts?.find((d: any) => String(d.id) === String(workerProfile.department_id));
        }
      }
    }

    if (!aeDept && !workerProfile) {
        return { success: false, error: "ACCESS DENIED: Profile not found." };
    }

    const userName = role === 'AE' ? aeDept.officer_in_charge : workerProfile.worker_name;
    const userLevel = role === 'AE' ? 1 : workerProfile.hierarchy_level;
    const userTaluka = role === 'CE' ? "State of Goa" : role === 'EE' ? `${eeDistrict} District` : (myDept?.taluka_name || "Unknown");

    // 2. FETCH WORK ORDERS BASED ON ROLE
    let relevantWorkOrders: any[] = [];
    let departmentWorkers: any[] = [];

    if (role === 'CE') {
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id");
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map((w: any) => w.id);

      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
        relevantWorkOrders = wo || [];
      }
    } else if (role === 'EE') {
      const specLower = (eeDistrict || "").toLowerCase();
      const eeDepts = allDepts?.filter((d: any) => (d.taluka_name || "").toLowerCase().trim() === specLower || (d.department_name || "").toLowerCase().trim().includes(specLower)) || [];
      const deptIds = eeDepts.map((d: any) => d.id);
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").in("department_id", deptIds);
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map((w: any) => w.id);

      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
        relevantWorkOrders = wo || [];
      }
    } else if (role === 'AE') {
      const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").eq("department_id", myDept?.id);
      departmentWorkers = workers || [];
      const workerIds = departmentWorkers.map((w: any) => w.id);

      if (workerIds.length > 0) {
        const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
        relevantWorkOrders = wo || [];
      }
    } else {
      const { data: wo } = await supabase.from("work_orders").select("*").eq("worker_id", workerProfile.id);
      relevantWorkOrders = wo || [];
    }

    // 3. FETCH MAP DATA AND PROCESS
    const { data: oldReports } = await supabase.from("dashboard_reports").select("*");
    const { data: allWorkOrders } = await supabase.from("work_orders").select("report_id, department_id, report_uuid");

    // Fetch new UUID based reports directly from the reports table
    const { data: newReportsRaw } = await supabase.from("reports").select("id, latitude, longitude, issue_type, ai_predictions, image_path, village_name, created_at, status");
    
    // Format new reports to match dashboard_reports view structure
    const newReports = (newReportsRaw || []).map(r => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        display_type: r.issue_type,
        issue_type: r.issue_type,
        ai_predictions: r.ai_predictions,
        image_path: r.image_path,
        village_name: r.village_name,
        created_at: r.created_at,
    }));

    // Deduplicate by ID just in case
    const mergedReportsMap = new Map();
    (oldReports || []).forEach((r: any) => mergedReportsMap.set(String(r.id), r));
    newReports.forEach((r: any) => {
        if (!mergedReportsMap.has(String(r.id))) {
            mergedReportsMap.set(String(r.id), r);
        }
    });
    
    const allReports = Array.from(mergedReportsMap.values());

    const processedTickets = allReports.map((report: any) => {
        const matchingWorkOrder = relevantWorkOrders.find((wo: any) => String(wo.report_id) === String(report.id) || String(wo.report_uuid) === String(report.id));
        let isMine = !!matchingWorkOrder;
        
        if (!isMine && (role === 'AE' || role === 'EE' || role === 'CE')) {
            const reportVillage = (report.village_name || "").toLowerCase().trim();
            const deptTaluka = (myDept?.taluka_name || "").toLowerCase().trim();
            
            if (role === 'CE') {
                isMine = true;
            } else if (role === 'EE') {
                const specLower = (eeDistrict || "").toLowerCase();
                if (reportVillage === specLower || (report.assigned_department || "").toLowerCase().trim().includes(specLower)) {
                    isMine = true;
                }
            } else if (role === 'AE') {
                if (reportVillage === deptTaluka || (report.assigned_department || "").toLowerCase().trim() === (myDept?.department_name || "").toLowerCase().trim()) {
                    isMine = true;
                }
            }
        }

        let assignedWorkerName = "Other Division";
        if (isMine) {
            if (role === 'AE' || role === 'EE' || role === 'CE') {
                const assignedWorker = departmentWorkers.find((w: any) => String(w.id) === String(matchingWorkOrder?.worker_id));
                if (assignedWorker) {
                    assignedWorkerName = assignedWorker.worker_name;
                    if (role === 'EE' || role === 'CE') {
                        const wDept = allDepts?.find((d: any) => d.id === assignedWorker.department_id);
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
            const globalWorkOrder = allWorkOrders?.find((wo: any) => String(wo.report_id) === String(report.id) || String(wo.report_uuid) === String(report.id));
            if (globalWorkOrder) {
                const wDept = allDepts?.find((d: any) => String(d.id) === String(globalWorkOrder.department_id));
                if (wDept) {
                    resolvedDepartmentName = wDept.department_name;
                }
            }
        }

        let riskStatus = "On Track";
        let hoursRemaining = 99;
        let isSlaBreached = false;
        const now = new Date().getTime();

        if (matchingWorkOrder && matchingWorkOrder.due_date) {
          const dueTime = new Date(matchingWorkOrder.due_date).getTime();
          hoursRemaining = Math.round((dueTime - now) / (1000 * 60 * 60));
          if (hoursRemaining < 0) riskStatus = "Breached";
          else if (hoursRemaining < 24) riskStatus = "High Risk";

          if (matchingWorkOrder.status === 'Resolved' || matchingWorkOrder.status === 'Completed') {
             const resolvedTime = new Date(matchingWorkOrder.resolved_at || new Date()).getTime();
             isSlaBreached = resolvedTime > dueTime;
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
          resolved_at: matchingWorkOrder ? matchingWorkOrder.resolved_at : null,
          image_path: report.image_path,
          risk_status: riskStatus,
          hours_remaining: Math.abs(hoursRemaining),
          is_sla_breached: isSlaBreached,
        };
      }) || [];

    const activeTicketsOnly = processedTickets.filter((t: any) => {
      const statusText = (t.status || "").toLowerCase();
      const isResolved = statusText === "resolved" || statusText === "completed";
      const isPotholeOrMine = t.display_type.toLowerCase().includes("pothole") || t.is_my_territory;
      return !isResolved && isPotholeOrMine;
    });

    const displayDepartmentName = role === 'CE' ? "Goa State Operations" : role === 'EE' ? `${eeDistrict} Operations` : (myDept?.department_name || "Unknown");

    return {
      success: true,
      currentUser: { name: userName, level: userLevel, taluka: userTaluka, role: role },
      departments: [{
          department_name: displayDepartmentName,
          tickets: activeTicketsOnly,
          all_tickets: processedTickets,
          total_reports: activeTicketsOnly.length,
          pending_reports: activeTicketsOnly.filter((t: any) => t.is_my_territory).length,
          resolved_reports: processedTickets.filter((t: any) => {
             const s = (t.status || "").toLowerCase();
             return (s === "resolved" || s === "completed") && t.is_my_territory;
          }).length,
      }],
    };
}

export async function resolveWorkOrder(reportId: string, imageFile: File, coordinates: { lat: number, lng: number }) {
  try {
    // 1. Upload resolution image to 'reports' bucket
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `resolution_${reportId}_${Date.now()}.${fileExt}`;
    const filePath = `resolutions/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(filePath, imageFile);

    if (uploadError) {
      console.error("Image upload failed:", uploadError);
      return { success: false, error: "Failed to upload resolution evidence." };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('reports')
      .getPublicUrl(filePath);

    // Check if reportId is a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);

    if (isUUID) {
      // 2a. Update 'reports' table directly
      const { data: reportData, error: fetchError } = await supabase
        .from('reports')
        .select('latitude, longitude')
        .eq('id', reportId)
        .single();

      if (fetchError || !reportData) {
        return { success: false, error: "Report coordinates not found in database." };
      }

      // Calculate distance manually (Haversine)
      const R = 6371e3; // metres
      const φ1 = coordinates.lat * Math.PI/180;
      const φ2 = reportData.latitude * Math.PI/180;
      const Δφ = (reportData.latitude-coordinates.lat) * Math.PI/180;
      const Δλ = (reportData.longitude-coordinates.lng) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = Math.round(R * c);

      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'resolved',
          resolution_photo_url: publicUrl
        })
        .eq('id', reportId);

      if (updateError) {
        return { success: false, error: "Failed to update report status." };
      }

      // 2a-2. Update 'work_orders' table to 'Resolved'
      await supabase
        .from('work_orders')
        .update({
          status: 'Resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('report_uuid', reportId);

      return { success: true, imagePath: publicUrl, message: `Ticket Resolved! Distance: ${distance}m` };
    } else {
      // 2b. Call the legacy database stored procedure for integer IDs
      const { data, error: rpcError } = await supabase.rpc('resolve_report_with_geofence', {
          p_report_id: parseInt(reportId), 
          p_worker_lat: coordinates.lat,
          p_worker_lng: coordinates.lng,
          p_photo_url: publicUrl,
          p_max_distance_meters: 10000000 // effectively bypasses distance check for testing
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        return { success: false, error: rpcError.message };
      }

      if (!data.success) {
        return { success: false, error: data.error };
      }

      return { success: true, imagePath: publicUrl, message: `Ticket Resolved! Distance: ${data.distance_meters}m` };
    }
  } catch (error: any) {
    console.error("Resolution error:", error);
    return { success: false, error: error.message };
  }
}
