import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Worker {
  worker_id: string;
  worker_name: string;
  specialty: string;
  phone_number: string;
  department_name: string;
  taluka_name: string;
  active_tasks: string | number;
  is_available: boolean;
}

export default function PWDWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkers() {
      setLoading(true);
      try {
        const { data: deptData } = await supabase.from('departments').select('id, department_name, taluka_name');
        const { data: workerData } = await supabase.from('field_workers').select('*');
        const { data: activeOrders } = await supabase.from('work_orders').select('worker_id, status').in('status', ['Pending', 'In Progress', 'Assigned']);

        if (workerData && deptData) {
          const mappedWorkers: Worker[] = workerData.map((w: any) => {
            const dept = deptData.find((d: any) => d.id === w.department_id);
            const taskCount = activeOrders ? activeOrders.filter((wo: any) => wo.worker_id === w.id).length : 0;
            return {
              worker_id: String(w.id),
              worker_name: w.worker_name,
              specialty: w.specialty || 'General',
              phone_number: w.phone_number || 'N/A',
              department_name: dept?.department_name || 'Unknown',
              taluka_name: dept?.taluka_name || 'Unknown',
              active_tasks: taskCount,
              is_available: w.is_available ?? true
            };
          });
          setWorkers(mappedWorkers);
        }
      } catch (e) {
        console.error("Failed to load workers", e);
      }
      setLoading(false);
    }
    loadWorkers();
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center text-slate-600 font-bold">
      <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
      Loading Personnel Data...
    </div>
  );

  // Group the workers by their Taluka Name
  const groupedWorkers = workers.reduce((acc, worker) => {
    if (!acc[worker.taluka_name]) {
      acc[worker.taluka_name] = [];
    }
    acc[worker.taluka_name].push(worker);
    return acc;
  }, {} as Record<string, Worker[]>);

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Field Workers Roster</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage PWD personnel and monitor active task loads across all Talukas.</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm border border-blue-200">
          {workers.length} Total Active Staff
        </div>
      </div>

      {Object.entries(groupedWorkers).map(([taluka, talukaWorkers]) => (
        <div key={taluka} className="mb-12">
          <div className="flex items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{taluka} Taluka</h2>
            <div className="ml-4 h-px flex-1 bg-slate-200"></div>
            <span className="ml-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
              {talukaWorkers.length} Workers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {talukaWorkers.map((worker) => (
              <div key={worker.worker_id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-lg mr-3">
                      {worker.worker_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 leading-tight">{worker.worker_name}</h3>
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{worker.specialty}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md border ${
                    worker.is_available ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {worker.is_available ? 'Available' : 'Off-Duty'}
                  </span>
                </div>
                
                <div className="text-sm text-slate-600 space-y-2 flex-1">
                  <p className="flex items-center">
                    <span className="w-20 font-semibold text-slate-500">Dept:</span> 
                    {worker.department_name}
                  </p>
                  <p className="flex items-center">
                    <span className="w-20 font-semibold text-slate-500">Phone:</span> 
                    <span className="font-mono text-slate-700">+91 {worker.phone_number}</span>
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Tasks</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
                    Number(worker.active_tasks) > 3 ? 'bg-rose-500 text-white' : 
                    Number(worker.active_tasks) > 0 ? 'bg-amber-400 text-amber-900' : 
                    'bg-slate-800 text-white'
                  }`}>
                    {worker.active_tasks}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
