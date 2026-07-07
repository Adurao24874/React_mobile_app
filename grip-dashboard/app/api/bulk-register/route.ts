import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

// Helper function to slow down our loop so Supabase doesn't block us
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  try {
    // 1. Fetch secretaries, but ONLY the ones who don't have an auth_user_id yet
    // We limit it to 30 at a time to stay safely under the radar.
    const { data: secretaries, error: fetchError } = await supabaseAdmin
      .from('field_workers')
      .select('id, email, worker_name')
      .ilike('worker_name', 'Secretary%')
      .is('auth_user_id', null) // <-- Only grabs unprocessed rows!
      .not('email', 'is', null)
      .limit(30); 

    if (fetchError) throw fetchError;
    
    // If it finds 0 unprocessed secretaries, it means you are completely finished!
    if (!secretaries || secretaries.length === 0) {
        return NextResponse.json({ 
            success: true, 
            message: "🎉 ALL 402 SECRETARIES HAVE BEEN SUCCESSFULLY REGISTERED! You can delete this file now." 
        });
    }

    let successCount = 0;
    let errors = [];

    // 2. Process the batch of 30
    for (const sec of secretaries) {
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: sec.email,
        password: 'Panchayat2026!', 
        email_confirm: true         
      });

      if (createError) {
        errors.push({ email: sec.email, error: createError.message });
      } else {
        // Link the Auth ID back to the table
        await supabaseAdmin
          .from('field_workers')
          .update({ auth_user_id: authData.user.id })
          .eq('id', sec.id);
          
        successCount++;
      }
      
      // Wait 300 milliseconds before sending the next request
      await sleep(300); 
    }

    return NextResponse.json({ 
      success: true, 
      message: `Batch complete: Registered ${successCount} users. REFRESH THE PAGE to process the next batch!`, 
      errors_encountered: errors 
    });

  } catch (error: any) {
    console.error("Bulk Registration Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}