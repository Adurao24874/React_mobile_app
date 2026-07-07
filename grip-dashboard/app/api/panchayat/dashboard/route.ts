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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in API routes
          }
        },
      },
    }
  );

  try {
    // 2. Verify the user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Find exactly which Village Panchayat this Secretary oversees
    const { data: worker } = await supabase
      .from('field_workers')
      .select('departments!inner(department_name)')
      .eq('auth_user_id', user.id)
      .single();

    const myVillageName = worker?.departments?.department_name;

    if (!myVillageName) {
      return NextResponse.json({ success: false, error: 'No Village assigned' }, { status: 400 });
    }

    // 4. Fetch ALL reports (No SQL Joins needed anymore!)
    const { data: allReports, error: reportsError } = await supabase
      .from('reports')
      .select('*'); 

    if (reportsError) throw reportsError;

    // 5. Format the data for the frontend Map and Dashboard
    const formattedTickets = (allReports || []).map((report) => {
      // Grab the village name directly from the report row
      const reportVillage = report.village_name || 'Unknown Village';
      
      // THE NEW MAGIC TRICK: 
      // Check if the report's village matches the Secretary's department name
      // (Using .includes() makes it bulletproof just in case one says "Socorro" and the other says "Socorro Panchayat")
      const safeReportVillage = reportVillage.toLowerCase().trim();
      const safeMyVillage = (myVillageName || '').toLowerCase().trim();
      const isMine = safeMyVillage.includes(safeReportVillage) || safeReportVillage.includes(safeMyVillage);

      return {
        ...report,
        village_name: reportVillage,
        is_my_territory: isMine 
      };
    });

    // 6. Calculate exactly how many are pending for this specific secretary
    const pendingCount = formattedTickets.filter(t => t.is_my_territory && t.status === 'pending').length;

    // 7. Send the complete payload back to the dashboard
    return NextResponse.json({
      success: true,
      currentUser: { jurisdiction: myVillageName },
      tickets: formattedTickets,
      pending_reports: pendingCount
    });

  } catch (error: any) {
    console.error("Panchayat API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}