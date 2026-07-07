import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('query', { sql: "SELECT pg_get_viewdef('dashboard_reports');" });
  console.log("View Def:", data);
  console.log("Error:", error);
}

check();
