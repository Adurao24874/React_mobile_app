import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: workers } = await supabase.from('field_workers').select('id, worker_name').eq('department_id', 417);
  console.log("Ponda MC Workers:", workers);
  
  if (workers && workers.length > 0) {
      const workerIds = workers.map(w => w.id);
      const { data: wos } = await supabase.from('work_orders').select('*').in('worker_id', workerIds);
      console.log("Ponda MC WOs:", wos?.length);
  }
}

check();
