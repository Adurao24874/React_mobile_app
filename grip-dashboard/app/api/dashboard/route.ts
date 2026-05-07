import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch ALL reports (We fetch once and calculate KPIs in memory to save database calls)
    const { data: reports, error: reportError } = await supabase
      .from('reports') // <-- MUST MATCH YOUR TABLE NAME
      .select('*')
      .order('created_at', { ascending: false });

    if (reportError) {
      throw reportError;
    }

    if (!reports) {
      return NextResponse.json({ success: true, kpis: {}, markers: [], reports: [] });
    }

    // 2. Calculate KPIs mathematically (Replacing the SQL FILTER WHERE clauses)
    const totalPending = reports.filter(r => r.status?.toLowerCase() === 'pending').length;
    const totalDispatched = reports.filter(r => r.status?.toLowerCase() === 'dispatched').length;
    const totalResolved = reports.filter(
      r => r.status?.toLowerCase() === 'completed' || r.status?.toLowerCase() === 'resolved'
    ).length;

    const kpis = {
      total_pending: totalPending,
      total_dispatched: totalDispatched,
      total_resolved: totalResolved
    };

    // 3. Format Map Markers
    const markers = reports.map(r => ({
      id: r.id,
      lat: r.latitude,
      lng: r.longitude,
      issue_type: r.issue_type,
      status: r.status,
      ai_predictions: null // Adjust this if you store AI data in a specific column
    }));

    // 4. Format Enhanced Reports (Recreating the LEFT JOIN logic)
    const enhancedReports = reports.map(r => {
      // Calculate SLA Risk dynamically based on the escalation_deadline
      let riskStatus = "On Track";
      let hoursRemaining = 0;

      if (r.escalation_deadline && r.status !== 'resolved' && r.status !== 'completed') {
        const deadline = new Date(r.escalation_deadline).getTime();
        const now = new Date().getTime();
        const hoursDiff = Math.round((deadline - now) / (1000 * 60 * 60));
        
        hoursRemaining = hoursDiff;

        if (hoursDiff < 0) {
          riskStatus = "Breached";
        } else if (hoursDiff <= 12) {
          riskStatus = "High Risk";
        }
      }

      return {
        id: r.id,
        issue_type: r.issue_type,
        village_name: r.assigned_department || 'Unknown', 
        timestamp: new Date(r.created_at).getTime(),
        status: r.status,
        ai_predictions: null, 
        latitude: r.latitude,
        longitude: r.longitude,
        image_path: r.image_url, // Maps to your Supabase Storage column name
        resolution_photo_url: r.resolution_photo_url, 
        user_email: r.citizen_email, 
        created_at: r.created_at,            
        escalation_deadline: r.escalation_deadline,   
        worker_name: r.assigned_department || 'Pending Assignment',
        hours_remaining: hoursRemaining,
        risk_status: riskStatus
      };
    });

    return NextResponse.json({
      success: true,
      kpis: kpis,
      markers: markers,
      reports: enhancedReports 
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Database fetch failed" }, 
      { status: 500 }
    );
  }
}