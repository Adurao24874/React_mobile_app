import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('work_orders').select('*').limit(5);
  console.log("Work Orders Data:", data);
  console.log("Error:", error);
}

check();
