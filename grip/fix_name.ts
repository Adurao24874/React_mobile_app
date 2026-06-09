import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ytmuudbkuhkfqkzchtce.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { error } = await supabase.from('departments').update({department_name: 'Village Panchayat Socorro (Serula)'}).eq('id', 1049);
    console.log('Fixed name!', error);
}
run();