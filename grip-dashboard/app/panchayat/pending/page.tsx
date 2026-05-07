"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import React from "react";

// MATHEMATICS: The Haversine Formula to calculate distance in meters
function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// INTERFACE
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

// THE SMART ROUTER: Multi-Department Escalation Modal
const EscalationModal = ({
  report,
  onClose,
  onSuccess,
}: {
  report: PendingReport;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [selectedRoute, setSelectedRoute] = useState("");
  const [isRouting, setIsRouting] = useState(false);

  const routingOptions = [
    {
      id: "gwmc_squad",
      icon: "🚜",
      title: "GWMC Flying Squad",
      desc: "Requires heavy machinery (JCB/Tippers) or exceeds local Panchayat budget.",
      color: "border-blue-200 bg-blue-50 hover:border-blue-500",
      activeColor: "border-blue-500 ring-2 ring-blue-200 bg-blue-50",
    },
    {
      id: "health_officer",
      icon: "☣️",
      title: "Primary Health Centre",
      desc: "Contains biomedical waste, chemicals, or poses a severe vector-borne disease risk.",
      color: "border-rose-200 bg-rose-50 hover:border-rose-500",
      activeColor: "border-rose-500 ring-2 ring-rose-200 bg-rose-50",
    },
    {
      id: "ngo_board",
      icon: "🤝",
      title: "Community Action Board",
      desc: "Safe, dry waste. Publishes ticket publicly to local NGOs and College NSS units.",
      color: "border-emerald-200 bg-emerald-50 hover:border-emerald-500",
      activeColor: "border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50",
    },
  ];

  const handleEscalate = () => {
    setIsRouting(true);
    // In production: await supabase.from('reports').update({ assigned_department: selectedRoute, status: 'Escalated' }).eq('id', report.id);
    setTimeout(() => {
      alert(
        `Success! Ticket officially transferred from Panchayat to: ${selectedRoute.toUpperCase()}`,
      );
      onSuccess();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-xl tracking-tight">
              Smart Ticket Routing
            </h3>
            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
              Transfer Ownership
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-black w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm font-bold text-slate-700 mb-4">
            Why are you escalating Ticket #{report.id.split("-")[0]}?
          </p>

          <div className="space-y-3">
            {routingOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => setSelectedRoute(option.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex gap-4 items-start ${selectedRoute === option.id ? option.activeColor : option.color}`}
              >
                <div className="text-3xl bg-white w-12 h-12 rounded-full shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                  {option.icon}
                </div>
                <div>
                  <h4 className="font-black text-slate-800">{option.title}</h4>
                  <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
                    {option.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Warning Footer */}
          <div className="mt-6 bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 items-start">
            <span className="text-amber-500 font-black">⚠️</span>
            <p className="text-xs text-amber-800 font-bold">
              Escalating a ticket removes it from your active queue. Unjustified
              escalations will be flagged by the Block Development Officer (BDO)
              during financial audits.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEscalate}
            disabled={!selectedRoute || isRouting}
            className="flex-[2] bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:bg-slate-400 flex justify-center items-center gap-2"
          >
            {isRouting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Confirm Transfer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// INLINE COMPONENT: Handles the Geo-Fence and Camera logic for a specific row
const ResolutionPanel = ({
  report,
  onSuccess,
}: {
  report: PendingReport;
  onSuccess: () => void;
}) => {
  const [distance, setDistance] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [workerLocation, setWorkerLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  const handleVerifyLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        setWorkerLocation({ lat: currentLat, lng: currentLng });

        const dist = getDistanceInMeters(
          report.latitude,
          report.longitude,
          currentLat,
          currentLng,
        );
        setDistance(Math.round(dist));
        setIsLocating(false);
      },
      (error) => {
        alert("Failed to get location. Please enable GPS.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imgUrl = URL.createObjectURL(e.target.files[0]);
      setCapturedPhoto(imgUrl);
    }
  };
const handleSubmitResolution = async () => {
    try {
      // 1. Send the update to Supabase
      // NOTE: Ensure 'solid_waste_reports' matches your exact table name!
      const { error } = await supabase
        .from('reports') 
        .update({ status: 'resolved' })
        .eq('id', report.id);

      if (error) {
        throw error;
      }

      // 2. Show success and refresh the UI
      alert(
        `Success! Ticket ${report.id.split("-")[0]} marked as Resolved with Geo-Verified Photo.`
      );
      
      onSuccess(); // This will remove it from the pending list
      
    } catch (err) {
      console.error("Failed to update Supabase:", err);
      alert("Error saving resolution. Please try again.");
    }
  };

  // DEV OVERRIDE: Double click the title to bypass GPS requirement during presentation
  const handleDevOverride = () => {
    setWorkerLocation({
      lat: report.latitude + 0.0001,
      lng: report.longitude + 0.0001,
    });
    setDistance(14); // Fake 14 meters away
  };

  const isWithinRadius = distance !== null && distance <= 30;

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-300 shadow-sm flex flex-col h-full relative">
      {/* Dev Cheat Code Target */}
      <div
        onDoubleClick={handleDevOverride}
        className="absolute top-0 right-0 w-10 h-10 cursor-default opacity-0"
      ></div>

      <p className="text-sm text-slate-600 mb-4">
        To close this ticket, you must be physically present at the site. Upload
        a photo of the cleared area. Your GPS coordinates will be verified
        against a 30-meter radius of the original report.
      </p>

      {/* Step 1: GPS Verification */}
      {distance === null ? (
        <button
          onClick={handleVerifyLocation}
          disabled={isLocating}
          className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-all flex items-center justify-center gap-2 mb-4"
        >
          {isLocating ? "Acquiring Satellites..." : "📍 Verify GPS Coordinates"}
        </button>
      ) : (
        <div
          className={`p-3 rounded-lg border-2 mb-4 text-center ${isWithinRadius ? "bg-emerald-50 border-emerald-500" : "bg-red-50 border-red-500"}`}
        >
          <p
            className={`font-black ${isWithinRadius ? "text-emerald-600" : "text-red-600"}`}
          >
            {distance} meters away
          </p>
          <p
            className={`text-xs font-bold mt-1 uppercase ${isWithinRadius ? "text-emerald-700" : "text-red-700"}`}
          >
            {isWithinRadius ? "✓ Location Verified" : "❌ Outside 30m Radius"}
          </p>
        </div>
      )}

      {/* Step 2: Photo Capture */}
      <div
        className={`flex-1 min-h-[120px] transition-opacity ${isWithinRadius ? "opacity-100" : "opacity-40 pointer-events-none"}`}
      >
        {!capturedPhoto ? (
          <div
            onClick={() => isWithinRadius && fileInputRef.current?.click()}
            className="h-full w-full border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <span className="text-2xl mb-1">📸</span>
            <p className="font-bold text-sm text-slate-600">Open Camera</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              className="hidden"
              onChange={handlePhotoCapture}
            />
          </div>
        ) : (
          <div className="h-full w-full relative rounded-lg overflow-hidden border-2 border-emerald-500">
            <img
              src={capturedPhoto}
              alt="Cleanup"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setCapturedPhoto(null)}
              className="absolute top-1 right-1 bg-slate-900/50 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Step 3: Submit */}
      <button
        onClick={handleSubmitResolution}
        disabled={!capturedPhoto || !isWithinRadius}
        className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:bg-slate-300 hover:bg-indigo-700 transition-all"
      >
        Submit Resolution
      </button>
      <div className="mt-4 pt-4 border-t border-slate-200 text-center">
        <button
          onClick={() => setShowEscalationModal(true)}
          className="text-xs font-bold text-slate-500 hover:text-rose-600 underline transition-colors"
        >
          Insufficient resources? Escalate to State Departments
        </button>
      </div>

      {/* RENDER THE MODAL IF ACTIVE */}
      {showEscalationModal && (
        <EscalationModal
          report={report}
          onClose={() => setShowEscalationModal(false)}
          onSuccess={() => {
            setShowEscalationModal(false);
            onSuccess(); // Triggers the parent fetchReports() to remove it from the list
          }}
        />
      )}
    </div>
  );
};

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

          // 1. The Domain Filter: Only keep rows that are Active AND related to Waste
          const activeTickets = fetchedData.filter((r: PendingReport) => {
            // Condition A: It must NOT be resolved/completed
            const isPending =
              r.status?.toLowerCase() !== "resolved" &&
              r.status?.toLowerCase() !== "completed";

            // Condition B: It must be related to Solid Waste
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

          // 2. Sort by SLA Risk (Highest priority on top)
          activeTickets.sort((a: PendingReport, b: PendingReport) => {
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
      case "Breached":
        return "bg-red-50/50 hover:bg-red-100/50 cursor-pointer border-l-4 border-l-red-500";
      case "High Risk":
        return "bg-amber-50/50 hover:bg-amber-100/50 cursor-pointer border-l-4 border-l-amber-500";
      default:
        return "hover:bg-slate-50/50 cursor-pointer border-l-4 border-l-transparent";
    }
  };

  const renderStatusBadge = (report: PendingReport) => {
    if (report.risk_status === "Breached") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-red-600 mr-2 animate-pulse"></span>
          SLA Breached ({report.hours_remaining}h overdue)
        </span>
      );
    }
    if (report.risk_status === "High Risk") {
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
              Monitor field resolution SLAs and enforce geo-fenced cleanup
              verification.
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
                        <span className="font-bold text-slate-800 capitalize">
                          {report.issue_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="font-medium text-slate-700 block">
                          {report.village_name || "Mapped Location"}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="text-sm font-medium text-slate-900">
                          {report.worker_name || "Pending Assignment"}
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
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column: Original Evidence */}
                            <div className="flex flex-col h-full">
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Original Report Evidence
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
                                    e.currentTarget.src =
                                      "https://via.placeholder.com/400x300?text=No+Image+Available";
                                  }}
                                />
                              </div>
                              <div className="mt-4 bg-white p-3 rounded border border-slate-200 flex justify-between">
                                <p className="text-xs text-slate-500 font-mono">
                                  ID: {report.id.split("-")[0]}
                                </p>
                                <p className="text-xs text-slate-500 font-mono">
                                  [{report.latitude.toFixed(4)},{" "}
                                  {report.longitude.toFixed(4)}]
                                </p>
                              </div>
                            </div>

                            {/* Right Column: Geo-Fence Resolution Action */}
                            <div className="flex flex-col h-full">
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Field Resolution
                              </h4>
                              {/* Injecting the isolated resolution component */}
                              <ResolutionPanel
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
                        All dumping reports have been resolved.
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
