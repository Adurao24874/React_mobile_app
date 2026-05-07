import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Make sure this path is correct!

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch from your central table with Supabase filters
    const { data: reports, error } = await supabase
      .from('reports') // Your main table
      .select('*')
      .in('status', ['resolved', 'completed', 'Resolved', 'Completed']) // Must be resolved
      .ilike('issue_type', '%pothole%') // Must be a pothole
     
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 2. Map the Supabase data to the format your React frontend expects
    const formattedTasks = (reports || []).map((r) => {
      // Calculate SLA breach dynamically 
      let isBreached = false;
      
      // Use 'updated_at' as the resolution time, fallback to 'created_at' if missing
      const resolutionTimestamp = r.updated_at || r.created_at || new Date().toISOString();
      const resolvedTime = new Date(resolutionTimestamp).getTime();

      if (r.escalation_deadline) {
         const deadline = new Date(r.escalation_deadline).getTime();
         isBreached = resolvedTime > deadline; // It's breached if resolved AFTER deadline
      }

      return {
        // We use split('-')[0] to shorten long UUIDs into a readable Work Order number
        work_order_id: String(r.id).split('-')[0], 
        category_name: (r.issue_type || 'Pothole').replace(/_/g, ' ').toUpperCase(),
        department_name: r.assigned_department || 'PWD Office',
        village_name: r.village_name || r.assigned_department?.replace('PWD Division ', '') || 'Unknown Location',
        worker_name: r.worker_name || 'Field Team',
        resolved_at: resolutionTimestamp,
        due_date: r.escalation_deadline || new Date().toISOString(),
        is_sla_breached: isBreached
      };
    });

    return NextResponse.json({ success: true, resolvedTasks: formattedTasks });

  } catch (error: any) {
    console.error("Resolved API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Database fetch failed" }, 
      { status: 500 }
    );
  }
}