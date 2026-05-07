import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  MapPin, 
  History, 
  LogOut, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Map as MapIcon,
  ShieldCheck,
  Truck,
  FileText,
  Camera,
  Navigation
} from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import { Geolocation } from '@capacitor/geolocation';
import { 
    DynamicMapLayers,
    getConditionColor
} from '../App';

interface Report {
  id: string;
  status: string;
  issue_type: string;
  latitude: number;
  longitude: number;
  created_at: string;
  assigned_department?: string;
  village_name?: string;
  ai_predictions?: any;
  escalation_deadline?: string;
}

type DeptType = 'PWD' | 'Panchayat' | 'Universal';

export default function GovernmentDashboard() {
    const navigate = useNavigate();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [deptType, setDeptType] = useState<DeptType>('Universal');
    const [deptName, setDeptName] = useState('GRIP Command Center');
    const [view, setView] = useState<'dashboard' | 'tools' | 'reports'>('dashboard');
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [conditions, setConditions] = useState<any[]>([]);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [jurisdiction, setJurisdiction] = useState<{ name: string, taluka: string } | null>(null);

    useEffect(() => {
        const initDashboard = async () => {
            setLoading(true);
            try {
                // 1. Identify Department from Session
                const { data: { session } } = await supabase.auth.getSession();
                let currentDeptName = 'GRIP Command Center';

                if (session?.user?.email) {
                    const email = session.user.email.toLowerCase();
                    
                    // Fetch real department details from departments
                    const { data: deptInfo } = await supabase
                        .from('departments')
                        .select('department_name, taluka_name')
                        .eq('contact_email', email)
                        .single();

                    if (deptInfo) {
                        currentDeptName = deptInfo.department_name;
                        setJurisdiction({ name: deptInfo.department_name, taluka: deptInfo.taluka_name });
                        setDeptName(deptInfo.department_name);
                    }

                    if (email.includes('pwd')) {
                        setDeptType('PWD');
                    } else if (email.includes('panchayat') || email.includes('village')) {
                        setDeptType('Panchayat');
                    }
                }

                // 2. Fetch Reports (Filtered by jurisdiction if available)
                let query = supabase.from('reports').select('*');
                
                if (currentDeptName !== 'GRIP Command Center') {
                    query = query.eq('assigned_department', currentDeptName);
                }

                const { data, error } = await query.order('created_at', { ascending: false });

                if (error) throw error;
                if (data) setReports(data);

                // 3. Fetch Road Quality Sensor Data (Paginated to get all points)
                let allConditions: any[] = [];
                let from = 0;
                const PAGE_SIZE = 1000;
                while (from < 10000) { // Fetch up to 10k points
                    const { data: roadData } = await supabase
                        .from('road_segments')
                        .select('*')
                        .neq('label', 'GOOD')
                        .range(from, from + PAGE_SIZE - 1);
                    
                    if (!roadData || roadData.length === 0) break;
                    allConditions = [...allConditions, ...roadData];
                    if (roadData.length < PAGE_SIZE) break;
                    from += PAGE_SIZE;
                }
                setConditions(allConditions);
            } catch (e) {
                console.error("Dashboard Init Error:", e);
            } finally {
                setLoading(false);
            }
        };

        initDashboard();
        const interval = setInterval(initDashboard, 15000);
        return () => clearInterval(interval);
    }, []);

    const filteredReports = useMemo(() => {
        if (deptType === 'PWD') {
            return reports.filter(r => 
                r.issue_type?.toLowerCase().includes('pothole') || 
                r.issue_type?.toLowerCase().includes('road') ||
                r.issue_type?.toLowerCase().includes('hump')
            );
        } else if (deptType === 'Panchayat') {
            return reports.filter(r => 
                r.issue_type?.toLowerCase().includes('garbage') || 
                r.issue_type?.toLowerCase().includes('dump') ||
                r.issue_type?.toLowerCase().includes('waste')
            );
        }
        return reports;
    }, [reports, deptType]);

    const stats = useMemo(() => {
        const pending = filteredReports.filter(r => r.status?.toLowerCase() === 'pending').length;
        const active = filteredReports.filter(r => r.status?.toLowerCase() === 'dispatched').length;
        const resolved = filteredReports.filter(r => ['resolved', 'completed'].includes(r.status?.toLowerCase())).length;
        
        // Calculate Breaches (Simple 48h check if no deadline)
        const breaches = filteredReports.filter(r => {
            if (['resolved', 'completed'].includes(r.status?.toLowerCase())) return false;
            const createdDate = new Date(r.created_at).getTime();
            const now = new Date().getTime();
            return (now - createdDate) > (48 * 60 * 60 * 1000);
        }).length;

        return { pending, active, resolved, breaches };
    }, [filteredReports]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('user_mode');
        localStorage.removeItem('gov_email');
        window.dispatchEvent(new Event('auth-change'));
        navigate('/');
    };

    const handleResolveTicket = async (report: Report) => {
        if (!resolutionPhoto) {
            alert("Please capture a photo of the resolution first.");
            return;
        }

        setIsResolving(true);
        try {
            // 1. Get precise location
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
            const workerLat = pos.coords.latitude;
            const workerLng = pos.coords.longitude;

            // 2. Haversine distance check (Strict 50m geofence)
            const R = 6371e3; // metres
            const φ1 = workerLat * Math.PI/180;
            const φ2 = report.latitude * Math.PI/180;
            const Δφ = (report.latitude-workerLat) * Math.PI/180;
            const Δλ = (report.longitude-workerLng) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            if (distance > 50) {
                alert(`Geofence Breach: You are ${Math.round(distance)}m away from the site. You must be within 50m to resolve.`);
                setIsResolving(false);
                return;
            }

            // 3. Update Status
            const { error } = await supabase
                .from('reports')
                .update({ 
                    status: 'resolved', 
                    resolved_at: new Date().toISOString(),
                    resolution_photo_url: resolutionPhoto // In real app, upload to storage first
                })
                .eq('id', report.id);

            if (error) throw error;

            alert("✅ Ticket resolved and location verified!");
            setSelectedReport(null);
            setResolutionPhoto(null);
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setIsResolving(false);
        }
    };

    if (loading && reports.length === 0) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${deptType === 'Panchayat' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                <div className="text-center">
                    <div className={`w-12 h-12 border-4 ${deptType === 'Panchayat' ? 'border-emerald-600' : 'border-blue-600'} border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
                    <p className={`${deptType === 'Panchayat' ? 'text-emerald-800' : 'text-slate-800'} font-bold`}>Initializing {deptName}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen pb-24 ${deptType === 'Panchayat' ? 'bg-emerald-50/30' : 'bg-slate-50/50'}`}>
            {/* Premium Header */}
            <div className={`${deptType === 'Panchayat' ? 'bg-emerald-900' : 'bg-slate-900'} p-6 pt-12 pb-8 rounded-b-[40px] shadow-2xl text-white mb-6 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${deptType === 'Panchayat' ? 'bg-emerald-500' : 'bg-blue-600'} flex items-center justify-center shadow-lg transform rotate-3`}>
                            <span className="text-2xl">{deptType === 'Panchayat' ? '🗑️' : '🛣️'}</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight uppercase">GRIP</h1>
                            <p className={`${deptType === 'Panchayat' ? 'text-emerald-400' : 'text-blue-400'} font-bold text-[10px] uppercase tracking-widest`}>
                                {jurisdiction ? jurisdiction.name : deptName}
                                {jurisdiction?.taluka && <span className="ml-2 text-white/40">[{jurisdiction.taluka}]</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleSignOut} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-95">
                        <LogOut className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Animated View Toggle */}
                <div className="flex bg-white/5 p-1.5 rounded-2xl backdrop-blur-xl border border-white/10 relative z-10">
                    <button 
                        onClick={() => setView('dashboard')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${view === 'dashboard' ? 'bg-white text-slate-900 shadow-xl scale-[1.02]' : 'text-white/50 hover:text-white'}`}
                    >
                        Command
                    </button>
                    <button 
                        onClick={() => setView('reports')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${view === 'reports' ? 'bg-white text-slate-900 shadow-xl scale-[1.02]' : 'text-white/50 hover:text-white'}`}
                    >
                        Incidents
                    </button>
                    <button 
                        onClick={() => setView('tools')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${view === 'tools' ? 'bg-white text-slate-900 shadow-xl scale-[1.02]' : 'text-white/50 hover:text-white'}`}
                    >
                        Tools
                    </button>
                </div>
            </div>

            <div className="px-6 space-y-6">
                {view === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border-b-4 border-amber-500 relative overflow-hidden group">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{deptType === 'Panchayat' ? 'Health Hazards' : 'Pending Repairs'}</p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white">{stats.pending}</p>
                                <div className="absolute top-4 right-4 bg-amber-50 text-amber-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border-b-4 border-red-500 relative overflow-hidden group">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SLA Breaches (48h+)</p>
                                <p className="text-4xl font-black text-red-600">{stats.breaches}</p>
                                <div className="absolute top-4 right-4 bg-red-50 text-red-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
                                    <Clock className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border-b-4 border-emerald-500 relative overflow-hidden group">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Resolved</p>
                                <p className="text-4xl font-black text-emerald-600">{stats.resolved}</p>
                                <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* Interactive Map */}
                        <div className="bg-white dark:bg-zinc-800 rounded-[32px] shadow-xl border border-slate-100 dark:border-zinc-700 overflow-hidden h-80 relative group">
                            <div className="absolute top-5 left-5 z-[1000] flex flex-col gap-2">
                                <button 
                                    onClick={() => setShowHeatmap(!showHeatmap)}
                                    className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-2xl flex items-center gap-2 border transition-all ${showHeatmap ? 'bg-red-600 text-white border-red-400' : 'bg-white/95 dark:bg-zinc-800/95 text-slate-900 dark:text-white border-slate-100'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${showHeatmap ? 'bg-white animate-pulse' : 'bg-red-500'}`}></span> {deptType === 'Panchayat' ? 'Dumping Heatmap' : 'Road Quality Grid'}
                                </button>
                                <div className="bg-white/90 dark:bg-zinc-800/90 px-3 py-1.5 rounded-xl text-[9px] font-bold text-slate-500 shadow-lg border border-slate-100">
                                    {showHeatmap ? conditions.length : filteredReports.length} Critical Points Located
                                </div>
                            </div>
                            <MapContainer center={[15.4909, 73.8278]} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                <DynamicMapLayers 
                                    reports={filteredReports} 
                                    showReports={true} 
                                    showSensors={!showHeatmap} 
                                    showHeatmap={showHeatmap}
                                    conditions={conditions}
                                    getConditionColor={getConditionColor}
                                />
                            </MapContainer>
                            <button className="absolute bottom-5 right-5 z-[1000] bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 hover:scale-110 active:scale-95 transition-all">
                                <Navigation className="w-6 h-6 text-blue-600" />
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 active:scale-95 transition-all">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-slate-600"><FileText className="w-6 h-6" /></div>
                                <span className="text-[11px] font-black uppercase tracking-wider">Audit Report</span>
                            </button>
                            <button className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 active:scale-95 transition-all">
                                <div className={`w-12 h-12 rounded-2xl ${deptType === 'Panchayat' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center`}>
                                    {deptType === 'Panchayat' ? <Truck className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider">{deptType === 'Panchayat' ? 'Request JCB' : 'Deploy Team'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {view === 'reports' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-6 duration-500 pb-10">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Incidents</h2>
                            <div className="flex gap-2">
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full">{stats.pending} NEW</span>
                            </div>
                        </div>

                        {filteredReports.map((report) => (
                            <div 
                                key={report.id} 
                                onClick={() => setSelectedReport(report)}
                                className={`bg-white dark:bg-zinc-800 p-5 rounded-[32px] shadow-sm border-2 transition-all ${selectedReport?.id === report.id ? 'border-blue-500 scale-[1.02]' : 'border-transparent active:scale-98'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                                            report.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                                            report.status === 'dispatched' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {report.issue_type?.toLowerCase().includes('garb') ? '🗑️' : '🛣️'}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-tight">{report.issue_type}</h3>
                                            <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {report.village_name || 'Coordinate Data Attached'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
                                        report.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                        report.status === 'dispatched' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {report.status}
                                    </span>
                                </div>

                                <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700 mb-4">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-2">
                                        <span className="text-slate-400">AI Confidence Score</span>
                                        <span className="text-blue-600">92.4%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full w-[92%] rounded-full"></div>
                                    </div>
                                </div>

                                {selectedReport?.id === report.id && report.status !== 'resolved' && (
                                    <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95 duration-300">
                                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                                            <h4 className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase mb-3 flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4" /> Geofenced Resolution
                                            </h4>
                                            <div className="flex flex-col gap-3">
                                                <button 
                                                    onClick={() => setResolutionPhoto('mock_photo_url')}
                                                    className="w-full py-4 bg-white dark:bg-zinc-800 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                                                >
                                                    <Camera className="w-5 h-5" /> {resolutionPhoto ? 'Photo Captured' : 'Capture Resolution Photo'}
                                                </button>
                                                <button 
                                                    onClick={() => handleResolveTicket(report)}
                                                    disabled={isResolving || !resolutionPhoto}
                                                    className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {isResolving ? <Activity className="animate-spin w-5 h-5" /> : 'Mark as Resolved'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {view === 'tools' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-6 duration-500 pb-10">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Field Operations</h2>
                            <p className="text-slate-500 font-medium">Native tools for real-time protection</p>
                        </div>
                        <div className="space-y-4">
                            <button onClick={() => navigate('/report/garbage')} className="w-full bg-white dark:bg-zinc-800 p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 active:scale-[0.98] transition-all">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-inner">🗑️</div>
                                <div className="flex-1">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase">Manual Report</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-tight">Capture hazards in the field</p>
                                </div>
                                <ChevronRight className="w-6 h-6 text-emerald-500" />
                            </button>
                            <button onClick={() => navigate('/report/pothole')} className="w-full bg-white dark:bg-zinc-800 p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 active:scale-[0.98] transition-all">
                                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner"><Activity className="w-8 h-8" /></div>
                                <div className="flex-1">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase">Vibration Sense</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-tight">Continuous road quality detection</p>
                                </div>
                                <ChevronRight className="w-6 h-6 text-blue-500" />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button onClick={() => navigate('/map')} className="bg-white dark:bg-zinc-800 p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center gap-3">
                                <MapIcon className="w-7 h-7 text-emerald-500" />
                                <span className="text-[11px] font-black uppercase tracking-wider">Public Map</span>
                            </button>
                            <button onClick={() => navigate('/history')} className="bg-white dark:bg-zinc-800 p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center gap-3">
                                <History className="w-7 h-7 text-blue-500" />
                                <span className="text-[11px] font-black uppercase tracking-wider">Log History</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
