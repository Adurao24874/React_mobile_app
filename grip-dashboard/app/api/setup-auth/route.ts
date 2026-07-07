import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // We MUST use the Service Role Key to bypass security and create users automatically
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch all workers who don't have an auth account yet
    const { data: workers, error: fetchError } = await supabaseAdmin
      .from('field_workers')
      .select('id, email, worker_name')
      .is('auth_user_id', null);

    if (fetchError) throw fetchError;
    if (!workers || workers.length === 0) {
      return NextResponse.json({ message: "All workers already have accounts!" });
    }

    let createdCount = 0;

    // 2. Loop through every worker and create their login
    for (const worker of workers) {
      // Create the Auth User with a default password
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: worker.email,
        password: 'Password123!', // The default password for everyone
        email_confirm: true, // Skip the email verification step
      });

      if (authError) {
        console.error(`Failed to create auth for ${worker.email}:`, authError);
        continue; // Skip to the next one if this fails
      }

      // 3. Link the new Auth ID back to the field_workers table
      if (authData.user) {
        await supabaseAdmin
          .from('field_workers')
          .update({ auth_user_id: authData.user.id })
          .eq('id', worker.id);
        
        createdCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully created and linked ${createdCount} accounts!` 
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}