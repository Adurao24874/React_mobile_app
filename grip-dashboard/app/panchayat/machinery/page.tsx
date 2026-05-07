"use client";

import { useState } from 'react';

// EMPANELLED CONTRACTOR DATABASE (Mock data for MVP)
const EMPANELLED_CONTRACTORS = [
  {
    id: "cont_01",
    name: "Naik Earthmovers",
    owner: "Ramesh Naik",
    phone: "+91 98765 43210",
    machinery: ["JCB 3DX Backhoe", "2x 10-Ton Tippers"],
    default_rate: 3500, // per trip
    status: "Available",
    gwmc_registered: true
  },
  {
    id: "cont_02",
    name: "Dessai Logistics & Clearing",
    owner: "Sandeep Dessai",
    phone: "+91 99887 76655",
    machinery: ["Bobcat Skid Steer", "1x Tata Ace Mini-Truck"],
    default_rate: 1500,
    status: "Available",
    gwmc_registered: true
  },
  {
    id: "cont_03",
    name: "State GWMC Emergency Transport",
    owner: "Govt. of Goa",
    phone: "1800-GWMC-GOA",
    machinery: ["20-Ton Compactor Truck", "Heavy Excavator"],
    default_rate: 0, // Subsidized
    status: "Busy",
    gwmc_registered: true
  },
  {
    id: "cont_04",
    name: "Fernandes Local Transit",
    owner: "Antonio Fernandes",
    phone: "+91 97654 32109",
    machinery: ["1x Mahindra Bolero Pickup"],
    default_rate: 800,
    status: "Available",
    gwmc_registered: false // Cannot be hired for official dumps!
  }
];

export default function MachineryRegistryPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Simple search filter for finding specific machines or contractors
  const filteredContractors = EMPANELLED_CONTRACTORS.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.machinery.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Machinery & Contractors</h1>
          <p className="text-slate-500 mt-1 font-medium">Empanelled fleet registry for solid waste and C&D clearing operations.</p>
        </div>
        <div className="w-full md:w-72">
          <input 
            type="text" 
            placeholder="Search contractor or machine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Contractor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredContractors.map((contractor) => {
          const isBusy = contractor.status === 'Busy';

          return (
            <div key={contractor.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
              
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">{contractor.name}</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Proprietor: {contractor.owner}</p>
                </div>
                <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md border ${
                  isBusy ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {contractor.status}
                </span>
              </div>

              {/* Card Body: Details */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center text-sm">
                  <span className="w-24 text-slate-500 font-semibold">Contact:</span>
                  <span className="font-mono text-slate-700 font-bold">{contractor.phone}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="w-24 text-slate-500 font-semibold">Trip Rate:</span>
                  <span className="text-slate-800 font-bold">
                    {contractor.default_rate === 0 ? 'State Subsidized' : `₹${contractor.default_rate}`}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="w-24 text-slate-500 font-semibold">GWMC Reg:</span>
                  <span className={contractor.gwmc_registered ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {contractor.gwmc_registered ? 'Verified ✓' : 'Pending ⚠️'}
                  </span>
                </div>

                {/* Fleet Inventory Tags */}
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Registered Fleet Inventory</p>
                  <div className="flex flex-wrap gap-2">
                    {contractor.machinery.map((machine, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200">
                        🚜 {machine}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button 
                  disabled={isBusy || !contractor.gwmc_registered}
                  className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBusy 
                    ? 'Fleet Currently Deployed' 
                    : !contractor.gwmc_registered 
                      ? 'Cannot Dispatch (No GWMC)' 
                      : 'Draft Work Order'}
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}