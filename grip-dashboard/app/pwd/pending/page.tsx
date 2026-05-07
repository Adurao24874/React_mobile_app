"use client";

import { useEffect, useState } from "react";
import ResolveTicketButton from "@/components/ResolveTicketButton";
import React from "react";

// UPDATED INTERFACE
interface PendingReport {
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
}

export default function PendingPage() {
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchReports = () => {
    setLoading(true);
    fetch("/api/dashboard") 
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const fetchedData = json.reports || json.tasks || [];
          const activeTickets = fetchedData.filter(
            (r: PendingReport) =>
              r.status?.toLowerCase() !== "resolved" &&
              r.status?.toLowerCase() !== "completed",
          );
          
          activeTickets.sort((a: PendingReport, b: PendingReport) => {
             const getScore = (status?: string) => {
                if (status === 'Breached') return 3;
                if (status === 'High Risk') return 2;
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
        console.error("Failed to fetch dashboard data:", err);
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

  const renderStatusBadge = (report: PendingReport) => {
    if (report.risk_status === 'Breached') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-red-600 mr-2 animate-pulse"></span>
          SLA Breached ({report.hours_remaining}h overdue)
        </span>
      );
    }
    
    if (report.risk_status === 'High Risk') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 shadow-sm">
           ⚠️ High Risk ({report.hours_remaining}h left)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 shadow-sm">
         ✓ On Track
      </span>
    );
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          Syncing with Database...
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
                Active Work Orders
              </h1>
            </div>
            <p className="text-slate-500 font-medium">
              Monitor field resolution SLAs and potential deadline breaches.
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
                    {/* Main Row with Dynamic Color */}
                    <tr
                      className={`transition-colors duration-200 group ${getRowStyle(report.risk_status, expandedRow === report.id)}`}
                      onClick={() => toggleRow(report.id)}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800 capitalize">
                            {report.issue_type}
                          </span>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="font-medium text-slate-700 block">
                          {report.village_name || "Goa, India"}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="text-sm font-medium text-slate-900">
                          {report.worker_name || "Pending Assignment"}
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

                    {/* Expandable Details Drawer */}
                    {expandedRow === report.id && (
                      <tr>
                        <td
                          colSpan={5}
                          className="bg-slate-50 p-0 border-b-2 border-indigo-100"
                        >
                          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
                            {/* Left Column: Evidence */}
                            <div>
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Original Evidence
                              </h4>
                              <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden border border-slate-300 relative shadow-inner">
                                <img
                                  src={`https://ytmuudbkuhkfqkzchtce.supabase.co/storage/v1/object/public/reports/${report.image_path}`}
                                  alt="Infrastructure Issue"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      "https://via.placeholder.com/400x200?text=No+Image+Available";
                                  }}
                                />
                              </div>
                              <div className="mt-4 bg-white p-3 rounded border border-slate-200">
                                <p className="text-xs text-slate-500 font-mono">
                                  Ticket ID: {report.id}
                                </p>
                              </div>
                            </div>

                            {/* Right Column: Resolution Action */}
                            <div>
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Field Resolution
                              </h4>
                              <div className="bg-white p-5 rounded-lg border border-slate-300 shadow-sm">
                                <p className="text-sm text-slate-600 mb-4">
                                  To close this ticket, you must be physically
                                  present at the site. Upload a photo of the
                                  completed repair. Your GPS coordinates will be
                                  verified against the original report location.
                                </p>

                                {/* THE MAGIC BUTTON */}
                                <ResolveTicketButton
                                  reportId={report.id}
                                  onSuccess={() => {
                                    fetchReports();
                                    setExpandedRow(null);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {reports.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-500 mb-4">
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        Queue Empty
                      </h3>
                      <p className="text-slate-500">
                        All infrastructure issues have been resolved.
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