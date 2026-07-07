"use client";

import { useEffect, useState } from 'react';

export default function DepartmentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from your secure API - it automatically filters by the user's cookie!
    fetch('/api/departments')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load department data", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-semibold">Loading your department profile...</p>
      </div>
    );
  }

  if (!data || !data.departments || data.departments.length === 0) {
    return (
      <div className="min-h-screen p-10 bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">No Department Found</h2>
          <p className="text-slate-500 mt-2">You are not currently assigned to a valid PWD Division.</p>
        </div>
      </div>
    );
  }

  const { currentUser, departments } = data;

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      
      {/* Header */}
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Department Directory
        </h1>
        <p className="text-slate-500 mt-1 font-medium">
          Logged in as <span className="text-blue-600 font-bold">{currentUser.name}</span> • {currentUser.departmentName}
        </p>
      </div>

      {/* Render Departments (For a JE, this will only be ONE department) */}
      <div className="space-y-8">
        {departments.map((dept: any) => (
          <div key={dept.department_id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* Department Title Area */}
            <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{dept.department_name}</h2>
                <p className="text-slate-300 text-sm mt-1">Taluka: {dept.taluka_name}</p>
              </div>
              <div className="bg-slate-700 px-4 py-2 rounded-lg text-center">
                <p className="text-xs text-slate-300 uppercase tracking-wider font-bold">Total Workers</p>
                <p className="text-2xl font-black text-white">{dept.workers?.length || 0}</p>
              </div>
            </div>

            {/* Department Stats */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50">
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Reports</p>
                <p className="text-2xl font-black text-slate-800">{dept.total_reports}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-amber-500 font-bold uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-black text-amber-600">{dept.pending_reports}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Resolved</p>
                <p className="text-2xl font-black text-emerald-600">{dept.resolved_reports}</p>
              </div>
            </div>

            {/* Workers List */}
            <div className="p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Assigned Personnel</h3>
              {dept.workers && dept.workers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dept.workers.map((worker: any) => (
                    <div key={worker.id} className={`p-4 rounded-xl border ${worker.worker_name === currentUser.name ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800">{worker.worker_name}</p>
                          <p className="text-xs text-slate-500">{worker.email}</p>
                        </div>
                        {worker.worker_name === currentUser.name && (
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">You</span>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-600">Level {worker.hierarchy_level}</span>
                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {worker.specialty || "General Field Worker"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">No workers assigned to this department.</p>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}