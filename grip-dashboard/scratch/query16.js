import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: depts } = await supabase.from('departments').select('*').eq('officer_in_charge', 'Chief Officer');
  console.log("Chief Officer Dept:", depts);
}

check();
