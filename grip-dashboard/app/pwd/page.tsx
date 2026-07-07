"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    // Safely fetching from your secure departments API
    fetch(`${window.location.origin}/api/departments`)
      .then(async (res) => {
        if (res.status === 401) return (window.location.href = "/");
        const json = await res.json();
        if (json && json.success) {
          setData(json);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      })
      .catch((err) => console.error("Connection error:", err))
      .finally(() => setLoading(false));
  }, []);

  const getConfidenceScore = (predictions: any) => {
    try {
      const parsed = typeof predictions === "string" ? JSON.parse(predictions) : predictions;
      if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(1);
    } catch (e) {
      return "0";
    }
    return "0";
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-semibold tracking-wide">
          Authenticating & Loading Secure Data...
        </p>
      </div>
    );
  }

  const { currentUser, departments } = data;
  
  let totalPending = 0;
  let totalResolved = 0;
  let allTickets: any[] = [];
  let mapMarkers: any[] = [];

  departments.forEach((dept: any) => {
    totalPending += dept.pending_reports || 0;
    totalResolved += dept.resolved_reports || 0;

    dept.tickets.forEach((ticket: any) => {
      const lat = parseFloat(ticket.latitude);
      const lng = parseFloat(ticket.longitude);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
        allTickets.push(ticket);

        // THE MAP CRASH FIX: Restored all original properties so Map.tsx doesn't panic
        mapMarkers.push({
          id: ticket.id,
          lat: lat,
          lng: lng,
          status: ticket.status || "pending",
          issue_type: ticket.display_type || "Pothole", // Restored!
          is_my_territory: ticket.is_my_territory,      // The magic flag for Red/Blue
          color: ticket.is_my_territory ? "#ef4444" : "#3b82f6", 
          title: ticket.display_type || "Pothole",
          description: ticket.assigned_department || "Location Unknown",
          ai_predictions: ticket.ai_predictions
        });
      }
    });
  });

  const myAssignedTickets = allTickets.filter((t) => t.is_my_territory === true);
  const otherTickets = allTickets.filter((t) => t.is_my_territory !== true);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome, {currentUser.name}
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Division:{" "}
            <span className="text-blue-600 font-bold">
              {currentUser.taluka || "Assigned Territory"}
            </span>
          </p>
        </div>
        <div className="mt-4 md:mt-0 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Secure Session
          </p>
          <div className="flex items-center mt-1">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse mr-2"></span>
            <span className="text-sm font-medium text-slate-700">
              Level {currentUser.level} Access • {lastUpdated}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Total Potholes
          </h3>
          <p className="text-4xl font-black text-slate-800 mt-3">
            {allTickets.length}
          </p>
        </div>

        <div className="bg-rose-50 p-6 rounded-2xl shadow-sm border border-rose-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-600"></div>
          <h3 className="text-sm font-bold text-rose-600 uppercase tracking-wider">
            In My Territory
          </h3>
          <p className="text-4xl font-black text-rose-700 mt-3">
            {myAssignedTickets.length}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Resolved
          </h3>
          <p className="text-4xl font-black text-emerald-600 mt-3">
            {totalResolved}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">
              Goa Pothole Monitor
            </h2>
            <div className="flex gap-2">
              <span className="flex items-center text-[10px] font-bold text-slate-500">
                <span className="w-2 h-2 bg-rose-500 rounded-full mr-1"></span>{" "}
                {currentUser.taluka}
              </span>
              <span className="flex items-center text-[10px] font-bold text-slate-500">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>{" "}
                Others
              </span>
            </div>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 min-h-[500px] relative z-0 bg-slate-50">
            <DynamicMap markers={mapMarkers} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[650px]">
          <h2 className="text-lg font-bold text-slate-800 mb-5 pb-4 border-b border-slate-100">
            Territory Queue
          </h2>

          <div className="overflow-y-auto flex-1 pr-2 space-y-4">
            {myAssignedTickets.map((report: any) => (
              <div
                key={report.id}
                className="bg-rose-50 border-rose-200 p-5 border-2 rounded-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                  Priority
                </div>
                <h3 className="font-bold text-slate-800 text-lg mt-2">
                  {report.display_type || report.issue_type}
                </h3>
                <p className="text-sm text-slate-500 mt-1 flex items-center">
                  📍 {report.assigned_department || "Logged Location"}
                </p>
                <div className="mt-4 pt-3 border-t border-rose-100">
                  <button className="w-full bg-rose-600 text-white font-bold py-2 rounded hover:bg-rose-700 transition-colors">
                    View & Dispatch
                  </button>
                </div>
              </div>
            ))}

            {otherTickets.map((report: any) => {
              return (
                <div
                  key={report.id}
                  className="bg-white border-slate-200 p-5 border rounded-xl opacity-80"
                >
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                    External Division
                  </span>
                  <h3 className="font-bold text-slate-800 text-md mt-1">
                    {report.display_type || report.issue_type}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    📍 {report.assigned_department || "Logged Location"}
                  </p>
                </div>
              );
            })}

            {allTickets.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-10">
                <span className="text-4xl mb-3">🌴</span>
                <p className="font-semibold">All Roads Clear</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}