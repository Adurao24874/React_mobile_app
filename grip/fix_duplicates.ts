import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ytmuudbkuhkfqkzchtce.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    // 1. Delete the duplicate department
    await supabase.from('departments').delete().eq('id', 127);
    
    // 2. Fix the broken reports that failed during the infinite loop earlier
    await supabase.from('reports').update({status: 'pending'}).eq('status', 'failed');
    
    console.log('Fixed DB!');
}
run();