import { MapPin } from "lucide-react";

export default function PanchayatResolved({ myAssignedTickets }: { myAssignedTickets: any[] }) {
  // Filter for resolved tickets
  const reports = myAssignedTickets.filter((t: any) => {
      const statusText = (t.status || "").toLowerCase().trim();
      return statusText === "resolved" || statusText === "completed";
  });

  return (
    <div className="bg-slate-50 font-sans">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
             Completed Cleanups
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
             Historical audit log of waste clearance and garbage collection completed by your Panchayat.
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm shadow-sm">
          {reports.length} Total Clearances Logged
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
                <th className="p-5">Waste Type</th>
                <th className="p-5">Location</th>
                <th className="p-5">Completed By</th>
                <th className="p-5">Date Reported</th>
                <th className="p-5">SLA Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((task) => {
                let resolvedDate = 'Time Unknown';
                const dateField = task.resolved_at || task.created_at;
                if (dateField) {
                  // Ensure Supabase timestamp is treated as UTC if it lacks a timezone designator
                  const isUTC = dateField.endsWith('Z') || dateField.includes('+');
                  const dateStr = isUTC ? dateField : `${dateField}Z`;
                  resolvedDate = new Date(dateStr).toLocaleString('en-IN', { 
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium', 
                    timeStyle: 'short' 
                  });
                }
                
                return (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-5">
                      <span className="block font-bold text-slate-800 capitalize">{(task.display_type || task.issue_type || 'Unclassified').replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-400 font-mono">#{String(task.id).substring(0, 8)}</span>
                    </td>
                    <td className="p-5">
                      <span className="font-semibold text-slate-700 block flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-slate-400" />
                        {task.village_name || 'Coordinates Logged'}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs mr-3">
                          {task.worker_name ? task.worker_name.charAt(0) : 'P'}
                        </div>
                        <span className="font-semibold text-slate-700">
                           {task.worker_name || 'Panchayat Team'} 
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
                    <span className="text-4xl block mb-3">♻️</span>
                    <p className="font-bold text-lg text-slate-700">No resolved tasks found</p>
                    <p className="text-sm mt-1">When garbage clearances are completed, they will appear in this audit log.</p>
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
