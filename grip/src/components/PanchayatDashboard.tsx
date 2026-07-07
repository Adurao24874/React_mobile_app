import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Globe, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PanchayatHome from './panchayat/PanchayatHome';
import PanchayatPending from './panchayat/PanchayatPending';
import PanchayatResolved from './panchayat/PanchayatResolved';
import PanchayatWorkers from './panchayat/PanchayatWorkers';
import PanchayatWorkerHome from './panchayat/PanchayatWorkerHome';
import { Users } from 'lucide-react';

export default function PanchayatDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptName, setDeptName] = useState('Initializing Workspace...');
  const [isFieldWorker, setIsFieldWorker] = useState(false);
  const [currentWorkerId, setCurrentWorkerId] = useState<string | null>(null);
  const [currentWorkerName, setCurrentWorkerName] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const currentTab = pathParts[pathParts.length - 1];
  const activeTab = currentTab === 'panchayat' ? 'dashboard' : currentTab;

  const fetchPanchayatData = async () => {
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
          if (dept && dept.length > 0) {
              targetDeptName = dept[0].department_name;
          } else {
              // Check if they are a field worker
              const { data: worker } = await supabase
                  .from('field_workers')
                  .select('id, department_id, worker_name')
                  .eq('email', activeEmail.toLowerCase())
                  .limit(1);
              
              if (worker && worker.length > 0 && worker[0].department_id) {
                  setIsFieldWorker(true);
                  setCurrentWorkerId(worker[0].id);
                  setCurrentWorkerName(worker[0].worker_name || 'Field Worker');
                  const { data: workerDept } = await supabase
                      .from('departments')
                      .select('department_name')
                      .eq('id', worker[0].department_id)
                      .limit(1);
                  if (workerDept && workerDept.length > 0) {
                      targetDeptName = workerDept[0].department_name;
                  }
              }
          }
      }
      setDeptName(targetDeptName);

      const { data: tickets, error } = await supabase
        .from('reports')
        .select('*')
        .or('issue_type.ilike.%garb%,issue_type.ilike.%dump%,issue_type.ilike.%waste%,issue_type.ilike.%c_and_d%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      let filteredTickets = tickets || [];
      if (targetDeptName !== "Panchayat Master Console") {
          let areaName = "";
          if (targetDeptName.toLowerCase().includes('village panchayat')) {
              areaName = targetDeptName.replace(/Village Panchayat/ig, '').trim().toLowerCase();
          } else if (targetDeptName.toLowerCase().includes('municipal council')) {
              areaName = targetDeptName.replace(/Municipal Council/ig, '').trim().toLowerCase();
          } else if (targetDeptName.toLowerCase().includes('municipality')) {
              areaName = targetDeptName.replace(/Municipality/ig, '').trim().toLowerCase();
          }

          if (areaName) {
              const keywords = areaName.split(/[- \/]/).filter((k: string) => k.length > 2);
              filteredTickets = filteredTickets.filter(r => {
                  if (!r.village_name) return false;
                  const vName = r.village_name.toLowerCase();
                  return vName === areaName || keywords.some((k: string) => vName.includes(k));
              });
          }
      }
      
      // Fetch associated work orders and workers
      const ticketIds = filteredTickets.map(t => String(t.id));
      if (ticketIds.length > 0) {
          const { data: workOrders } = await supabase
              .from('work_orders')
              .select('report_uuid, worker_id, status')
              .in('report_uuid', ticketIds);
              
          if (workOrders && workOrders.length > 0) {
              const workerIds = [...new Set(workOrders.map(wo => wo.worker_id))];
              const { data: workers } = await supabase
                  .from('field_workers')
                  .select('id, worker_name')
                  .in('id', workerIds);
                  
              filteredTickets = filteredTickets.map(ticket => {
                  const wo = workOrders.find(w => String(w.report_uuid) === String(ticket.id));
                  if (wo) {
                      const worker = workers?.find(w => w.id === wo.worker_id);
                      return {
                          ...ticket,
                          worker_name: worker ? worker.worker_name : 'Assigned',
                          worker_id: wo.worker_id,
                          work_order_status: wo.status
                      };
                  }
                  return ticket;
              });
          }
      }
      
      let finalTickets = filteredTickets.map(ticket => {
          const createdDate = new Date(ticket.created_at).getTime();
          const hoursSince = (Date.now() - createdDate) / (1000 * 60 * 60);
          let risk_status = 'On Track';
          let is_sla_breached = false;
          
          if (ticket.status?.toLowerCase() !== 'resolved' && ticket.status?.toLowerCase() !== 'completed') {
              if (hoursSince > 48) {
                  risk_status = 'Breached';
                  is_sla_breached = true;
              } else if (hoursSince > 24) {
                  risk_status = 'High Risk';
              }
          }
          
          return {
              ...ticket,
              risk_status: risk_status,
              is_sla_breached: is_sla_breached
          };
      });

      // Filter tickets if logged in as a field worker
      if (activeEmail) {
          const { data: workerCheck } = await supabase.from('field_workers').select('id').eq('email', activeEmail.toLowerCase()).limit(1);
          if (workerCheck && workerCheck.length > 0) {
              finalTickets = finalTickets.filter(t => t.worker_id === workerCheck[0].id);
          }
      }
      
      setReports(finalTickets);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanchayatData();
  }, []);

  const stats = useMemo(() => {
    const activeHazards = reports.filter(r => r.status?.toLowerCase() !== 'resolved' && r.status?.toLowerCase() !== 'completed').length;
    const slaBreaches = reports.filter(r => {
        const createdDate = new Date(r.created_at).getTime();
        return (Date.now() - createdDate) > (48 * 60 * 60 * 1000) && r.status?.toLowerCase() !== 'resolved' && r.status?.toLowerCase() !== 'completed';
    }).length;
    return { activeHazards, slaBreaches };
  }, [reports]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50/50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-emerald-800 font-bold tracking-wide">Syncing Waste Management Grid...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      
      {/* Hamburger button moved to header */}

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-emerald-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-emerald-800">
          <h1 className="text-2xl font-bold tracking-wider text-emerald-400">GRIP</h1>
          <p className="text-xs text-emerald-200 mt-1">Waste Console</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-8 overflow-y-auto">
          <button onClick={() => { navigate('/gov/panchayat'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}>
            <Globe className="w-5 h-5 mr-3 text-emerald-400" /> {isFieldWorker ? 'My Tasks Map' : 'Dashboard Map'}
          </button>
          <button onClick={() => { navigate('/gov/panchayat/pending'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'pending' ? 'bg-slate-800' : 'hover:bg-slate-800 text-red-400'}`}>
            <AlertTriangle className="w-5 h-5 mr-3" /> Pending Cleanups
          </button>
          <button onClick={() => { navigate('/gov/panchayat/resolved'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'resolved' ? 'bg-slate-800' : 'hover:bg-slate-800 text-emerald-400'}`}>
            <CheckCircle className="w-5 h-5 mr-3" /> Completed
          </button>
          {!isFieldWorker && (
              <button onClick={() => { navigate('/gov/panchayat/workers'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'workers' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}>
                <Users className="w-5 h-5 mr-3 text-yellow-500" /> Field Workers
              </button>
          )}
        </nav>
          
          <div className="pt-4 mt-4 border-t border-emerald-800 p-4">
            <button onClick={() => {
                const savedUserEmail = localStorage.getItem('saved_user_email');
                const savedGovEmail = localStorage.getItem('saved_gov_email');
                localStorage.clear();
                if (savedUserEmail) localStorage.setItem('saved_user_email', savedUserEmail);
                if (savedGovEmail) localStorage.setItem('saved_gov_email', savedGovEmail);
                window.dispatchEvent(new Event('auth-change'));
                navigate('/');
            }} className="w-full flex items-center text-left px-4 py-3 rounded-lg transition hover:bg-emerald-800 text-red-400">
                <LogOut className="w-5 h-5 mr-3" /> Sign Out
            </button>
          </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 lg:p-10">
          {/* Top Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8">
            <div className="flex items-center gap-3 lg:gap-4">
                <button 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                    className="lg:hidden p-3 bg-emerald-600 border border-emerald-700 rounded-full shadow-lg hover:bg-emerald-700 transition-colors text-white"
                >
                    {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
                </button>
                <div className="flex-1">
                    <h1 className="text-lg sm:text-xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        {isFieldWorker ? `Welcome, ${currentWorkerName}` : 'Waste Management Console'}
                    </h1>
                    <p className="text-xs lg:text-base text-emerald-600 mt-1 font-bold">{deptName}</p>
                </div>
            </div>
            <div className="flex gap-3 mt-4 lg:mt-0">
              <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Secure Session
                </p>
                <div className="flex items-center mt-1">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse mr-2"></span>
                  <span className="text-sm font-medium text-slate-700">
                    {lastUpdated}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
              <Routes>
                  <Route path="/" element={isFieldWorker ? <PanchayatWorkerHome reports={reports} workerName={currentWorkerName} deptName={deptName} /> : <PanchayatHome reports={reports} stats={stats} deptName={deptName} />} />
                  <Route path="/pending" element={<PanchayatPending myAssignedTickets={reports} onRefresh={fetchPanchayatData} />} />
                  <Route path="/resolved" element={<PanchayatResolved myAssignedTickets={reports} />} />
                  <Route path="/workers" element={<PanchayatWorkers deptName={deptName} />} />
              </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}
