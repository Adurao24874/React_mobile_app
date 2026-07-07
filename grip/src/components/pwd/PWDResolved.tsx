import React from "react";

export default function PWDResolved({ myAssignedTickets, currentUser }: { myAssignedTickets: any[], currentUser: any }) {
  // Filter for resolved tickets
  const reports = myAssignedTickets.filter((t: any) => {
      const statusText = (t.status || "").toLowerCase();
      return statusText === "resolved" || statusText === "completed";
  });

  const userRole = currentUser?.role || 'JE';

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
             {userRole === 'AE' ? 'Department Resolved History' : 'My Resolved Actions'}
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
             {userRole === 'AE' 
                ? "Historical audit log of all infrastructure repairs completed by your division."
                : "Historical audit log of infrastructure repairs completed by you."}
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm shadow-sm">
          {reports.length} Total Repairs Logged
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
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
              {reports.map((task) => {
                let resolvedDate = 'Time Unknown';
                if (task.resolved_at) {
                  // Ensure Supabase timestamp is treated as UTC if it lacks a timezone designator
                  const isUTC = task.resolved_at.endsWith('Z') || task.resolved_at.includes('+');
                  const dateStr = isUTC ? task.resolved_at : `${task.resolved_at}Z`;
                  resolvedDate = new Date(dateStr).toLocaleString('en-IN', { 
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium', 
                    timeStyle: 'short' 
                  });
                }
                
                return (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-5">
                      <span className="block font-bold text-slate-800">{task.display_type || task.issue_type}</span>
                      <span className="text-xs text-slate-400 font-mono">#WO-{String(task.id).substring(0, 8)}</span>
                    </td>
                    <td className="p-5">
                      <span className="font-semibold text-slate-700 block">{task.assigned_department || 'Coordinates Logged'}</span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mr-3">
                          {task.worker_name ? task.worker_name.charAt(0) : 'U'}
                        </div>
                        <span className="font-semibold text-slate-700">
                           {task.worker_name || 'Unknown Worker'} 
                           {userRole === 'JE' && (
                             <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded ml-1 uppercase">You</span>
                           )}
                        </span>
                      </div>
                    </td>
                    <td className="p-5 text-sm font-medium text-slate-600">
                      {resolvedDate}
                    </td>
                    <td className="p-5">
                      {task.is_sla_breached ? (
                        <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 whitespace-nowrap">
                          Late Resolution
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 whitespace-nowrap">
                          On Time
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <span className="text-4xl block mb-3">🛠️</span>
                    <p className="font-bold text-lg text-slate-700">No resolved tasks found</p>
                    <p className="text-sm mt-1">When tasks are completed, they will appear in this audit log.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
