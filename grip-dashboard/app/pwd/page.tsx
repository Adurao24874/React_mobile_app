"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapMarker } from '@/components/Map';

interface KPIStats {
  total_pending: string | number;
  total_dispatched: string | number; // Updated KPI
  total_resolved: string | number; // Updated KPI
}

// Updated Task interface to match the 'reports' API response
interface Report {
  id: string; // Now a UUID
  status: string;
  timestamp: number; // Replaced due_date
  issue_type: string; // Replaced category_name
  village_name?: string; 
  ai_predictions: Array<{ confidence: number }> | string; // Replaced ml_confidence_score
}

interface DashboardData {
  kpis: KPIStats | null;
  markers: MapMarker[];
  reports: Report[]; // Renamed from tasks
}

const DynamicMap = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({ kpis: null, markers: [], reports: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          // Changed from json.tasks to json.reports (with a safe fallback)
          setData({ kpis: json.kpis, markers: json.markers, reports: json.reports || [] });
          setLastUpdated(new Date().toLocaleTimeString());
        }
        setLoading(false);
      });
  }, []);

  // Helper function to safely parse the JSONB string from Supabase
  const getConfidenceScore = (predictions: Array<{ confidence: number }> | string) => {
    try {
      const parsed = typeof predictions === 'string' ? JSON.parse(predictions) : predictions;
      if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(1);
    } catch (e) { return "0"; }
    return "0";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-semibold tracking-wide">Initializing GRIP Subsystems...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">GRIP Command Center</h1>
          <p className="text-slate-500 mt-1 font-medium">Goa Realtime Infrastructure Protection</p>
        </div>
        <div className="mt-4 md:mt-0 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">System Status</p>
          <div className="flex items-center mt-1">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse mr-2"></span>
            <span className="text-sm font-medium text-slate-700">Live • Updated {lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards (Updated for new schema) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Awaiting Dispatch</h3>
          <p className="text-4xl font-black text-slate-800 mt-3">{data.kpis?.total_pending || 0}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Assignments</h3>
          <p className="text-4xl font-black text-blue-600 mt-3">{data.kpis?.total_dispatched || 0}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Resolved</h3>
          <p className="text-4xl font-black text-emerald-600 mt-3">{data.kpis?.total_resolved || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Map Section */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">Live Incident Map</h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">
              {data.markers.length} Active Pins
            </span>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 min-h-[500px]">
             {/* Note: Check your Map.tsx component to ensure it can handle the new simple lat/lng format! */}
            <DynamicMap markers={data.markers} />
          </div>
        </div>

        {/* Incoming Task List (Now pulling from data.reports) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[650px]">
          <h2 className="text-lg font-bold text-slate-800 mb-5 pb-4 border-b border-slate-100">Recent Reports</h2>
          
          <div className="overflow-y-auto flex-1 pr-2 space-y-4">
            {data.reports.map((report) => {
              const confidence = getConfidenceScore(report.ai_predictions);
              const isDispatched = report.status?.toLowerCase() === 'dispatched';
              
              return (
                <div key={report.id} className="bg-white border-slate-200 hover:border-blue-300 p-5 border rounded-xl transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${isDispatched ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isDispatched ? 'DISPATCHED' : 'PENDING'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded font-mono truncate max-w-[80px]">
                      {report.id.split('-')[0]}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-lg">{report.issue_type}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    {report.village_name || 'Location Pending'}
                  </p>
                  
                  <div className="mt-4 bg-slate-100 p-3 rounded-lg">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-600">AI Confidence</span>
                      <span className="font-bold text-slate-800">{confidence}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${Number(confidence) > 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                        style={{ width: `${confidence}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {new Date(Number(report.timestamp)).toLocaleDateString()}
                    </span>
                    {/* The button is gone! Just a status indicator now since n8n does the work */}
                    {isDispatched ? (
                       <span className="text-xs font-bold text-blue-600 flex items-center">
                         <span className="w-2 h-2 rounded-full bg-blue-500 mr-1 animate-pulse"></span> Auto-Assigned
                       </span>
                    ) : (
                       <span className="text-xs font-bold text-slate-400">Processing...</span>
                    )}
                  </div>
                </div>
              );
            })}

            {data.reports.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="font-semibold">No pending reports.</p>
                <p className="text-sm mt-1">Goa is completely clear!</p>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}