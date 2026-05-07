"use client";

import { useEffect, useState } from 'react';

interface ResolvedTask {
  work_order_id: string;
  category_name: string;
  department_name: string;
  village_name: string | null;
  worker_name: string | null;
  resolved_at: string;
  due_date: string;
  is_sla_breached: boolean;
}

export default function ResolvedPage() {
  const [tasks, setTasks] = useState<ResolvedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/resolved')
      .then(res => res.json())
      .then(json => {
        if (json.success) setTasks(json.resolvedTasks);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 font-bold text-slate-600">Loading Audit Logs...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Resolved Actions</h1>
          <p className="text-slate-500 mt-1 font-medium">Historical audit log of all completed infrastructure repairs.</p>
        </div>
        <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm">
          {tasks.length} Total Repairs
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
              <th className="p-5">Work Order</th>
              <th className="p-5">Location</th>
              <th className="p-5">Completed By</th>
              <th className="p-5">Resolution Time</th>
              <th className="p-5">SLA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => {
              // Format the dates to look clean
              const resolvedDate = new Date(task.resolved_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
              
              return (
                <tr key={task.work_order_id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-5">
                    <span className="block font-bold text-slate-800">{task.category_name}</span>
                    <span className="text-xs text-slate-400 font-mono">#WO-{task.work_order_id}</span>
                  </td>
                  <td className="p-5">
                    <span className="font-semibold text-slate-700 block">{task.village_name || 'Village Unknown'}</span>
                    <span className="text-xs text-slate-500">{task.department_name}</span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mr-3">
                        {task.worker_name ? task.worker_name.charAt(0) : '?'}
                      </div>
                      <span className="font-semibold text-slate-700">{task.worker_name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-600">
                    {resolvedDate}
                  </td>
                  <td className="p-5">
                    {task.is_sla_breached ? (
                      <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200">
                        Late Resolution
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                        On Time
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                  No resolved tasks found in the database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}