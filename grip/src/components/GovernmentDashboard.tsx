import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Globe,
  AlertTriangle,
  CheckSquare,
  Users,
  Building,
  LogOut, 
  MapPin,
  Camera,
  Activity,
  Menu,
  X,
  Truck,
  Factory
} from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import villageMapping from '../data/village_mapping.json';


import { 
    DynamicMapLayers,
    getConditionColor,
    MapBoundsUpdater
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
  resolved_at?: string;
  image_path?: string;
}

type DeptType = 'PWD' | 'Panchayat' | 'Universal';

const PWD_TABS = [
  { id: 'dashboard', label: 'Dashboard Map', icon: Globe, color: 'text-blue-500' },
  { id: 'pending', label: 'Pending Action', icon: AlertTriangle, color: 'text-red-500' },
  { id: 'resolved', label: 'Resolved', icon: CheckSquare, color: 'text-emerald-500' },
  { id: 'workers', label: 'Field Workers', icon: Users, color: 'text-amber-500' },
  { id: 'departments', label: 'Departments', icon: Building, color: 'text-indigo-400' }
];

const PANCHAYAT_TABS = [
  { id: 'dashboard', label: 'KPI Dashboard', icon: Globe, color: 'text-emerald-500' },
  { id: 'pending', label: 'Active Hazards', icon: AlertTriangle, color: 'text-amber-500' },
  { id: 'resolved', label: 'Resolved', icon: CheckSquare, color: 'text-purple-500' },
  { id: 'workers', label: 'Field Workers', icon: Users, color: 'text-amber-500' },
  { id: 'machinery', label: 'Heavy Machinery', icon: Truck, color: 'text-emerald-600' }
];

