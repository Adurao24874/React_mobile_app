import { MapContainer, TileLayer } from 'react-leaflet';
import { DynamicMapLayers, getConditionColor, MapBoundsUpdater } from '../../App';
import { Trash2, MapPin } from 'lucide-react';
import { useState } from 'react';

export default function PanchayatHome({ reports, stats }: any) {
  const [showHeatmap, setShowHeatmap] = useState(true);

  const getConfidenceScore = (predictions: any) => {
    try {
      const parsed = typeof predictions === 'string' ? JSON.parse(predictions) : predictions;
      if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(1);
    } catch (e) { return "92.4"; }
    return "92.4";
  };

  return (
    <div className="space-y-8">
      {/* KPI Stat Cards */}
      <div className="grid grid-cols-3 gap-3 lg:gap-6">
        <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Active Health Hazards</h3>
          <p className="text-2xl lg:text-4xl font-black text-slate-800 mt-1 lg:mt-3">{stats.activeHazards}</p>
        </div>
        
        <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">SLA Breaches (48h+)</h3>
          <p className="text-2xl lg:text-4xl font-black text-red-600 mt-1 lg:mt-3">{stats.slaBreaches}</p>
        </div>

        <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Est. Tonnage Cleared</h3>
          <p className="text-2xl lg:text-4xl font-black text-emerald-600 mt-1 lg:mt-3">14.2 T</p>
        </div>
      </div>

      {/* Main Content Grid (Map + List) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Left Column: Map */}
        <div className="lg:col-span-2 bg-white p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
            <h2 className="text-base lg:text-lg font-bold text-slate-800">Live Dumping Heatmap</h2>
            <div className="flex gap-2">
                <button onClick={() => setShowHeatmap(!showHeatmap)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${showHeatmap ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {showHeatmap ? '🔥 Heatmap' : '📍 Pins'}
                </button>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                    {reports.length} Black Spots
                </span>
            </div>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative min-h-[400px] z-0">
             <MapContainer center={[15.4909, 73.8278]} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <DynamicMapLayers reports={reports} showReports={true} showSensors={!showHeatmap} showHeatmap={showHeatmap} conditions={[]} getConditionColor={getConditionColor} />
                <MapBoundsUpdater points={reports} />
            </MapContainer>
          </div>
        </div>

        {/* Right Column: Interactive Ticket List */}
        <div className="bg-white p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px] lg:h-[650px]">
          <h2 className="text-lg font-bold text-slate-800 mb-5 pb-4 border-b border-slate-100">Action Queue</h2>
          
          <div className="overflow-y-auto flex-1 pr-2 space-y-4">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Trash2 className="w-16 h-16 mb-4 text-emerald-100" />
                <p className="font-semibold text-slate-500">Jurisdiction is completely clear!</p>
              </div>
            ) : (
              reports.map((report: any) => {
                const confidence = getConfidenceScore(report.ai_predictions);
                const isDebris = report.issue_type === 'c_and_d';
                
                return (
                  <div key={report.id} className="bg-white border-slate-200 hover:border-emerald-300 p-5 border rounded-xl transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${report.status?.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {report.status?.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded font-mono truncate max-w-[80px]">
                        {report.id.split('-')[0]}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-slate-800 text-lg uppercase leading-tight">
                      {report.issue_type.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 flex items-center">
                      <MapPin className="w-4 h-4 mr-1 text-slate-400" />
                      {report.village_name || 'Location Data Attached'}
                    </p>
                    
                    {/* AI Confidence Bar (Green Themed) */}
                    <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-500 uppercase tracking-tight text-[10px]">AI Confidence</span>
                        <span className="font-bold text-emerald-700">{confidence}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full" 
                          style={{ width: `${confidence}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Dynamic Action Button based on waste type */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      {isDebris ? (
                        <button className="w-full bg-white border border-orange-500 text-orange-600 font-bold px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors text-xs uppercase tracking-widest">
                          Weighbridge ID
                        </button>
                      ) : (
                        <button className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors text-xs uppercase tracking-widest">
                          Upload MRF Photo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
