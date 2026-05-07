"use client";

import { useState } from 'react';

// MOCK DATA: Simulating the current inventory of the Village MRF Shed
const SHED_CAPACITY_KG = 5000; // The shed can hold 5 tonnes max

const INITIAL_INVENTORY = [
  { id: 1, type: "Baled Plastic", weight_kg: 1200, status: "Ready for Transport", is_baled: true },
  { id: 2, type: "Loose Cardboard", weight_kg: 450, status: "Requires Sorting", is_baled: false },
  { id: 3, type: "Glass Bottles", weight_kg: 800, status: "Ready for Transport", is_baled: false },
  { id: 4, type: "Mixed Rejects", weight_kg: 300, status: "Awaiting GWMC", is_baled: false },
];

export default function MRFShedDashboard() {
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [isDispatching, setIsDispatching] = useState(false);

  // Math to calculate how full the shed is
  const currentWeight = inventory.reduce((sum, item) => sum + item.weight_kg, 0);
  const capacityPercentage = Math.round((currentWeight / SHED_CAPACITY_KG) * 100);
  
  // Dynamic styling based on danger levels
  const isCritical = capacityPercentage >= 85;
  const progressColor = isCritical ? 'bg-rose-500' : capacityPercentage > 50 ? 'bg-amber-400' : 'bg-emerald-500';

  const handleClearShed = () => {
    setIsDispatching(true);
    setTimeout(() => {
      alert("Success! A 5-Ton truck has been requested from the BDO to clear the shed. Generating GWMC manifest...");
      setInventory([]); // Shed is emptied!
      setIsDispatching(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">MRF Shed Inventory</h1>
          <p className="text-slate-500 mt-1 font-medium">Torxem Village Panchayat Material Recovery Facility</p>
        </div>
        <button className="bg-white border-2 border-slate-200 text-slate-700 font-bold px-5 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
          ⚙️ Update Machinery Status
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Capacity Monitor */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Main Capacity Widget */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            {isCritical && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-pulse"></div>}
            
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Overall Shed Capacity</h2>
                <p className="text-sm text-slate-500">Maximum structural load: 5.0 Tonnes</p>
              </div>
              <div className="text-right">
                <span className={`text-4xl font-black tracking-tight ${isCritical ? 'text-rose-600' : 'text-slate-800'}`}>
                  {capacityPercentage}%
                </span>
                <span className="text-sm font-bold text-slate-400 block uppercase tracking-wider">Filled</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-6 mb-2 overflow-hidden border border-slate-200 shadow-inner">
              <div 
                className={`h-6 rounded-full transition-all duration-1000 ${progressColor}`} 
                style={{ width: `${capacityPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>0 Tonnes</span>
              <span>{(currentWeight / 1000).toFixed(2)} / 5.0 T</span>
            </div>

            {/* Critical Warning Banner */}
            {isCritical && (
              <div className="mt-6 bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-rose-800 font-bold text-sm">Critical Capacity Reached</h4>
                  <p className="text-rose-600 text-xs mt-0.5 font-medium">The shed is nearing maximum capacity. Daily collection runs may be halted if the facility is not cleared within 48 hours.</p>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Inventory Breakdown */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1">
            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Categorized Inventory</h3>
            
            <div className="space-y-3">
              {inventory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-medium">Shed is currently completely empty.</div>
              ) : (
                inventory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.is_baled ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm">{item.type}</p>
                        <p className="text-xs text-slate-400 font-medium">{item.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-800">{item.weight_kg}</span>
                      <span className="text-xs font-bold text-slate-400 ml-1">KG</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Action Panel */}
        <div className="flex flex-col gap-6">
          
          {/* Dispatch Action Card */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white">
            <h3 className="font-bold text-lg mb-2">GWMC Transfer Protocol</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              When the shed exceeds 85% capacity, initiate a bulk transfer to the state waste management facility to prevent overflow.
            </p>
            
            <button 
              onClick={handleClearShed}
              disabled={capacityPercentage < 50 || isDispatching}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
            >
              {isDispatching ? 'Requesting Transport...' : 'Dispatch Fleet to Clear Shed'}
            </button>
            
            {capacityPercentage < 50 && (
              <p className="text-center text-xs font-bold text-slate-500 mt-3 uppercase tracking-wider">
                Insufficient load for transport
              </p>
            )}
          </div>

          {/* Machine Status Mini-Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">Hardware Status</h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Hydraulic Baler</span>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded">OPERATIONAL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Electronic Weighing Scale</span>
              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded">NEEDS REPAIR</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}