import React, { useState, useRef } from "react";
import { resolveWorkOrder } from "../../services/dashboardService";

export default function PWDPending({ myAssignedTickets, currentUser, onRefresh }: { myAssignedTickets: any[], currentUser?: any, onRefresh?: () => void }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resolutionMessage, setResolutionMessage] = useState<string>('');
  const [locallyResolvedIds, setLocallyResolvedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Filter for pending tickets
  const reports = myAssignedTickets.filter((t: any) => {
      const statusText = (t.status || "").toLowerCase();
      return (statusText === "pending" || statusText === "in_progress" || statusText === "assigned" || statusText === "new") && !locallyResolvedIds.has(String(t.id));
  });

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getRowStyle = (riskStatus?: string, isExpanded?: boolean) => {
    if (isExpanded) return "bg-indigo-50/30";
    
    switch (riskStatus) {
      case 'Breached':
        return "bg-red-50/50 hover:bg-red-100/50 cursor-pointer border-l-4 border-l-red-500";
      case 'High Risk':
        return "bg-amber-50/50 hover:bg-amber-100/50 cursor-pointer border-l-4 border-l-amber-500";
      default:
        return "hover:bg-slate-50/50 cursor-pointer border-l-4 border-l-transparent";
    }
  };

  const renderStatusBadge = (report: any) => {
    if (report.risk_status === 'Breached') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-red-600 mr-2 animate-pulse flex-shrink-0"></span>
          SLA Breached {report.hours_remaining ? `(${report.hours_remaining ? (Math.floor(report.hours_remaining / 24) > 0 ? `${Math.floor(report.hours_remaining / 24)}d ${report.hours_remaining % 24}h` : `${report.hours_remaining}h`) : ''} overdue)` : ''}
        </span>
      );
    }
    
    if (report.risk_status === 'High Risk') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 shadow-sm whitespace-nowrap">
           ⚠️ High Risk {report.hours_remaining ? `(${report.hours_remaining ? (Math.floor(report.hours_remaining / 24) > 0 ? `${Math.floor(report.hours_remaining / 24)}d ${report.hours_remaining % 24}h` : `${report.hours_remaining}h`) : ''} left)` : ''}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 shadow-sm whitespace-nowrap">
         ✓ On Track
      </span>
    );
  };

  const triggerCamera = (reportId: string) => {
    setActiveReportId(reportId);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, reportId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveReportId(reportId);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const cancelResolution = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmResolution = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedFile || !activeReportId) return;

    setResolvingId(activeReportId);
    setResolutionStatus('idle');

    // Helper to get location with timeout
    const getLocation = (): Promise<{lat: number, lng: number}> => {
      return new Promise((resolve) => {
        let isResolved = false;

        const manualTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve({ lat: 0, lng: 0 });
          }
        }, 3000);

        if (!navigator.geolocation) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(manualTimeout);
            resolve({ lat: 0, lng: 0 });
          }
          return;
        }
        
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(manualTimeout);
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(manualTimeout);
              resolve({ lat: 0, lng: 0 });
            }
          },
          { timeout: 5000, maximumAge: 10000 }
        );
      });
    };

    try {
      const coords = await getLocation();
      const result = await resolveWorkOrder(activeReportId, selectedFile, coords);
      
      if (result.success) {
        setResolutionStatus('success');
        setResolutionMessage(result.message || 'Ticket successfully resolved and closed!');
        setLocallyResolvedIds(prev => new Set(prev).add(String(activeReportId)));
        
        alert(`✅ ${result.message || 'Ticket successfully resolved!'}`);

        // Auto-close the row after 2 seconds
        setTimeout(() => {
          setExpandedRow(null);
          setResolutionStatus('idle');
          setSelectedFile(null);
          setPreviewUrl(null);
          if (onRefresh) onRefresh();
        }, 2000);
      } else {
        setResolutionStatus('error');
        setResolutionMessage(result.error || 'Failed to resolve ticket');
        alert(`🛑 Error: ${result.error || 'Failed to resolve ticket'}`);
      }
    } catch (err: any) {
      setResolutionStatus('error');
      setResolutionMessage(err.message || 'An unexpected error occurred');
      alert(`❌ Unexpected Error: ${err.message || 'An unknown error occurred'}`);
    }
    
    setResolvingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                My Active Tasks
              </h1>
            </div>
            <p className="text-slate-500 font-medium">
              Monitor your personal field resolution SLAs and potential deadline breaches.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
                  <th className="p-5">Issue Type</th>
                  <th className="p-5">Location</th>
                  <th className="p-5">Assigned To</th>
                  <th className="p-5">SLA Status</th>
                  <th className="p-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <React.Fragment key={report.id}>
                    <tr
                      className={`transition-colors duration-200 group ${getRowStyle(report.risk_status, expandedRow === report.id)}`}
                      onClick={() => toggleRow(report.id)}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800 capitalize">
                            {report.display_type || report.issue_type}
                          </span>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="font-medium text-slate-700 block">
                          {report.assigned_department || report.village_name || "Location Logged"}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="text-sm font-medium text-slate-900 flex items-center">
                          {report.worker_name || "Assigned"}
                          {currentUser?.role === 'JE' && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded ml-2 uppercase">You</span>}
                        </div>
                      </td>
                      <td className="p-5">
                        {renderStatusBadge(report)}
                      </td>
                      <td className="p-5 text-center">
                        <button
                          className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm focus:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(report.id);
                          }}
                        >
                          {expandedRow === report.id
                            ? "Close Details ▲"
                            : "Resolve Ticket ▼"}
                        </button>
                      </td>
                    </tr>

                    {expandedRow === report.id && (
                      <tr>
                        <td colSpan={5} className="bg-slate-50 p-0 border-b-2 border-indigo-100">
                          <div className="sticky left-0 w-full max-w-[calc(100vw-2rem)] md:max-w-none p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 animate-fadeIn">
                            <div>
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 sm:mb-3">
                                Original Evidence
                              </h4>
                              <div className="h-32 sm:h-auto sm:aspect-video bg-slate-200 rounded-lg overflow-hidden border border-slate-300 relative shadow-inner">
                                {report.image_path ? (
                                  <img
                                    src={`https://ytmuudbkuhkfqkzchtce.supabase.co/storage/v1/object/public/reports/${report.image_path}`}
                                    alt="Infrastructure Issue"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "https://via.placeholder.com/400x200?text=No+Image+Available";
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-medium text-center p-4">
                                    No Image Provided / Data offline
                                  </div>
                                )}
                              </div>
                              <div className="hidden sm:block mt-4 bg-white p-3 rounded border border-slate-200">
                                <p className="text-xs text-slate-500 font-mono">
                                  Ticket ID: {report.id}
                                </p>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 sm:mb-3">
                                {currentUser?.role === 'JE' ? 'Field Resolution' : 'Assignment Status'}
                              </h4>
                              <div className="bg-white p-3 sm:p-5 rounded-lg border border-slate-300 shadow-sm">
                                {(!currentUser || currentUser.role === 'JE') ? (
                                  <p className="hidden sm:block text-sm text-slate-600 mb-4">
                                    To close this ticket, you must be physically
                                    present at the site. Upload a photo of the
                                    completed repair. Your GPS coordinates will be
                                    verified against the original report location.
                                  </p>
                                ) : (
                                  <p className="hidden sm:block text-sm text-slate-600 mb-4">
                                    This ticket is currently in the active field queue. The assigned Junior Engineer will be required to upload a geotagged photo of the resolution at the site to close this ticket.
                                  </p>
                                )}

                                {resolutionStatus === 'success' && resolvingId === null && locallyResolvedIds.has(String(report.id)) ? (
                                  <div className="w-full bg-emerald-50 text-emerald-700 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-emerald-200">
                                    <span className="text-xl">✓</span>
                                    {resolutionMessage}
                                  </div>
                                ) : resolutionStatus === 'error' && resolvingId === null && activeReportId === report.id ? (
                                  <div className="w-full bg-rose-50 text-rose-700 font-bold py-3 px-4 rounded-lg flex flex-col items-center justify-center gap-1 border border-rose-200">
                                    <span>⚠️ {resolutionMessage}</span>
                                    <button onClick={() => setResolutionStatus('idle')} className="text-sm underline mt-1">Try Again</button>
                                  </div>
                                ) : (
                                  <>
                                    {(!currentUser || currentUser.role === 'JE') && (
                                      <div className="p-3 sm:p-4 border border-indigo-100 rounded-xl bg-indigo-50/30 flex flex-col gap-3 sm:gap-4 sm:mt-4">
                                          <h3 className="hidden sm:block font-bold text-slate-800">Resolve this Ticket</h3>
                                          
                                          <input 
                                              type="file" 
                                              accept="image/*" 
                                              onChange={(e) => handleFileChange(e, String(report.id))}
                                              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
                                          />
                                          
                                          <button 
                                              onClick={confirmResolution} 
                                              disabled={resolvingId === String(report.id) || !selectedFile || activeReportId !== String(report.id)}
                                              className={`py-3 px-4 rounded-lg text-white font-bold transition-all shadow-sm ${
                                                  resolvingId === String(report.id) || !selectedFile || activeReportId !== String(report.id)
                                                  ? 'bg-slate-400 cursor-not-allowed' 
                                                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-md transform hover:-translate-y-0.5'
                                              }`}
                                          >
                                              {resolvingId === String(report.id) ? 'Verifying Location & Uploading...' : 'Mark as Resolved'}
                                          </button>
                                          <p className="hidden sm:block text-xs text-slate-500 font-medium">
                                              * Note: Your GPS location will be verified against the report location. You must be physically on-site within 30 meters.
                                          </p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-500 mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        Queue Empty
                      </h3>
                      <p className="text-slate-500">
                        You have no active infrastructure issues assigned to you.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
