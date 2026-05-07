import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch only the PWD Departments from your database
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('department_type', 'PWD_DIVISION'); // This acts as your SQL WHERE clause

    if (deptError) throw deptError;

    // 2. Fetch the reports to calculate the dynamic numbers
    // Note: We use 'citizen_reports' based on your previous terminal errors!
    const { data: reports, error: reportError } = await supabase
      .from('citizen_reports')
      .select('*');

    if (reportError) throw reportError;

    // 3. Compile the data mathematically (Replacing the complex SQL JOINs)
    const enhancedDepartments = departments.map((dept) => {
      // Find all reports assigned to this specific PWD division
      const deptReports = reports.filter(
        (r) => r.assigned_department === dept.department_name
      );

      // Calculate the stats
      const total = deptReports.length;
      
      const resolved = deptReports.filter(
        (r) => r.status?.toLowerCase() === 'resolved' || r.status?.toLowerCase() === 'completed'
      ).length;

      // Calculate Active Breaches (Pending issues past their deadline)
      const breaches = deptReports.filter((r) => {
        if (r.status?.toLowerCase() === 'resolved' || r.status?.toLowerCase() === 'completed') {
          return false;
        }
        if (r.escalation_deadline) {
          const deadline = new Date(r.escalation_deadline).getTime();
          const now = new Date().getTime();
          return now > deadline; // It's a breach if NOW is past the deadline
        }
        return false;
      }).length;

      // Return the perfectly formatted object
      return {
        department_id: dept.id,
        department_name: dept.department_name,
        taluka_name: dept.taluka_name,
        department_type: dept.department_type,
        officer_in_charge: dept.officer_in_charge || 'Executive Engineer',
        contact_email: dept.contact_email,
        
        // Calculated Metrics
        total_reports: total,
        resolved_reports: resolved,
        active_breaches: breaches,
        
        // Mocking field workers for now to prevent crashes. 
        // If you have a 'field_workers' table, you can query it and measure the length here later!
        total_workers: Math.floor(Math.random() * 8) + 4, 
      };
    });

    return NextResponse.json({ success: true, departments: enhancedDepartments });

  } catch (error: any) {
    console.error("Departments API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Database fetch failed" }, 
      { status: 500 }
    );
  }
}