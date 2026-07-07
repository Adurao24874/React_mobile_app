import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  try {
    // 1. Verify the user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Find out if this is the North or South GWMC Worker
    const { data: worker } = await supabase
      .from('field_workers')
      .select('worker_name, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!worker) {
      return NextResponse.json({ success: false, error: 'GWMC Profile not found' }, { status: 400 });
    }

    // 3. Determine Jurisdiction based on their email
    const isNorth = worker.email.includes('north');
    const jurisdictionName = isNorth ? 'North Goa District' : 'South Goa District';

    // 4. Map the Talukas to their respective Districts
    // (Feel free to move Ponda to North if your specific administrative mapping requires it)
    const northTalukas = ['Tiswadi', 'Bardez', 'Pernem', 'Bicholim', 'Sattari'];
    const southTalukas = ['Ponda', 'Salcete', 'Mormugao', 'Quepem', 'Sanguem', 'Dharbandora', 'Canacona'];
    
    const myTalukas = isNorth ? northTalukas : southTalukas;

    // 5. Fetch ALL villages that belong to this District's Talukas
    const { data: districtVillages } = await supabase
      .from('departments')
      .select('department_name')
      .in('taluka_name', myTalukas); // Retrieves villages for ALL 5-7 talukas at once!

    const validVillageNames = districtVillages?.map(v => v.department_name) || [];

    // 6. Fetch ALL reports
    const { data: allReports, error: reportsError } = await supabase
      .from('reports')
      .select('*');

    if (reportsError) throw reportsError;

    // 7. Format the data and claim territory
    const formattedTickets = (allReports || []).map((report) => {
      const reportVillage = report.village_name || 'Unknown Village';
      const safeReportVillage = reportVillage.toLowerCase().trim();
      
      // Check if the report belongs to this district
      let isMine = validVillageNames.some(village => {
        const safeVillage = (village || '').toLowerCase().trim();
        return safeVillage.includes(safeReportVillage) || safeReportVillage.includes(safeVillage);
      });

      // 🔥 UNCOMMENT THIS LINE IF YOU TRULY WANT NORTH GOA TO SEE THE WHOLE STATE (BOTH):
      // if (isNorth) isMine = true; 
      
      return {
        ...report,
        village_name: reportVillage,
        is_my_territory: isMine 
      };
    });

    const pendingCount = formattedTickets.filter(t => t.is_my_territory && t.status === 'pending').length;

    // 8. Send the payload back
    return NextResponse.json({
      success: true,
      currentUser: { jurisdiction: jurisdictionName },
      tickets: formattedTickets,
      pending_reports: pendingCount
    });

  } catch (error: any) {
    console.error("GWMC API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}