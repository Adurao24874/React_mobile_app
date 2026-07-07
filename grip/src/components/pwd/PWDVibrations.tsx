import React from "react";

export default function PWDVibrations() {
  return (
    <div className="bg-slate-50 min-h-screen p-4 lg:p-10 flex flex-col items-center justify-center">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center max-w-2xl w-full text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">Live Vibration Sensors</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg">
          Live IoT sensor data monitoring is currently initializing. Check back shortly for real-time accelerometer readings from public transit vehicles.
        </p>
        <div className="flex items-end justify-center gap-3 h-32">
          <div className="w-4 bg-rose-200 rounded-full animate-pulse h-1/4"></div>
          <div className="w-4 bg-rose-300 rounded-full animate-pulse delay-75 h-1/2"></div>
          <div className="w-4 bg-rose-500 rounded-full animate-pulse delay-150 h-full"></div>
          <div className="w-4 bg-rose-400 rounded-full animate-pulse delay-200 h-3/4"></div>
          <div className="w-4 bg-rose-200 rounded-full animate-pulse delay-300 h-1/3"></div>
          <div className="w-4 bg-rose-400 rounded-full animate-pulse delay-75 h-2/3"></div>
          <div className="w-4 bg-rose-300 rounded-full animate-pulse delay-150 h-1/2"></div>
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-widest text-rose-500">
          Establishing Link...
        </p>
      </div>
    </div>
  );
}
