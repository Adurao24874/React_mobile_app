"use client";

import { useEffect, useState } from 'react';

interface Worker {
  worker_id: number;
  worker_name: string;
  specialty: string;
  phone_number: string;
  department_name: string;
  taluka_name: string;
  active_tasks: string | number;
  is_available: boolean;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workers')
      .then(res => res.json())
      .then(json => {
        if (json.success) setWorkers(json.workers);
        setLoading(false);
      });
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
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Field Workers Roster</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage PWD personnel and monitor active task loads across all Talukas.</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm border border-blue-200">
          {workers.length} Total Active Staff
        </div>
      </div>

      {/* Iterate through each Taluka group */}
      {Object.entries(groupedWorkers).map(([taluka, talukaWorkers]) => (
        <div key={taluka} className="mb-12">
          
          {/* Taluka Section Header */}
          <div className="flex items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{taluka} Taluka</h2>
            <div className="ml-4 h-px flex-1 bg-slate-200"></div>
            <span className="ml-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
              {talukaWorkers.length} Workers
            </span>
          </div>

          {/* Workers Grid for this specific Taluka */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {talukaWorkers.map((worker) => (
              <div key={worker.worker_id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow">
                
                {/* Header: Name and Status */}
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
                
                {/* Body: Contact & Location */}
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

                {/* Footer: Workload */}
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