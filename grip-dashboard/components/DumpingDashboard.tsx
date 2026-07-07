"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("@/components/Map"), { ssr: false });

export default function DumpingDashboard({ apiEndpoint, roleName }: { apiEndpoint: string, roleName: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetches from the specific API provided by the page (e.g., /api/bdo/dashboard)
    fetch(apiEndpoint)
      .then(async (res) => {
        if (res.status === 401) return (window.location.href = "/");
        const json = await res.json();
        setData(json);
      })
      .catch((err) => console.error("Connection error:", err))
      .finally(() => setLoading(false));
  }, [apiEndpoint]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-semibold tracking-wide">
          Loading {roleName} Secure Data...
        </p>
      </div>
    );
  }

  const reports = data.reports || [];
  const pendingGarbage = reports.filter((r: any) => r.status === 'pending');
  const resolvedGarbage = reports.filter((r: any) => r.status === 'resolved');

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {roleName}
        </h1>
        <p className="text-slate-500 mt-1 font-medium">
          Waste Management & Sanitation Division
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Total Active Dumping Issues
          </h3>
          <p className="text-4xl font-black text-slate-800 mt-3">
            {pendingGarbage.length}
          </p>
        </div>

        <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
          <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider">
            Resolved Cleanups
          </h3>
          <p className="text-4xl font-black text-emerald-700 mt-3">
            {resolvedGarbage.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">
              Sanitation Map
            </h2>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 min-h-[500px] relative z-0 bg-slate-50">
             {/* Pass your mapping array here, tailored for garbage pins */}
            <DynamicMap reports={reports} role={roleName} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[650px]">
          <h2 className="text-lg font-bold text-slate-800 mb-5 pb-4 border-b border-slate-100">
            Pending Clearances
          </h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-4">
            {pendingGarbage.map((report: any) => (
              <div key={report.id} className="bg-amber-50 border-amber-200 p-5 border-2 rounded-xl">
                <h3 className="font-bold text-slate-800 text-lg mt-2">
                  {report.issue_type?.toUpperCase()}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  📍 Village ID: {report.department_id}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}