"use client";

import { useEffect, useState } from 'react';

interface ResolvedReport {
  id: string;
  issue_type: string;
  village_name: string | null;
  worker_name: string | null;
  resolved_at: string; 
  is_sla_breached: boolean;
  resolution_photo_url: string | null;
  proof_type: 'MRF_Bale' | 'GWMC_Receipt' | 'Geo_Photo';
  is_my_territory?: boolean;
}

export default function ResolvedPage() {
  const [reports, setReports] = useState<ResolvedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Point to the smart API that knows the logged-in Secretary
    fetch('/api/panchayat/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.tickets) {
          
          // 2. Filter: Must be Mine, Must be Resolved, Must be Waste
          const completedTickets = json.tickets.filter((r: any) => {
            // IF IT DOESN'T BELONG TO MY VILLAGE, THROW IT OUT
            if (!r.is_my_territory) return false;

            const isResolved = r.status?.toLowerCase() === "resolved" || r.status?.toLowerCase() === "completed";
            
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
          
          // 3. Map to UI format
          const formatted = completedTickets.map((t: any) => ({
            id: t.id,
            issue_type: t.issue_type,
            village_name: t.village_name || 'Location Mapped',
            worker_name: t.user_email || 'Verified Contractor',
            resolved_at: t.created_at || new Date().toISOString(), 
            is_sla_breached: new Date() > new Date(t.escalation_deadline),
            resolution_photo_url: t.resolution_photo_url,
            proof_type: (t.issue_type || '').toLowerCase().includes('debris') ? 'GWMC_Receipt' : 'Geo_Photo'
          }));
          
          setReports(formatted);
        } else {
          setReports([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch:", err);
        setReports([]);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-lg font-medium text-slate-500 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        Decrypting Audit Logs...
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Audit Log & Completed Work</h1>
          <p className="text-slate-500 mt-1 font-medium">Historical ledger of all verified solid waste clearances.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm border border-emerald-200">
            {reports.length} Clearances Verified
          </div>
          <button className="bg-white border-2 border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm shadow-sm">
            📥 Export PDF Ledger
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
                <th className="p-5">Issue & Ticket ID</th>
                <th className="p-5">Location</th>
                <th className="p-5">Cleared By</th>
                <th className="p-5">Resolution Time</th>
                <th className="p-5 text-center">SLA Status</th>
                <th className="p-5 text-center">Proof of Work</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => {
                const resolvedDate = new Date(report.resolved_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                // SAFETY: Fallback for issue type
                const safeIssueType = report.issue_type || 'Unclassified Hazard';
                
                return (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-5">
                      <span className="block font-bold text-slate-800 capitalize">{safeIssueType.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
                        {report.id.split('-')[0]}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="font-semibold text-slate-700 block">{report.village_name}</span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mr-3">
                          {report.worker_name ? report.worker_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">{report.worker_name}</span>
                      </div>
                    </td>
                    <td className="p-5 text-sm font-medium text-slate-600">
                      {resolvedDate}
                    </td>
                    <td className="p-5 text-center">
                      {report.is_sla_breached ? (
                        <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-bold border border-rose-200 uppercase tracking-wide">
                          Late Resolution
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-200 uppercase tracking-wide">
                          On Time
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      {report.proof_type === 'GWMC_Receipt' ? (
                         <span className="inline-block bg-slate-100 text-slate-600 border border-slate-300 font-mono text-xs font-bold px-3 py-1.5 rounded shadow-inner">
                           RECEIPT: {report.resolution_photo_url || 'PENDING'}
                         </span>
                      ) : (
                        <button 
                          onClick={() => setSelectedImage(report.resolution_photo_url)}
                          disabled={!report.resolution_photo_url}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center justify-center gap-1 w-full disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          📸 View Photo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-400 mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">No Audit Records</h3>
                    <p className="text-slate-500">Resolved tickets will appear here for financial auditing.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Image Modal for Proof of Work */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="bg-white p-2 rounded-2xl max-w-3xl w-full relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-4 -right-4 bg-rose-500 text-white w-10 h-10 rounded-full font-bold border-4 border-slate-100 shadow-lg hover:bg-rose-600"
            >
              ✕
            </button>
            <img src={selectedImage} alt="Resolution Evidence" className="w-full h-auto max-h-[80vh] object-contain rounded-xl bg-slate-100" />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase">
              Geo-Fenced & Verified
            </div>
          </div>
        </div>
      )}
    </div>
  );
}