"use client";

import { useEffect, useState } from "react";
import React from "react";

// INTERFACE
interface GWMCPendingReport {
  id: string;
  issue_type: string;
  village_name: string | null;
  timestamp: number;
  status: string;
  latitude: number;
  longitude: number;
  image_path: string;
  worker_name?: string;
  hours_remaining?: number;
  risk_status?: string;
  is_my_territory?: boolean;
}

// GWMC ACTION PANEL (Logistics & Fleet Deployment)
const GWMCActionPanel = ({ report, onSuccess }: { report: GWMCPendingReport; onSuccess: () => void }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeployFleet = () => {
    setIsProcessing(true);
    setTimeout(() => {
      alert(`Success! Heavy machinery and logistics fleet dispatched from SWMF to ${report.village_name || 'the location'}.`);
      onSuccess();
    }, 1200);
  };

  const handleScheduleIntake = () => {
    setIsProcessing(true);
    setTimeout(() => {
      alert(`Scheduled! Ticket ${report.id.split('-')[0]} marked for priority intake at the District Plant.`);
      setIsProcessing(false);
    }, 1200);
  };

  return (
    <div className="bg-white p-5 rounded-lg border border-indigo-200 shadow-sm flex flex-col h-full">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-800 mb-1">SWMF Logistics Deployment</h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          As the District GWMC Director, you manage issues that have escalated beyond local panchayat capabilities. Deploy state-level fleets or schedule priority plant intake to resolve massive hazards.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-3 justify-center">
        <button
          onClick={handleScheduleIntake}
          disabled={isProcessing}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          🏭 Schedule Plant Intake Processing
        </button>
        
        <button
          onClick={handleDeployFleet}
          disabled={isProcessing}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? "Deploying..." : "🚛 Dispatch District Fleet"}
        </button>
      </div>
    </div>
  );
};

export default function GWMCPendingPage() {
  const [reports, setReports] = useState<GWMCPendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchReports = () => {
    setLoading(true);
    // 1. Point exactly to the GWMC dashboard API
    fetch("/api/gwmc/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const fetchedData = json.tickets || [];

          // 2. Filter: Only My District, Only Pending, Only Waste
          const activeTickets = fetchedData.filter((r: GWMCPendingReport) => {
            if (!r.is_my_territory) return false;

            const safeStatus = (r.status || 'pending').toLowerCase();
            const isPending = safeStatus !== "resolved" && safeStatus !== "completed";

            const issue = (r.issue_type || "").toLowerCase();
            const isWasteRelated =
              issue.includes("garb") ||
              issue.includes("dump") ||
              issue.includes("trash") ||
              issue.includes("waste") ||
              issue.includes("debris") ||
              issue.includes("c_and_d");

            return isPending && isWasteRelated;
          });

          // 3. Sort by SLA Risk
          activeTickets.sort((a: GWMCPendingReport, b: GWMCPendingReport) => {
            const getScore = (status?: string) => {
              if (status === "Breached") return 3;
              if (status === "High Risk") return 2;
              return 1;
            };
            return getScore(b.risk_status) - getScore(a.risk_status);
          });

          setReports(activeTickets);
        } else {
          setReports([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch GWMC dashboard data:", err);
        setReports([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getRowStyle = (riskStatus?: string, isExpanded?: boolean) => {
    if (isExpanded) return "bg-indigo-50/30"; // GWMC Indigo theme
    switch (riskStatus) {
      case "Breached":
        return "bg-red-50/50 hover:bg-red-100/50 cursor-pointer border-l-4 border-l-red-500";
      case "High Risk":
        return "bg-amber-50/50 hover:bg-amber-100/50 cursor-pointer border-l-4 border-l-amber-500";
      default:
        return "hover:bg-slate-50/50 cursor-pointer border-l-4 border-l-transparent";
    }
  };

  const renderStatusBadge = (report: GWMCPendingReport) => {
    const isEscalated = (report.status || '').includes('Escalated');
    
    if (isEscalated) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-red-600 mr-2 animate-pulse"></span>
          State Escalation
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 shadow-sm">
        Awaiting Fleet Dispatch
      </span>
    );
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          Scanning District Grid...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                District Active Hazards
              </h1>
            </div>
            <p className="text-slate-500 font-medium">
              Monitor critical district escalations and coordinate heavy machinery deployment.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
                  <th className="p-5">Issue Type</th>
                  <th className="p-5">Location (Village)</th>
                  <th className="p-5">GPS Coordinates</th>
                  <th className="p-5">Operational Status</th>
                  <th className="p-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => {
                  const safeIssueType = report.issue_type || 'Unclassified Waste';
                  
                  return (
                    <React.Fragment key={report.id}>
                      <tr
                        className={`transition-colors duration-200 group ${getRowStyle(report.risk_status, expandedRow === report.id)}`}
                        onClick={() => toggleRow(report.id)}
                      >
                        <td className="p-5">
                          <span className="font-bold text-slate-800 capitalize">
                            {safeIssueType.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-5">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-md block w-max">
                            {report.village_name || "Unknown District Location"}
                          </span>
                        </td>
                        <td className="p-5">
                          <div className="text-sm font-medium text-slate-500 font-mono">
                            [{report.latitude?.toFixed(3)}, {report.longitude?.toFixed(3)}]
                          </div>
                        </td>
                        <td className="p-5">{renderStatusBadge(report)}</td>
                        <td className="p-5 text-center">
                          <button
                            className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(report.id);
                            }}
                          >
                            {expandedRow === report.id ? "Close Panel ▲" : "Manage ▼"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Details Drawer */}
                      {expandedRow === report.id && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50 p-0 border-b-2 border-indigo-100">
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                              {/* Left Column: Original Evidence */}
                              <div className="flex flex-col h-full">
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                                  Field Evidence
                                </h4>
                                <div className="flex-1 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 relative shadow-inner min-h-[250px]">
                                  <img
                                    src={
                                      report.image_path
                                        ? `https://ytmuudbkuhkfqkzchtce.supabase.co/storage/v1/object/public/reports/${report.image_path}`
                                        : "https://via.placeholder.com/400x300?text=Location+Data+Attached"
                                    }
                                    alt="Dumping Site"
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "https://via.placeholder.com/400x300?text=No+Image+Available";
                                    }}
                                  />
                                </div>
                                <div className="mt-4 bg-white p-3 rounded border border-slate-200 flex justify-between">
                                  <p className="text-xs text-slate-500 font-mono">ID: {report.id.split("-")[0]}</p>
                                  <p className="text-xs text-slate-500 font-mono">Timestamp: {new Date(report.timestamp).toLocaleDateString()}</p>
                                </div>
                              </div>

                              {/* Right Column: GWMC Fleet Actions */}
                              <div className="flex flex-col h-full">
                                <GWMCActionPanel
                                  report={report}
                                  onSuccess={() => {
                                    fetchReports();
                                    setExpandedRow(null);
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {reports.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">District is Clear</h3>
                      <p className="text-slate-500">No active escalations require state fleet deployment at this time.</p>
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