import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('citizen_reports').select('*').limit(3);
  console.log("Citizen Reports Data:", data);
  console.log("Error:", error);
}

check();
