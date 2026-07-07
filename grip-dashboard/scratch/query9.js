import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data } = await supabase.from('departments').select('id, taluka_name').eq('taluka_name', 'Ponda');
  console.log("Ponda:", data);
}

check();