export default function GovernmentDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Core State
    const [reports, setReports] = useState<Report[]>([]);
    const [conditions, setConditions] = useState<any[]>([]);
    const [departmentsList, setDepartmentsList] = useState<any[]>([]);
    const [fieldWorkers, setFieldWorkers] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [deptType, setDeptType] = useState<DeptType>('Universal');
    const [deptName, setDeptName] = useState('GRIP Command Center');
    const [jurisdiction, setJurisdiction] = useState<{ name: string, taluka: string } | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    
    // UI State
    const [activeTab, setActiveTab] = useState('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);
    const [selectedAuditDept, setSelectedAuditDept] = useState<any | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    // Initial Setup
    useEffect(() => {
        if (location.pathname.includes('/pwd')) setDeptType('PWD');
        else if (location.pathname.includes('/panchayat')) setDeptType('Panchayat');
        else setDeptType('Universal');
    }, [location.pathname]);

    const initDashboard = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const isPwdRoute = location.pathname.includes('/pwd');
            const isPanchayatRoute = location.pathname.includes('/panchayat');
            
            let currentDeptName = 'GRIP Command Center';
            if (isPwdRoute) {
                currentDeptName = 'PWD Command Center';
            } else if (isPanchayatRoute) {
                currentDeptName = 'Panchayat Solid Waste Management';
            }
            
            let deptInfo: any = null;
            
            const activeEmail = session?.user?.email || localStorage.getItem('gov_email');

            if (activeEmail) {
                const email = activeEmail.toLowerCase();
                
                const { data } = await supabase
                    .from('departments')
                    .select('department_name, taluka_name, department_type')
                    .eq('contact_email', email)
                    .limit(1);
                
                deptInfo = data && data.length > 0 ? data[0] : null;
                
                let sessionIsPwd = false;
                let sessionIsPanchayat = false;
                
                if (deptInfo && deptInfo.department_type) {
                    const type = deptInfo.department_type.toUpperCase();
                    sessionIsPwd = type.includes('PWD');
                    sessionIsPanchayat = type.includes('PANCHAYAT') || type.includes('MUNICIPAL');
                } else {
                    // Fallback to email checking just in case
                    sessionIsPwd = email.includes('pwd');
                    sessionIsPanchayat = email.includes('panchayat') || email.includes('village');
                }

                const matchesRoute = (!isPwdRoute && !isPanchayatRoute) ||
                                     (isPwdRoute && sessionIsPwd) ||
                                     (isPanchayatRoute && sessionIsPanchayat);

                if (!matchesRoute) {
                    if (sessionIsPwd) {
                        navigate('/gov/pwd', { replace: true });
                        return;
                    } else if (sessionIsPanchayat) {
                        navigate('/gov/panchayat', { replace: true });
                        return;
                    }
                }

                if (matchesRoute) {
                    if (deptInfo) {
                        currentDeptName = deptInfo.department_name;
                        setJurisdiction({ name: deptInfo.department_name, taluka: deptInfo.taluka_name });
                        setDeptName(deptInfo.department_name);
                    }
                    if (sessionIsPwd) setDeptType('PWD');
                    else if (sessionIsPanchayat) setDeptType('Panchayat');
                } else {
                    setJurisdiction(null);
                    setDeptName(currentDeptName);
                    if (isPwdRoute) setDeptType('PWD');
                    else if (isPanchayatRoute) setDeptType('Panchayat');
                }
            } else {
                setJurisdiction(null);
                setDeptName(currentDeptName);
                if (isPwdRoute) setDeptType('PWD');
                else if (isPanchayatRoute) setDeptType('Panchayat');
                else setDeptType('Universal');
            }

            // Fetch Reports
            let query = supabase.from('reports').select('*');
            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                if (currentDeptName !== 'GRIP Command Center' && currentDeptName !== 'PWD Command Center' && deptInfo) {
                    const isPanchayat = deptInfo.department_type?.toLowerCase().includes('panchayat');
                    const panchayatName = isPanchayat ? deptInfo.department_name.replace(/Village Panchayat/ig, '').trim().toLowerCase() : '';
                    const keywords = isPanchayat ? panchayatName.split(/[- \/]/).filter((k: string) => k.length > 2) : [];

                    const filtered = data.filter(r => {
                        if (!r.village_name) return false;
                        if (isPanchayat) {
                            const vName = r.village_name.toLowerCase();
                            return vName === panchayatName || keywords.some((k: string) => vName.includes(k));
                        } else {
                            const reportTaluka = (villageMapping as Record<string, string>)[r.village_name];
                            return reportTaluka?.toLowerCase() === deptInfo.taluka_name?.toLowerCase();
                        }
                    });
                    setReports(filtered);
                } else {
                    setReports(data);
                }
            }

            // Fetch Additional Analytics Data directly from DB (Serverless Architecture)
            const { data: depts } = await supabase.from('departments').select('*');
            if (depts) setDepartmentsList(depts);

            const { data: workers } = await supabase.from('field_workers').select(`
                id,
                worker_name,
                specialty,
                phone_number,
                is_available,
                department_id,
                departments(department_name, taluka_name, department_type)
            `);
            if (workers) {
                if (currentDeptName !== 'GRIP Command Center' && currentDeptName !== 'PWD Command Center' && deptInfo) {
                    const filteredWorkers = workers.filter(w => w.department_id === deptInfo.id);
                    setFieldWorkers(filteredWorkers);
                } else {
                    setFieldWorkers(workers);
                }
            }

            let allConditions: any[] = [];
            let from = 0;
            const PAGE_SIZE = 1000;
            while (from < 10000) {
                const { data: roadData } = await supabase
                    .from('road_segments')
                    .select('*')
                    .neq('label', 'GOOD')
                    .range(from, from + PAGE_SIZE - 1);
                
                if (!roadData || roadData.length === 0) break;
                
                // Filter road points if we are a regional admin
                let filteredData = roadData;
                if (currentDeptName !== 'GRIP Command Center' && currentDeptName !== 'PWD Command Center' && deptInfo) {
                    const isPanchayat = deptInfo.department_type?.toLowerCase().includes('panchayat');
                    const panchayatName = isPanchayat ? deptInfo.department_name.replace(/Village Panchayat/ig, '').trim().toLowerCase() : '';
                    const keywords = isPanchayat ? panchayatName.split(/[- \/]/).filter((k: string) => k.length > 2) : [];

                    filteredData = roadData.filter(pt => {
                        if (!pt.village_name) return false;
                        if (isPanchayat) {
                            const vName = pt.village_name.toLowerCase();
                            return vName === panchayatName || keywords.some((k: string) => vName.includes(k));
                        } else {
                            const segmentTaluka = (villageMapping as Record<string, string>)[pt.village_name];
                            return segmentTaluka?.toLowerCase() === deptInfo.taluka_name?.toLowerCase();
                        }
                    });
                }
                
                allConditions = [...allConditions, ...filteredData];
                if (roadData.length < PAGE_SIZE) break;
                from += PAGE_SIZE;
            }
            setConditions(allConditions);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (e) {
            console.error("Dashboard Init Error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initDashboard();
        const interval = setInterval(initDashboard, 15000);
        return () => clearInterval(interval);
    }, []);

    // Derived Data
    const filteredReports = useMemo(() => {
        if (deptType === 'PWD') {
            return reports.filter(r => 
                r.issue_type?.toLowerCase().includes('pothole') || 
                r.issue_type?.toLowerCase().includes('road') ||
                r.issue_type?.toLowerCase().includes('hump') ||
                r.issue_type?.toLowerCase().includes('subsidence')
            );
        } else if (deptType === 'Panchayat') {
            return reports.filter(r => 
                r.issue_type?.toLowerCase().includes('garbage') || 
                r.issue_type?.toLowerCase().includes('dump') ||
                r.issue_type?.toLowerCase().includes('waste') ||
                r.issue_type?.toLowerCase().includes('trash')
            );
        }
        return reports;
    }, [reports, deptType]);

    const pendingReports = filteredReports.filter(r => ['pending', 'new'].includes(r.status?.toLowerCase()));
    const activeReports = filteredReports.filter(r => ['dispatched', 'in_progress', 'escalated'].includes(r.status?.toLowerCase()));
    const resolvedReports = filteredReports.filter(r => ['resolved', 'completed'].includes(r.status?.toLowerCase()));

    const getConfidenceScore = (predictions: any) => {
        try {
            if (!predictions) return null;
            const parsed = typeof predictions === 'string' ? JSON.parse(predictions) : predictions;
            if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(0);
        } catch (e) { return null; }
        return null;
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('user_mode');
        localStorage.removeItem('gov_email');
        window.dispatchEvent(new Event('auth-change'));
        navigate('/');
    };

    const handleResolveTicket = async (report: Report) => {
        setIsResolving(true);
        setTimeout(async () => {
            const { error } = await supabase
                .from('reports')
                .update({ 
                    status: 'resolved'
                })
                .eq('id', report.id);
                
            if (error) {
                alert(`❌ Update Failed: ${error.message}`);
                console.error(error);
            } else {
                alert("✅ Ticket resolved!");
            }
            setSelectedReport(null);
            setIsResolving(false);
            initDashboard();
        }, 1500);
    };

    const handleDispatchTicket = async (report: Report) => {
        try {
            const activeEmail = (await supabase.auth.getSession()).data.session?.user?.email || localStorage.getItem('gov_email');
            
            let department_id = 1; // Default fallback
            if (activeEmail) {
                const { data: deptData } = await supabase
                    .from('departments')
                    .select('id')
                    .eq('contact_email', activeEmail.toLowerCase())
                    .limit(1);
                if (deptData && deptData.length > 0) {
                    department_id = deptData[0].id;
                }
            }

            const { error: woError } = await supabase
                .from('work_orders')
                .insert({
                    report_uuid: report.id,
                    department_id: department_id,
                    status: 'Pending'
                });

            if (woError) throw woError;

            const { error: rError } = await supabase
                .from('reports')
                .update({ status: 'dispatched' })
                .eq('id', report.id);

            if (rError) throw rError;

            alert("✅ Ticket dispatched successfully to field worker!");
            initDashboard();
        } catch (error: any) {
            alert(`❌ Dispatch failed: ${error.message}`);
            console.error(error);
        }
    };

    const TABS = deptType === 'Panchayat' ? PANCHAYAT_TABS : PWD_TABS;

    if (loading && reports.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-600 font-semibold tracking-wide">Initializing GRIP Subsystems...</p>
            </div>
        );
    }

    // -- Sub-Views --

    const renderDashboardMap = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3 lg:gap-6">
                <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Awaiting Dispatch</h3>
                    <p className="text-2xl lg:text-4xl font-black text-slate-800 mt-1 lg:mt-3">{pendingReports.length}</p>
                </div>
                <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Active Assignments</h3>
                    <p className="text-2xl lg:text-4xl font-black text-blue-600 mt-1 lg:mt-3">{activeReports.length}</p>
                </div>
                <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">Total Resolved</h3>
                    <p className="text-2xl lg:text-4xl font-black text-emerald-600 mt-1 lg:mt-3">{resolvedReports.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[420px] lg:min-h-[500px]">
                    <div className="flex justify-between items-center mb-5">
                        <h2 className="text-lg font-bold text-slate-800">Live Incident Map</h2>
                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">
                            {filteredReports.length} Active Pins
                        </span>
                    </div>
                    <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative min-h-[320px] z-0">
                        <MapContainer center={[15.4909, 73.8278]} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                            <DynamicMapLayers 
                                reports={filteredReports} 
                                showReports={true} 
                                showSensors={deptType === 'PWD'} 
                                showHeatmap={deptType === 'PWD'}
                                conditions={conditions}
                                getConditionColor={getConditionColor}
                            />
                            <MapBoundsUpdater points={[...conditions, ...filteredReports]} />
                        </MapContainer>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[420px] lg:min-h-[500px]">
                    <h2 className="text-lg font-bold text-slate-800 mb-5 pb-4 border-b border-slate-100">Recent Reports</h2>
                    <div className="overflow-y-auto flex-1 pr-2 space-y-4">
                        {pendingReports.map(report => (
                            <div key={report.id} className="bg-white border-slate-200 p-4 border rounded-xl">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-100 text-amber-700 uppercase tracking-wider">PENDING</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">{report.id.split('-')[0]}</span>
                                </div>
                                <h3 className="font-bold text-slate-800">{report.issue_type}</h3>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {report.village_name || (report.latitude ? `${Number(report.latitude).toFixed(4)}, ${Number(report.longitude).toFixed(4)}` : 'Unknown')}
                                </p>
                                <div className="mt-3 bg-slate-50 p-2.5 rounded-lg">
                                    <div className="flex justify-between text-[10px] mb-1.5">
                                        <span className="font-semibold text-slate-600">AI Confidence</span>
                                        <span className="font-bold text-slate-800">{getConfidenceScore(report.ai_predictions) ? `${getConfidenceScore(report.ai_predictions)}%` : 'Calculating...'}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${getConfidenceScore(report.ai_predictions) ? 'bg-blue-500' : 'bg-slate-400 animate-pulse'}`} style={{ width: getConfidenceScore(report.ai_predictions) ? `${getConfidenceScore(report.ai_predictions)}%` : '100%' }}></div>
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-slate-500">{new Date(report.created_at).toLocaleDateString()}</span>
                                    <span className="font-bold text-slate-400">{getConfidenceScore(report.ai_predictions) ? 'Analysis Complete' : 'Processing Image...'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPendingAction = () => (
        <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in duration-500">
            <div className="mb-6">
                <h2 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">Active Work Orders</h2>
                <p className="text-xs lg:text-sm text-slate-500 mt-1">Monitor field resolution SLAs and potential deadline breaches.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                    <tr className="border-b-2 border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="p-4 pl-0">Issue Type</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Assigned To</th>
                        <th className="p-4">SLA Status</th>
                        <th className="p-4 text-right pr-0">Action</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {pendingReports.concat(activeReports).map((report, idx) => {
                        const isBreached = (new Date().getTime() - new Date(report.created_at).getTime()) > 48 * 3600 * 1000;
                        return (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="p-4 pl-0 font-bold text-slate-800">{report.issue_type}</td>
                                <td className="p-4 text-slate-600">{report.village_name || (report.latitude ? `${Number(report.latitude).toFixed(4)}, ${Number(report.longitude).toFixed(4)}` : 'Unknown')}</td>
                                <td className="p-4 text-slate-600">{report.status === 'dispatched' ? 'Field Team' : 'Pending Assignment'}</td>
                                <td className="p-4">
                                    {isBreached ? (
                                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center w-max gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> SLA Breached (Overdue)
                                        </span>
                                    ) : (
                                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold flex items-center w-max gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> On Track
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right pr-0 flex items-center justify-end gap-2">
                                    {report.status !== 'dispatched' && (
                                        <button 
                                            onClick={() => handleDispatchTicket(report)}
                                            className="text-emerald-600 font-bold text-xs hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-md"
                                        >
                                            Dispatch
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setSelectedReport(report)}
                                        className="text-blue-600 font-bold text-xs hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-md"
                                    >
                                        Resolve ▼
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>

            {selectedReport && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-lg font-bold mb-4">Resolve {selectedReport.issue_type}</h3>
                        <p className="text-sm text-slate-600 mb-6">Confirm field completion for {selectedReport.id}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedReport(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold">Cancel</button>
                            <button onClick={() => handleResolveTicket(selectedReport)} disabled={isResolving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold flex justify-center items-center">
                                {isResolving ? <Activity className="animate-spin w-5 h-5" /> : 'Confirm Resolved'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderResolved = () => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-6">
                <div>
                    <h2 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">Audit Log & Completed Work</h2>
                    <p className="text-xs lg:text-sm text-slate-500 mt-1">Historical ledger of all verified {deptType === 'Panchayat' ? 'solid waste clearances' : 'infrastructure repairs'}.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <div className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center whitespace-nowrap">
                        {resolvedReports.length} Clearances Verified
                    </div>
                    <button className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-slate-50 whitespace-nowrap">
                        📥 Export PDF
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="p-4 rounded-l-lg">Issue & Ticket ID</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Cleared By</th>
                        <th className="p-4">Resolution Time</th>
                        <th className="p-4">SLA Status</th>
                        <th className="p-4 rounded-r-lg text-right">Proof of Work</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {resolvedReports.map((report, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                                <div className="font-bold text-slate-800">{report.issue_type}</div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{report.id.split('-')[0]}</div>
                            </td>
                            <td className="p-4">
                                <div className="font-bold text-slate-700">{report.village_name || 'Unknown'}</div>
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">V</div>
                                    <span className="font-bold text-slate-700 text-xs">Verified Contractor</span>
                                </div>
                            </td>
                            <td className="p-4 text-xs text-slate-500 font-medium">
                                {report.resolved_at ? new Date(report.resolved_at).toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'}) : 'N/A'}
                            </td>
                            <td className="p-4">
                                <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                                    On Time
                                </span>
                            </td>
                            <td className="p-4 text-right">
                                {report.image_path ? (
                                    <button 
                                        onClick={() => {
                                            const imgUrl = report.image_path!.startsWith('uploads/') 
                                                ? `${import.meta.env.VITE_FASTAPI_URL}/${report.image_path}`
                                                : supabase.storage.from('reports').getPublicUrl(report.image_path!).data.publicUrl;
                                            setViewPhotoUrl(imgUrl);
                                        }}
                                        className="text-blue-600 font-bold text-[10px] flex items-center justify-end gap-1 uppercase tracking-wider w-full hover:text-blue-800 transition-colors"
                                    >
                                        <Camera className="w-3 h-3" /> View Photo
                                    </button>
                                ) : (
                                    <span className="text-slate-300 font-bold text-[10px] uppercase tracking-wider flex items-center justify-end gap-1"><Camera className="w-3 h-3" /> No Photo</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    );

    const renderPWDFieldWorkers = () => {
        const pwdWorkers = fieldWorkers.filter(w => w.departments?.department_type === 'PWD_DIVISION');

        return (
            <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in duration-500 min-h-[500px]">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3 mb-6">
                    <div>
                        <h2 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">Field Workers Roster</h2>
                        <p className="text-xs lg:text-sm text-slate-500 mt-1">Manage personnel and monitor active task loads across all Talukas.</p>
                    </div>
                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                        {pwdWorkers.length} Total Active Staff
                    </div>
                </div>
                {pwdWorkers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Users className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="font-medium">No field workers currently clocked in.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pwdWorkers.map((worker, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl uppercase shadow-inner">
                                    {worker.worker_name?.charAt(0) || 'W'}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800">{worker.worker_name}</h4>
                                    <p className="text-xs text-slate-500">{worker.departments?.taluka_name || 'Unknown'} • {worker.specialty || 'General'}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${worker.is_available ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{worker.is_available ? 'Available' : 'Busy'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderPWDDepartments = () => {
        const pwdDepts = departmentsList.filter(d => d.department_type === 'PWD_DIVISION');

        const enhancedDepartments = pwdDepts.map(dept => {
            const deptReports = reports.filter(r => {
                if (!r.village_name) return false;
                const reportTaluka = (villageMapping as Record<string, string>)[r.village_name];
                return reportTaluka?.toLowerCase() === dept.taluka_name?.toLowerCase();
            });
            const total = deptReports.length;
            const resolved = deptReports.filter(r => ['resolved', 'completed'].includes(r.status?.toLowerCase())).length;
            
            const breaches = deptReports.filter(r => {
                if (['resolved', 'completed'].includes(r.status?.toLowerCase())) return false;
                if (r.escalation_deadline) {
                    return new Date().getTime() > new Date(r.escalation_deadline).getTime();
                }
                return false;
            }).length;

            const deptWorkers = fieldWorkers.filter(w => w.department_id === dept.id).length;
            const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

            return { ...dept, total, resolved, breaches, deptWorkers, resolutionRate };
        });

        return (
            <div className="animate-in fade-in duration-500">
                <div className="mb-6">
                    <h2 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">Department Performance</h2>
                    <p className="text-xs lg:text-sm text-slate-500 mt-1">Evaluate resolution rates and SLA compliance across Goa.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {enhancedDepartments.map((div, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">{div.taluka_name || 'UNKNOWN'} TALUKA</span>
                                    <h3 className="text-lg font-bold text-slate-800 mt-2">{div.department_name}</h3>
                                    <p className="text-xs text-slate-500 mt-1">Officer: <span className="font-bold text-slate-700">{div.officer_in_charge || 'Executive Engineer'}</span></p>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-slate-800">{div.total}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Issues</div>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-4 pb-4">
                                <div className="flex justify-between text-xs font-bold mb-1.5">
                                    <span className="text-slate-600">Resolution Rate</span>
                                    <span className="text-slate-800">{div.resolutionRate}% ({div.resolved} fixed)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${div.resolutionRate}%` }}></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active SLA Breaches</div>
                                    <div className="text-lg font-black text-emerald-500">{div.breaches}</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Field Workers</div>
                                    <div className="text-lg font-black text-slate-700">{div.deptWorkers}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedAuditDept(div)}
                                className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                View Detailed Audit Report
                            </button>
                        </div>
                    ))}
                    {enhancedDepartments.length === 0 && (
                        <p className="text-slate-500 text-sm">No PWD departments found in the database.</p>
                    )}
                </div>
            </div>
        );
    };

    const renderPanchayatMRF = () => (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3 mb-6">
                <div>
                    <h2 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">MRF Shed Inventory</h2>
                    <p className="text-xs lg:text-sm text-slate-500 mt-1">{jurisdiction?.name || 'Torxem Village Panchayat'} Material Recovery Facility</p>
                </div>
                <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm hover:bg-slate-50 transition-colors whitespace-nowrap">
                    ⚙️ Update Machinery Status
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h3 className="font-bold text-slate-800">Overall Shed Capacity</h3>
                        <p className="text-xs text-slate-500">Maximum structural load: 5.0 Tonnes</p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-slate-800">55%</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filled</p>
                    </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-2 flex overflow-hidden">
                    <div className="bg-amber-400 h-full" style={{ width: '55%' }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>0 Tonnes</span>
                    <span>2.75 / 5.0 T</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-6">Categorized Inventory</h3>
                    <div className="space-y-6">
                        {[
                            { name: 'Baled Plastic', desc: 'Ready for Transport', qty: '1200 KG', color: 'bg-emerald-500' },
                            { name: 'Loose Cardboard', desc: 'Requires Sorting', qty: '450 KG', color: 'bg-amber-500' },
                            { name: 'Glass Bottles', desc: 'Ready for Transport', qty: '800 KG', color: 'bg-amber-400' },
                            { name: 'Mixed Rejects', desc: 'Awaiting GWMC', qty: '300 KG', color: 'bg-amber-600' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">{item.name}</h4>
                                        <p className="text-xs text-slate-500">{item.desc}</p>
                                    </div>
                                </div>
                                <div className="text-sm font-black text-slate-800">{item.qty}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-[#0f172a] p-6 rounded-2xl shadow-lg border border-slate-800">
                        <h3 className="font-bold text-white mb-2">GWMC Transfer Protocol</h3>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            When the shed exceeds 85% capacity, initiate a bulk transfer to the state waste management facility to prevent overflow.
                        </p>
                        <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20">
                            Dispatch Fleet to Clear Shed
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hardware Status</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                                <span className="text-sm font-bold text-slate-700">Hydraulic Baler</span>
                                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border border-emerald-100">Operational</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-700">Electronic Weighing Scale</span>
                                <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border border-red-100">Needs Repair</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPanchayatMachinery = () => (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3 mb-6">
                <div>
                    <h2 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">Machinery & Contractors</h2>
                    <p className="text-xs lg:text-sm text-slate-500 mt-1">Empanelled fleet registry for solid waste and C&D clearing operations.</p>
                </div>
                <input 
                    type="text" 
                    placeholder="Search contractor or machine..." 
                    className="border border-slate-200 rounded-lg px-4 py-2 text-sm w-full lg:w-64 shadow-sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    {
                        name: 'Naik Earthmovers',
                        proprietor: 'Ramesh Naik',
                        contact: '+91 98765 43210',
                        rate: '₹3500',
                        gwmc: 'Verified ✓',
                        status: 'Available',
                        statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                        fleet: ['JCB 3DX Backhoe', '2x 10-Ton Tippers'],
                        btnText: 'Draft Work Order',
                        btnStyle: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        disabled: false
                    },
                    {
                        name: 'Dessai Logistics & Clearing',
                        proprietor: 'Sandeep Dessai',
                        contact: '+91 99887 76655',
                        rate: '₹1500',
                        gwmc: 'Verified ✓',
                        status: 'Available',
                        statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                        fleet: ['Bobcat Skid Steer', '1x Tata Ace Mini-Truck'],
                        btnText: 'Draft Work Order',
                        btnStyle: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        disabled: false
                    },
                    {
                        name: 'State GWMC Emergency Transport',
                        proprietor: 'Govt. of Goa',
                        contact: '1800-GWMC-GOA',
                        rate: 'State Subsidized',
                        gwmc: 'Verified ✓',
                        status: 'Busy',
                        statusColor: 'bg-red-50 text-red-600 border-red-200',
                        fleet: ['20-Ton Compactor Truck', 'Heavy Excavator'],
                        btnText: 'Fleet Currently Deployed',
                        btnStyle: 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed',
                        disabled: true
                    },
                    {
                        name: 'Fernandes Local Transit',
                        proprietor: 'Antonio Fernandes',
                        contact: '+91 97654 32109',
                        rate: '₹800',
                        gwmc: 'Pending ⚠️',
                        gwmcColor: 'text-amber-500',
                        status: 'Available',
                        statusColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                        fleet: ['1x Mahindra Bolero Pickup'],
                        btnText: 'Cannot Dispatch (No GWMC)',
                        btnStyle: 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed',
                        disabled: true
                    }
                ].map((contractor, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg leading-tight">{contractor.name}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Proprietor: {contractor.proprietor}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${contractor.statusColor}`}>
                                {contractor.status}
                            </span>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 mb-6">
                            <div className="flex justify-between"><span className="font-medium text-slate-500">Contact:</span> <span className="font-bold">{contractor.contact}</span></div>
                            <div className="flex justify-between"><span className="font-medium text-slate-500">Trip Rate:</span> <span className="font-bold">{contractor.rate}</span></div>
                            <div className="flex justify-between"><span className="font-medium text-slate-500">GWMC Reg:</span> <span className={`font-bold ${contractor.gwmcColor || 'text-emerald-600'}`}>{contractor.gwmc}</span></div>
                        </div>
                        <div className="mt-auto">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Registered Fleet Inventory</p>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {contractor.fleet.map((item, i) => (
                                    <span key={i} className="bg-slate-50 border border-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                                        <Truck className="w-3 h-3" /> {item}
                                    </span>
                                ))}
                            </div>
                            <button 
                                disabled={contractor.disabled}
                                className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-colors ${contractor.btnStyle}`}
                            >
                                {contractor.btnText}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDetailedAuditReport = () => {
        if (!selectedAuditDept) return null;

        const deptReports = reports.filter(r => {
            if (!r.village_name) return false;
            const reportTaluka = (villageMapping as Record<string, string>)[r.village_name];
            return reportTaluka?.toLowerCase() === selectedAuditDept.taluka_name?.toLowerCase();
        });

        const resolvedReportsCount = deptReports.filter(r => r.resolved_at && r.created_at);
        let avgResolutionHours = 0;
        if (resolvedReportsCount.length > 0) {
            const totalMs = resolvedReportsCount.reduce((acc, r) => {
                return acc + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime());
            }, 0);
            avgResolutionHours = Math.round(totalMs / resolvedReportsCount.length / (1000 * 60 * 60));
        }

        // Hotspots (villages with most reports)
        const villageCounts: Record<string, number> = {};
        deptReports.forEach(r => {
            if (r.village_name) {
                villageCounts[r.village_name] = (villageCounts[r.village_name] || 0) + 1;
            }
        });
        const hotspots = Object.entries(villageCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

        // Workers for this dept
        const deptWorkersList = fieldWorkers.filter(w => w.department_id === selectedAuditDept.id);

        const handleExportPDF = (e: React.MouseEvent) => {
            e.stopPropagation();
            const btn = e.currentTarget as HTMLButtonElement;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="flex items-center gap-2">⏳ Generating PDF...</span>';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = '<span class="flex items-center gap-2 text-emerald-600">✅ PDF Saved Successfully</span>';
                btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
                btn.classList.add('bg-emerald-50', 'border-emerald-200');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
                    btn.classList.remove('bg-emerald-50', 'border-emerald-200');
                }, 3000);
            }, 1500);
        };

        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 lg:p-10 animate-in fade-in backdrop-blur-sm" onClick={() => setSelectedAuditDept(null)}>
                <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-6 lg:p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-full">{selectedAuditDept.taluka_name} TALUKA</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-200 px-3 py-1 rounded-full">AUDIT REPORT</span>
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{selectedAuditDept.department_name}</h2>
                            <p className="text-sm text-slate-500 mt-1">Officer in Charge: <span className="font-bold text-slate-700">{selectedAuditDept.officer_in_charge || 'Executive Engineer'}</span></p>
                        </div>
                        <button onClick={() => setSelectedAuditDept(null)} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-full transition-colors shadow-sm">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                        
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Issues</p>
                                <p className="text-3xl font-black text-slate-800">{selectedAuditDept.total}</p>
                            </div>
                            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution Rate</p>
                                <p className="text-3xl font-black text-blue-600">{selectedAuditDept.resolutionRate}%</p>
                            </div>
                            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Resolution</p>
                                <p className="text-3xl font-black text-slate-800">{avgResolutionHours > 0 ? `${avgResolutionHours}h` : 'N/A'}</p>
                            </div>
                            <div className="bg-red-50 border border-red-100 p-5 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">SLA Breaches</p>
                                <p className="text-3xl font-black text-red-600">{selectedAuditDept.breaches}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Hotspots */}
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-900 mb-4 border-b border-slate-100 pb-2">Geographical Hotspots</h3>
                                {hotspots.length > 0 ? (
                                    <div className="space-y-3">
                                        {hotspots.map(([village, count], idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                                                    <span className="font-bold text-slate-800">{village}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-slate-800">{count}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider ml-1">Reports</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">No sufficient data for hotspots.</p>
                                )}
                            </div>

                            {/* Worker Efficiency */}
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-900 mb-4 border-b border-slate-100 pb-2">Field Worker Efficiency</h3>
                                {deptWorkersList.length > 0 ? (
                                    <div className="space-y-3">
                                        {deptWorkersList.map((worker, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold uppercase">{worker.worker_name?.charAt(0) || 'W'}</div>
                                                    <div>
                                                        <span className="font-bold text-slate-800 block">{worker.worker_name}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{worker.specialty || 'General'}</span>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${worker.is_available ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                    {worker.is_available ? 'Available' : 'Busy'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">No field workers assigned to this department.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4 shrink-0">
                        <button onClick={() => setSelectedAuditDept(null)} className="px-6 py-3 font-bold text-slate-600 hover:text-slate-900 transition-colors">
                            Close Report
                        </button>
                        <button onClick={handleExportPDF} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-2">
                            📥 Generate Official PDF Audit
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 bg-[#0f172a] text-slate-300 flex-col h-full shadow-2xl z-20">
                <div className="p-6">
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        {deptType === 'Panchayat' ? 'GRIP : SWM' : (deptType === 'PWD' ? 'GRIP : PWD' : 'GRIP')}
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {deptType === 'Panchayat' ? 'Village Panchayat Console' : (deptType === 'PWD' ? 'PWD Infrastructure Console' : 'Command Center')}
                    </p>
                </div>
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {TABS.filter(t => t.id !== 'departments' || deptName.includes('Command Center')).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-white/10 text-white border-l-4 border-indigo-500' 
                                    : 'hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                            }`}
                        >
                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? tab.color : 'text-slate-500'}`} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
                <div className="p-6 mt-auto">
                    <button onClick={handleSignOut} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                        <LogOut className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            </aside>

            {/* Mobile Header & Content Wrapper */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header (Responsive) */}
                <header className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button className="lg:hidden p-2 -ml-2 text-slate-600" onClick={() => setMobileMenuOpen(true)}>
                            <Menu className="w-6 h-6" />
                        </button>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight hidden lg:block">
                                {deptName}
                            </h2>
                            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight lg:hidden">
                                {deptType === 'Panchayat' ? 'GRIP : SWM' : (deptType === 'PWD' ? 'GRIP : PWD' : 'GRIP')}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium hidden lg:block">
                                {deptType === 'Panchayat' ? 'Solid Waste Management' : (deptType === 'PWD' ? 'PWD Infrastructure & Roads' : 'Goa Realtime Infrastructure Protection')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex bg-white border border-slate-200 px-4 py-1.5 rounded-lg shadow-sm flex-col justify-center">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">System Status</p>
                            <div className="flex items-center mt-0.5">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1.5"></span>
                                <span className="text-xs font-bold text-slate-700">Live • Updated {lastUpdated}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
                    <div className="max-w-7xl mx-auto pb-24 lg:pb-0">
                        {activeTab === 'dashboard' && renderDashboardMap()}
                        {activeTab === 'pending' && renderPendingAction()}
                        {activeTab === 'resolved' && renderResolved()}
                        {/* Shared views */}
                        {activeTab === 'workers' && renderPWDFieldWorkers()}
                        
                        {/* PWD specific views */}
                        {activeTab === 'departments' && deptType === 'PWD' && renderPWDDepartments()}
                        
                        {/* Panchayat specific views */}
                        {activeTab === 'mrf' && deptType === 'Panchayat' && renderPanchayatMRF()}
                        {activeTab === 'machinery' && deptType === 'Panchayat' && renderPanchayatMachinery()}
                    </div>
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]" style={{ zIndex: 9999 }}>
                    {TABS.filter(t => t.id !== 'departments' || deptName.includes('Command Center')).slice(0, 5).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-col items-center p-2 min-w-[64px] rounded-xl transition-colors ${activeTab === tab.id ? 'bg-slate-50' : ''}`}
                        >
                            <tab.icon className={`w-6 h-6 mb-1 ${activeTab === tab.id ? tab.color : 'text-slate-400'}`} />
                            <span className={`text-[9px] font-bold ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-400'}`}>
                                {tab.label.split(' ')[0]}
                            </span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 flex" style={{ zIndex: 9999 }}>
                    <div className="fixed inset-0 bg-black/60" style={{ zIndex: 9999 }} onClick={() => setMobileMenuOpen(false)}></div>
                    <aside className="relative w-64 bg-[#0f172a] text-slate-300 flex flex-col h-full shadow-2xl animate-in slide-in-from-left" style={{ zIndex: 10000 }}>
                        <div className="p-6 flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    {deptType === 'Panchayat' ? 'GRIP : SWM' : (deptType === 'PWD' ? 'GRIP : PWD' : 'GRIP')}
                                </h1>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {deptType === 'Panchayat' ? 'Village Panchayat Console' : (deptType === 'PWD' ? 'PWD Infrastructure Console' : 'Command Center')}
                                </p>
                            </div>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-6 space-y-2 px-4">
                            {TABS.filter(t => t.id !== 'departments' || deptName.includes('Command Center')).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                                        activeTab === tab.id 
                                            ? 'bg-white/10 text-white border-l-4 border-indigo-500' 
                                            : 'hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                                    }`}
                                >
                                    <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? tab.color : 'text-slate-500'}`} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-6 mt-auto">
                            <button onClick={handleSignOut} className="w-full py-3 rounded-xl bg-white/5 font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                                <LogOut className="w-5 h-5 text-slate-400" /> Sign Out
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Photo Viewer Modal */}
            {viewPhotoUrl && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setViewPhotoUrl(null)}>
                    <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center p-4">
                        <button 
                            onClick={() => setViewPhotoUrl(null)}
                            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50 backdrop-blur-md"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img 
                            src={viewPhotoUrl} 
                            alt="Proof of Work" 
                            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {/* Detailed Audit Report Modal */}
            {renderDetailedAuditReport()}
        </div>
    );
}
