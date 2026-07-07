import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('departments').select('*').ilike('contact_email', 'admin.ponda@grip-goa.online');
  console.log("Depts for Ponda:", data);
  console.log("Error:", error);
}

check();
