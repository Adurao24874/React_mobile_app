"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function PwdSidebar() {
  const [isOpen, setIsOpen] = useState(false);

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
          <h1 className="text-2xl font-bold tracking-wider text-blue-400">GRIP</h1>
          <p className="text-xs text-slate-400 mt-1">Command Center</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/pwd" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">🌍 Dashboard Map</Link>
          <Link href="/pwd/pending" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-red-400">⚠️ Pending Action</Link>
          <Link href="/pwd/resolved" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-green-400">✅ Resolved</Link>
          <Link href="/pwd/workers" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">👷 Field Workers</Link>
          <Link href="/pwd/departments" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">🏢 Departments</Link>
          <Link href="/pwd/vibrations" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">🫨 Vibrations</Link>
        </nav>
      </aside>
    </>
  );
}
