"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// Supabase client commented out for now
// import { createBrowserClient } from '@supabase/ssr';

export default function GlobalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Strict Auth disabled for Development mode. Please use the Quick Access buttons below.");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">GRIP</h1>
          <p className="text-slate-500 font-medium mt-1">Unified Government Access Portal</p>
        </div>

        {/* Dummy Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Official Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-800"
              placeholder="admin.mopa@grip.local"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-800"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-500 font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Secure Login
          </button>
        </form>

        {/* DEVELOPMENT BYPASS BUTTONS */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-4">
            Development Quick Access
          </p>
          <div className="space-y-3">
            <button 
              onClick={() => router.push('/pwd')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex justify-between items-center transition-all shadow-sm"
            >
              <span>🛣️ PWD Dashboard (Roads)</span>
              <span>→</span>
            </button>
            
            <button 
              onClick={() => router.push('/panchayat')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg flex justify-between items-center transition-all shadow-sm"
            >
              <span>🗑️ Panchayat Dashboard (Waste)</span>
              <span>→</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}