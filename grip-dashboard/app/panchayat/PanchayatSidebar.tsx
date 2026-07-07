"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function PanchayatSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  // 1. THE DETECTIVE: Check which role we are currently viewing
  const isBDO = pathname.includes("/bdo");
  const isHealth = pathname.includes("/health");
  const isGWMC = pathname.includes("/gwmc");
  
  // 2. THE ROUTER: Set the base path dynamically based on the exact role
  let basePath = "/panchayat"; // Default (Panchayat Secretary)
  if (isBDO) basePath = "/panchayat/bdo";
  if (isHealth) basePath = "/panchayat/health";
  if (isGWMC) basePath = "/panchayat/gwmc";

  // 3. THEME LOGIC: Set titles based on role
  const titleColor = isBDO ? 'text-blue-500' 
                   : isHealth ? 'text-emerald-500' 
                   : isGWMC ? 'text-indigo-500' 
                   : 'text-green-500';
                   
  const subtitle = isBDO ? "Taluka BDO Console" 
                 : isHealth ? "Health Officer Console" 
                 : isGWMC ? "District GWMC Console" 
                 : "Village Panchayat Console";

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800">
          <h1 className={`text-2xl font-bold tracking-wider ${titleColor}`}>
            GRIP : SWM
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* 4. DYNAMIC LINKS: Now basePath holds the correct URL for all 4 roles */}
          <Link
            href={`${basePath}`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            📊 KPI Dashboard
          </Link>
          
          <Link
            href={`${basePath}/pending`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-amber-400"
          >
            ⚠️ Active Hazards
          </Link>
          
          <Link
            href={`${basePath}/resolved`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-emerald-400"
          >
            🧾 Audit & Receipts
          </Link>
          
          <Link
            href={`${basePath}/machinery`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            🚜 Heavy Machinery
          </Link>
          
          <Link
            href={`${basePath}/mrf`}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            🏭 Recovery Facility
          </Link>
        </nav>
      </aside>
    </>
  );
}
