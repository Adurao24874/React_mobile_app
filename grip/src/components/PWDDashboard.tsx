import { useEffect, useState } from "react";
import { fetchDashboardData } from "../services/dashboardService";

import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import { LogOut, Menu, X, Globe, AlertTriangle, CheckCircle, Users, Building2, Activity } from "lucide-react";
import PWDHome from "./pwd/PWDHome";
import PWDPending from "./pwd/PWDPending";
import PWDResolved from "./pwd/PWDResolved";
import PWDWorkers from "./pwd/PWDWorkers";
import PWDDepartments from "./pwd/PWDDepartments";
import PWDVibrations from "./pwd/PWDVibrations";
import PWDWorkerHome from "./pwd/PWDWorkerHome";

export default function PWDDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const currentTab = pathParts[pathParts.length - 1];
  const activeTab = currentTab === 'pwd' ? 'dashboard' : currentTab;

  useEffect(() => {
    async function loadData() {
      const email = localStorage.getItem("gov_email") || "";
      if (!email) {
        navigate("/");
        return;
      }
      
      const result = await fetchDashboardData(email);
      if (result && result.success) {
        setData(result);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        console.error("Data load failed:", result?.error);
        // Optional: navigate("/") if completely unauthorized
      }
      setLoading(false);
    }
    
    loadData();
  }, [navigate]);

  useEffect(() => {
    // JEs now have a Map home page, no forced redirect needed
  }, [data, location, navigate]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-semibold tracking-wide">
          Authenticating & Loading Secure Data...
        </p>
      </div>
    );
  }

  const { currentUser, departments } = data;
  const isJE = currentUser && currentUser.role === 'JE';
  
  let totalPending = 0;
  let totalResolved = 0;
  let allTickets: any[] = [];
  let mapMarkers: any[] = [];

  departments.forEach((dept: any) => {
    totalPending += dept.pending_reports || 0;
    totalResolved += dept.resolved_reports || 0;

    // Build the full ticket list (including resolved) for the list views
    const sourceTickets = dept.all_tickets || dept.tickets;
    sourceTickets.forEach((ticket: any) => {
      allTickets.push(ticket);
    });

    // Build the map markers using only the active tickets
    dept.tickets.forEach((ticket: any) => {
      const lat = parseFloat(ticket.latitude);
      const lng = parseFloat(ticket.longitude);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
        mapMarkers.push({
          id: ticket.id,
          lat: lat,
          lng: lng,
          status: ticket.status || "pending",
          issue_type: ticket.display_type || "Pothole",
          is_my_territory: ticket.is_my_territory,
          color: ticket.is_my_territory ? "#ef4444" : "#3b82f6", 
          title: ticket.display_type || "Pothole",
          description: ticket.assigned_department || "Location Unknown",
          ai_predictions: ticket.ai_predictions
        });
      }
    });
  });


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
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold tracking-wider text-blue-400">GRIP</h1>
          <p className="text-xs text-slate-400 mt-1">Command Center</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { navigate('/gov/pwd'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}>
            <Globe className="w-5 h-5 mr-3 text-blue-400" /> {isJE ? 'My Tasks Map' : 'Dashboard Map'}
          </button>
          <button onClick={() => { navigate('/gov/pwd/pending'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'pending' ? 'bg-slate-800' : 'hover:bg-slate-800 text-red-400'}`}>
            <AlertTriangle className="w-5 h-5 mr-3" /> Pending Action
          </button>
          <button onClick={() => { navigate('/gov/pwd/resolved'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'resolved' ? 'bg-slate-800' : 'hover:bg-slate-800 text-green-400'}`}>
            <CheckCircle className="w-5 h-5 mr-3" /> Resolved
          </button>
          {!isJE && (
            <>
              <button onClick={() => { navigate('/gov/pwd/workers'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'workers' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}>
                <Users className="w-5 h-5 mr-3 text-yellow-500" /> Field Workers
              </button>
              <button onClick={() => { navigate('/gov/pwd/departments'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'departments' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}>
                <Building2 className="w-5 h-5 mr-3 text-slate-400" /> Departments
              </button>
              <button onClick={() => { navigate('/gov/pwd/vibrations'); setMobileMenuOpen(false); }} className={`w-full flex items-center text-left px-4 py-3 rounded-lg transition ${activeTab === 'vibrations' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}>
                <Activity className="w-5 h-5 mr-3 text-rose-400" /> Vibrations
              </button>
            </>
          )}
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <button onClick={() => {
                const savedUserEmail = localStorage.getItem('saved_user_email');
                const savedGovEmail = localStorage.getItem('saved_gov_email');
                localStorage.clear();
                if (savedUserEmail) localStorage.setItem('saved_user_email', savedUserEmail);
                if (savedGovEmail) localStorage.setItem('saved_gov_email', savedGovEmail);
                window.dispatchEvent(new Event('auth-change'));
                navigate('/');
            }} className="w-full flex items-center text-left px-4 py-3 rounded-lg transition hover:bg-slate-800 text-red-400">
                <LogOut className="w-5 h-5 mr-3" /> Sign Out
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full bg-slate-50/50 p-4 lg:p-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                  className="lg:hidden p-3 bg-blue-600 border border-blue-700 rounded-full shadow-lg hover:bg-blue-700 transition-colors text-white"
              >
                  {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
              </button>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Welcome, {currentUser.name}
                </h1>
                <p className="text-slate-500 mt-1 font-medium">
                  Division:{" "}
                  <span className="text-blue-600 font-bold">
                    {currentUser.taluka || "Assigned Territory"}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 md:mt-0 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Secure Session
              </p>
              <div className="flex items-center mt-1">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse mr-2"></span>
                <span className="text-sm font-medium text-slate-700">
                  Level {currentUser.level} Access • {lastUpdated}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
              <Routes>
                  <Route path="/" element={isJE ? <PWDWorkerHome reports={allTickets.filter(t => t.is_my_territory)} workerName={currentUser.name} /> : <PWDHome data={{ allTickets, myAssignedTickets: allTickets.filter(t => t.is_my_territory === true), totalResolved, mapMarkers, currentUser }} />} />
                  <Route path="/pending" element={<PWDPending myAssignedTickets={allTickets.filter(t => t.is_my_territory && t.status?.toLowerCase() !== 'resolved')} currentUser={currentUser} />} />
                  <Route path="/resolved" element={<PWDResolved myAssignedTickets={allTickets.filter(t => t.is_my_territory)} currentUser={currentUser} />} />
                  <Route path="/workers" element={<PWDWorkers />} />
                  <Route path="/departments" element={<PWDDepartments departments={departments} currentUser={currentUser} />} />
                  <Route path="/vibrations" element={<PWDVibrations />} />
              </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}
