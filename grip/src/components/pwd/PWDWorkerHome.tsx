import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { DynamicMapLayers, getConditionColor } from '../../App';
import { useState, useEffect } from 'react';
import L from 'leaflet';
import { isInGoa } from '../../App';

function MapResizerAndFitter({ points }: { points: any[] }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (points && points.length > 0) {
          const bounds = L.latLngBounds(
              points
                  .filter(p => isInGoa(Number(p.lat || p.latitude), Number(p.lng || p.longitude)))
                  .map(p => [Number(p.lat || p.latitude), Number(p.lng || p.longitude)])
          );
          if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          }
      }
    }, 400); // 400ms delay ensures DOM is fully painted and expanded
    return () => clearTimeout(timer);
  }, [map, points]);
  return null;
}

export default function PWDWorkerHome({ reports, workerName, deptName }: any) {
  const pendingCount = reports.filter((r: any) => r.status?.toLowerCase() === 'pending' || r.status?.toLowerCase() === 'in_progress' || r.status?.toLowerCase() === 'new' || r.status?.toLowerCase() === 'assigned').length;
  const resolvedCount = reports.filter((r: any) => r.status?.toLowerCase() === 'resolved' || r.status?.toLowerCase() === 'completed').length;

  // mapMarkers expects lat/lng for DynamicMapLayers
  const mapPoints = reports.map((r: any) => ({
      ...r,
      latitude: r.lat || r.latitude,
      longitude: r.lng || r.longitude,
      issue_type: r.display_type || r.issue_type || "Pothole"
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* KPI Stat Cards */}
      <div className="grid grid-cols-3 gap-3 lg:gap-6">
        <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Assigned to You</h3>
          <p className="text-2xl lg:text-4xl font-black text-slate-800 mt-1 lg:mt-3">{reports.length}</p>
        </div>
        
        <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Pending Action</h3>
          <p className="text-2xl lg:text-4xl font-black text-amber-600 mt-1 lg:mt-3">{pendingCount}</p>
        </div>

        <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Resolved By You</h3>
          <p className="text-2xl lg:text-4xl font-black text-emerald-600 mt-1 lg:mt-3">{resolvedCount}</p>
        </div>
      </div>

      <div className="bg-white p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
            <div>
              <h2 className="text-base lg:text-lg font-bold text-slate-800">Your Assigned Tasks Map</h2>
              <p className="text-xs text-slate-500">Navigate to these locations to resolve tickets.</p>
            </div>
            <div className="flex gap-2">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                    {reports.length} Locations
                </span>
            </div>
          </div>
          <div className="w-full h-[400px] lg:h-[600px] rounded-xl overflow-hidden border border-slate-200 relative z-0">
             <MapContainer center={[15.4909, 73.8278]} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <MapResizerAndFitter points={mapPoints} />
                <DynamicMapLayers reports={mapPoints} showReports={true} showSensors={false} showHeatmap={false} conditions={[]} getConditionColor={getConditionColor} />
            </MapContainer>
          </div>
      </div>
    </div>
  );
}
