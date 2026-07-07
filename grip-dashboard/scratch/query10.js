import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const safeUserEmail = 'admin.ponda@grip-goa.online';
  
  const { data: allDepts } = await supabase.from("departments").select("*");
  const aeDept = allDepts?.find(d => d.contact_email && d.contact_email.trim().toLowerCase() === safeUserEmail);
  
  console.log("AE Dept:", aeDept?.department_name, "ID:", aeDept?.id);
  
  const { data: workers } = await supabase.from("field_workers").select("id, worker_name, department_id").eq("department_id", aeDept?.id);
  const workerIds = workers?.map(w => w.id) || [];
  console.log("Workers:", workerIds);
  
  let relevantWorkOrders = [];
  if (workerIds.length > 0) {
    const { data: wo } = await supabase.from("work_orders").select("*").in("worker_id", workerIds);
    relevantWorkOrders = wo || [];
  }
  
  console.log("Relevant WOs:", relevantWorkOrders.map(wo => wo.id));
}

check();
