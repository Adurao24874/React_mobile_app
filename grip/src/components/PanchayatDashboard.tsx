import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MapPin,
    Trash2,
    LogOut
} from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import { DynamicMapLayers, getConditionColor, MapBoundsUpdater } from '../App';

interface WasteReport {
  id: string;
  status: string;
  issue_type: string;
  created_at: string;
  village_name?: string;
  ai_predictions?: any;
  latitude: number;
  longitude: number;
}

export default function PanchayatDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptName, setDeptName] = useState('Initializing Workspace...');
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    async function fetchPanchayatData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const activeEmail = user?.email || localStorage.getItem('gov_email');
        let targetDeptName = "Panchayat Master Console";

        if (activeEmail) {
            const { data: dept } = await supabase
                .from('departments')
                .select('department_name')
                .eq('contact_email', activeEmail.toLowerCase())
                .limit(1);
            if (dept && dept.length > 0) targetDeptName = dept[0].department_name;
        }
        setDeptName(targetDeptName);

        const { data: tickets, error } = await supabase
          .from('reports')
          .select('*')
          .or('issue_type.ilike.%garb%,issue_type.ilike.%dump%,issue_type.ilike.%waste%,issue_type.ilike.%c_and_d%')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        let filteredTickets = tickets || [];
        if (targetDeptName.toLowerCase().includes('village panchayat') && targetDeptName !== "Panchayat Master Console") {
            const panchayatName = targetDeptName.replace(/Village Panchayat/ig, '').trim().toLowerCase();
            const keywords = panchayatName.split(/[- \/]/).filter((k: string) => k.length > 2);
            filteredTickets = filteredTickets.filter(r => {
                if (!r.village_name) return false;
                const vName = r.village_name.toLowerCase();
                return vName === panchayatName || keywords.some((k: string) => vName.includes(k));
            });
        }
        
        setReports(filteredTickets);
      } catch (e) {
        console.error("Fetch failed:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchPanchayatData();
  }, []);

  const stats = useMemo(() => {
    const activeHazards = reports.filter(r => r.status?.toLowerCase() !== 'resolved').length;
    const slaBreaches = reports.filter(r => {
        const createdDate = new Date(r.created_at).getTime();
        return (Date.now() - createdDate) > (48 * 60 * 60 * 1000) && r.status?.toLowerCase() !== 'resolved';
    }).length;
    return { activeHazards, slaBreaches };
  }, [reports]);

  const getConfidenceScore = (predictions: any) => {
    try {
      const parsed = typeof predictions === 'string' ? JSON.parse(predictions) : predictions;
      if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(1);
    } catch (e) { return "92.4"; }
    return "92.4";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50/50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-emerald-800 font-bold tracking-wide">Syncing Waste Management Grid...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50/30 p-4 lg:p-6">
      
      {/* Top Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8">
        <div className="flex items-center gap-3 lg:gap-4">
            <button onClick={() => {
                localStorage.removeItem('user_mode');
                window.dispatchEvent(new Event('auth-change'));
                navigate('/');
            }} className="p-2 bg-white border border-emerald-100 rounded-full shadow-sm hover:bg-emerald-50 transition-colors">
                <LogOut className="w-5 h-5 text-emerald-600" />
            </button>
            <div>
                <h1 className="text-xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Waste Management Console</h1>
                <p className="text-xs lg:text-base text-emerald-600 mt-1 font-bold">{deptName}</p>
            </div>
        </div>
        <div className="flex gap-3 mt-4 lg:mt-0">
          <button className="bg-white border-2 border-slate-200 text-slate-700 font-bold px-3 lg:px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-xs lg:text-sm">
            📄 Audit Report
          </button>
          <button className="bg-emerald-600 text-white font-bold px-3 lg:px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors text-xs lg:text-sm">
            🚜 Request JCB
          </button>
        </div>
      </div>

      {/* KPI Stat Cards (Original Design) */}
      <div className="grid grid-cols-3 gap-3 lg:gap-6 mb-8">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Map */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
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
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[650px]">
          <h2 className="text-base lg:text-lg font-bold text-slate-800 mb-5 pb-4 border-b border-slate-100">Pending Black Spots</h2>
          
          <div className="overflow-y-auto flex-1 pr-2 space-y-4">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Trash2 className="w-16 h-16 mb-4 text-emerald-100" />
                <p className="font-semibold text-slate-500">Jurisdiction is completely clear!</p>
              </div>
            ) : (
              reports.map((report) => {
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
