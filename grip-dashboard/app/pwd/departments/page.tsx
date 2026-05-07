"use client";

import { useEffect, useState } from 'react';

interface Department {
  department_id: number;
  department_name: string;
  taluka_name: string;
  officer_in_charge: string;
  contact_email: string;
  total_reports: string | number;
  resolved_reports: string | number;
  active_breaches: string | number;
  total_workers: string | number;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/departments')
      .then(res => res.json())
      .then(json => {
        if (json.success) setDepartments(json.departments);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 font-bold text-slate-600">Loading Department Metrics...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Department Performance</h1>
        <p className="text-slate-500 mt-1 font-medium">Evaluate resolution rates and SLA compliance across Goa.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {departments.map((dept) => {
          // Calculate the resolution success rate safely (avoid dividing by zero)
          const total = Number(dept.total_reports);
          const resolved = Number(dept.resolved_reports);
          const breaches = Number(dept.active_breaches);
          const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

          return (
            <div key={dept.department_id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow">
              
              {/* Header Info */}
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded">
                    {dept.taluka_name} Taluka
                  </span>
                  <h2 className="text-xl font-bold text-slate-800 mt-2">{dept.department_name}</h2>
                  <p className="text-sm text-slate-500 mt-1">Officer: <span className="font-semibold text-slate-700">{dept.officer_in_charge}</span></p>
                </div>
                <div className="text-right">
                  <span className="block text-3xl font-black text-slate-800">{total}</span>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Total Issues</span>
                </div>
              </div>

              {/* Data Science / Metric Visualization */}
              <div className="space-y-5 flex-1 mt-2">
                
                {/* Resolution Rate Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-600">Resolution Rate</span>
                    <span className="font-bold text-slate-800">{resolutionRate}% ({resolved} fixed)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${resolutionRate >= 75 ? 'bg-emerald-500' : resolutionRate >= 40 ? 'bg-amber-400' : 'bg-rose-500'}`} 
                      style={{ width: `${resolutionRate}%` }}
                    ></div>
                  </div>
                </div>

                {/* Sub-metrics */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Active SLA Breaches</p>
                    <p className={`text-xl font-bold ${breaches > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {breaches}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Field Workers</p>
                    <p className="text-xl font-bold text-slate-700">{dept.total_workers}</p>
                  </div>
                </div>

              </div>

              {/* Action Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <button className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-2 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  View Detailed Audit Report
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}