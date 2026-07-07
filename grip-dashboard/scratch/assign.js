import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  // Get a worker for Ponda (Dept 6)
  const { data: workers } = await supabase.from('field_workers').select('id').eq('department_id', 6);
  if (!workers || workers.length === 0) return console.log("No workers for Ponda");
  const workerId = workers[0].id;
  
  // Get some unassigned reports
  const { data: reports } = await supabase.from('dashboard_reports').select('id').limit(3);
  if (!reports || reports.length === 0) return console.log("No reports found");
  
  // Upsert work orders
  for (const report of reports) {
      const { error } = await supabase.from('work_orders').upsert({
          id: report.id,
          report_id: report.id,
          department_id: 6,
          worker_id: workerId,
          status: 'Pending',
          due_date: new Date().toISOString()
      });
      if (error) console.log("Error assigning", report.id, error);
      else console.log("Assigned report", report.id, "to Ponda worker", workerId);
  }
}

check();
