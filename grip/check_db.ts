import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ytmuudbkuhkfqkzchtce.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('work_orders').select('*').limit(1);
    console.log(data);
    console.log(error);
}
run();