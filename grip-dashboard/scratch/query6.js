import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: depts } = await supabase.from('departments').select('id').eq('taluka_name', 'Ponda').single();
  console.log("Ponda Dept ID:", depts?.id);
  
  if (depts?.id) {
    const { data: workers } = await supabase.from('field_workers').select('id, worker_name').eq('department_id', depts.id);
    console.log("Ponda Workers:", workers);
    
    if (workers && workers.length > 0) {
      const workerIds = workers.map(w => w.id);
      const { data: wos } = await supabase.from('work_orders').select('*').in('worker_id', workerIds);
      console.log("Ponda Work Orders Count:", wos?.length);
      console.log("Ponda Work Orders Sample:", wos?.slice(0,2));
    }
  }
}

check();
