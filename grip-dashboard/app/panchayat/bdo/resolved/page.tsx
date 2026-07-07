"use client";

import { useEffect, useState } from 'react';

interface BDOResolvedReport {
  id: string;
  issue_type: string;
  village_name: string | null;
  worker_name: string | null;
  resolved_at: string; 
  is_sla_breached: boolean;
  resolution_photo_url: string | null;
  proof_type: 'GWMC_Receipt' | 'Geo_Photo';
}

export default function BDOResolvedPage() {
  const [reports, setReports] = useState<BDOResolvedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    // Fetch from the BDO Dashboard API
    fetch('/api/bdo/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.tickets) {
          
          // Filter for Resolved + Taluka + Waste
          const completedTickets = json.tickets.filter((r: any) => {
            if (!r.is_my_territory) return false;

            const status = (r.status || '').toLowerCase();
            const isResolved = status === "resolved" || status === "completed";
            
            const issue = (r.issue_type || "").toLowerCase();
            const isWasteRelated = 
              issue.includes("garb") || 
              issue.includes("dump") || 
              issue.includes("trash") || 
              issue.includes("waste") || 
              issue.includes("debris") || 
              issue.includes("c_and_d");

            return isResolved && isWasteRelated;
          });
          
          // Map to UI format
          const formatted = completedTickets.map((t: any) => ({
            id: t.id,
            issue_type: t.issue_type || 'Unclassified',
            village_name: t.village_name || 'Location Mapped',
            worker_name: t.user_email || 'Verified Contractor',
            resolved_at: t.created_at || new Date().toISOString(), 
            // Simplified SLA check for BDO view
            is_sla_breached: t.status === 'Late_Resolution', 
            resolution_photo_url: t.resolution_photo_url,
            proof_type: (t.issue_type || '').toLowerCase().includes('debris') ? 'GWMC_Receipt' : 'Geo_Photo'
          }));
          
          setReports(formatted);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch BDO audit log:", err);
        setReports([]);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-lg font-medium text-slate-500 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        Auditing Taluka Ledger...
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 bg-slate-50 min-h-screen">
      
      <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Taluka Audit Log</h1>
          <p className="text-slate-500 mt-1 font-medium">Historical ledger of all clearances across your Taluka.</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm border border-blue-200">
           {reports.length} Total Clearances Verified
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
                <th className="p-5">Issue Type</th>
                <th className="p-5">Village Panchayat</th>
                <th className="p-5">Resolution Time</th>
                <th className="p-5 text-center">Audit Status</th>
                <th className="p-5 text-center">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => {
                const resolvedDate = new Date(report.resolved_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                
                return (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-5">
                      <span className="block font-bold text-slate-800 capitalize">{report.issue_type.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
                        {report.id.split('-')[0]}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md text-sm">
                        {report.village_name}
                      </span>
                    </td>
                    <td className="p-5 text-sm text-slate-600">{resolvedDate}</td>
                    <td className="p-5 text-center">
                      {report.is_sla_breached ? (
                        <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-bold border border-rose-200 uppercase">Late</span>
                      ) : (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-200 uppercase">On Time</span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      {report.proof_type === 'GWMC_Receipt' ? (
                         <span className="text-slate-500 font-mono text-xs font-bold">RECEIPT</span>
                      ) : (
                        <button 
                          onClick={() => setSelectedImage(report.resolution_photo_url)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-xs underline"
                        >
                          View Photo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    No resolved tickets found in this Taluka.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="bg-white p-2 rounded-2xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={selectedImage} alt="Proof" className="w-full rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}