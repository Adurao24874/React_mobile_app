"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function GlobalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const router = useRouter();

  // Initialize the secure browser client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    
    const safeEmail = email.trim().toLowerCase(); // Ensure lowercase for matching

    try {
      // 1. Authenticate the user with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: safeEmail,
        password: password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("No user returned from Supabase.");

      // SMART TRAFFIC CONTROLLER: Where does this user belong?
      
      // 2. Check if they are a Field Worker
      // FIX: Removed '!inner' so the query doesn't fail if the department_id is slightly mismatched
      let { data: worker } = await supabase
        .from('field_workers')
        .select('specialty, departments(department_type)')
        .eq('auth_user_id', data.user.id)
        .single();

      if (!worker && data.user.email) {
        const { data: emailWorker } = await supabase
          .from('field_workers')
          .select('specialty, departments(department_type)')
          .ilike('email', safeEmail)
          .single();
        worker = emailWorker;
      }

      if (worker) {
        const deptType = worker.departments?.department_type;

        // --- NEW LOGIC: Route GWMC based on email or specialty ---
        if (safeEmail.includes('gwmc') || worker.specialty === 'Waste Management') {
          router.push('/panchayat/gwmc');
        } 
        // ---------------------------------------------------------
        else if (deptType === 'VILLAGE_PANCHAYAT') {
          router.push('/panchayat');
        } else if (deptType === 'BLOCK_DEVELOPMENT_OFFICE') {
          router.push('/panchayat/bdo');
        } else if (deptType === 'HEALTH_OFFICE') {
          router.push('/panchayat/health');
        } else if (worker.specialty === 'Sanitation & Waste') {
          router.push('/panchayat'); // Fallback for standard sanitation workers
        } else {
          router.push('/pwd'); // Fallback for PWD workers
        }
        return; // Stop execution, routing successful
      }

      // 3. Fallback: Check if they are a legacy Department Admin (not in field_workers)
      const { data: depts } = await supabase
        .from('departments')
        .select('department_type')
        .ilike('contact_email', safeEmail)
        .limit(1);

      if (depts && depts.length > 0) {
        const dept = depts[0];
        // --- NEW LOGIC: Fallback GWMC routing ---
        if (safeEmail.includes('gwmc') || dept.department_type === 'GWMC') {
          router.push('/panchayat/gwmc');
        }
        else if (dept.department_type === 'VILLAGE_PANCHAYAT') {
          router.push('/panchayat');
        } else if (dept.department_type === 'BLOCK_DEVELOPMENT_OFFICE') {
          router.push('/panchayat/bdo'); // Fixed path
        } else if (dept.department_type === 'HEALTH_OFFICE') {
          router.push('/panchayat/health'); // Fixed path
        } else {
          router.push('/pwd');
        }
        return;
      }
      
      // If we reach here, they logged in but have no assigned role
      throw new Error("Account has no assigned dashboard role. Contact Admin.");

    } catch (error: any) {
      console.error("Login Error:", error);
      setErrorMsg(error.message || "Invalid login credentials.");
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">GRIP</h1>
          <p className="text-slate-500 font-medium mt-1">Unified Government Access Portal</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-sm font-bold rounded-lg text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Official Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="worker@grip-goa.online"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Secure Login"
            )}
          </button>
        </form>

      </div>
    </div>
  );
}