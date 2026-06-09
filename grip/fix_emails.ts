import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ytmuudbkuhkfqkzchtce.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data } = await supabase.from('departments').select('id, contact_email');
    for (const dept of data || []) {
        if (dept.contact_email.includes('(') || dept.contact_email.includes(')')) {
            const fixed = dept.contact_email.replace(/[()]/g, '');
            console.log('Fixing', dept.contact_email, '->', fixed);
            await supabase.from('departments').update({ contact_email: fixed }).eq('id', dept.id);
        }
    }
    console.log('Done!');
}
run();
