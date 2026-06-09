import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ytmuudbkuhkfqkzchtce.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem'; // This is safe to expose in the frontend for RLS databases

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(2);
    console.log(JSON.stringify(data, null, 2));
}
run();
