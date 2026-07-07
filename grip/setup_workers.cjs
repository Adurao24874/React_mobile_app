const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://ytmuudbkuhkfqkzchtce.supabase.co', 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem');
const PASSWORD = 'Panchayat2026!';

async function setupWorkers() {
    console.log("Starting worker authentication setup...");

    // 1. Add sw1.socorro@grip-goa.online
    const socorroEmail = 'sw1.socorro@grip-goa.online';
    console.log(`Adding specific worker: ${socorroEmail}`);
    
    // Check if worker exists in field_workers
    const { data: existing } = await supabase.from('field_workers').select('*').eq('email', socorroEmail);
    
    if (!existing || existing.length === 0) {
        const { data: inserted, error: insertErr } = await supabase.from('field_workers').insert([{
            worker_name: 'Socorro Sanitation Worker 1',
            specialty: 'Sanitation',
            department_id: 1049, // Village Panchayat Socorro
            email: socorroEmail,
            hierarchy_level: 1,
            is_available: true
        }]).select();
        
        if (insertErr) console.error("Error inserting sw1.socorro:", insertErr);
        else console.log("Successfully inserted sw1.socorro into field_workers.");
    } else {
        console.log("sw1.socorro already exists in field_workers.");
    }

    // Sign up sw1.socorro
    const { error: signUpErr1 } = await supabase.auth.signUp({
        email: socorroEmail,
        password: PASSWORD
    });
    if (signUpErr1) console.log(`Auth for ${socorroEmail} already exists or error:`, signUpErr1.message);
    else console.log(`Created auth account for ${socorroEmail}`);


    // 2. Authenticate ALL sanitation workers
    console.log("Fetching all sanitation/waste workers...");
    const { data: workers, error: fetchErr } = await supabase.from('field_workers').select('*').or('specialty.ilike.%Sanitation%,specialty.ilike.%Waste%');
    
    if (fetchErr) {
        console.error("Failed to fetch workers", fetchErr);
        return;
    }
    
    console.log(`Found ${workers.length} sanitation workers. Authenticating...`);
    let successCount = 0;
    let existCount = 0;
    
    // Process in batches so we don't hit rate limits instantly
    const batchSize = 10;
    for (let i = 0; i < workers.length; i += batchSize) {
        const batch = workers.slice(i, i + batchSize);
        const promises = batch.map(async (worker) => {
            if (!worker.email) return;
            
            const { data, error } = await supabase.auth.signUp({
                email: worker.email,
                password: PASSWORD
            });
            
            if (error) {
                // "User already registered" is expected for some
                existCount++;
            } else {
                successCount++;
                // Update their auth_user_id in field_workers if successfully signed up
                if (data.user) {
                    await supabase.from('field_workers').update({ auth_user_id: data.user.id }).eq('id', worker.id);
                }
            }
        });
        await Promise.all(promises);
        process.stdout.write(`Processed ${Math.min(i + batchSize, workers.length)} / ${workers.length}\r`);
    }
    
    console.log(`\nComplete! Created ${successCount} new auth accounts. ${existCount} already existed or failed.`);
}

setupWorkers();
