"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PanchayatSidebar from "./PanchayatSidebar";

export default function PanchayatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // 1. THE DETECTIVE: Check which role we are currently viewing
  const isBDO = pathname.includes("/bdo");
  const isHealth = pathname.includes("/health");
  const isGWMC = pathname.includes("/gwmc");
  
  // 2. THE ROUTER: Set the base path dynamically based on the exact role
  let basePath = "/panchayat"; // Default (Panchayat Secretary)
  if (isBDO) basePath = "/panchayat/bdo";
  if (isHealth) basePath = "/panchayat/health";
  if (isGWMC) basePath = "/panchayat/gwmc";

  // 3. THEME LOGIC: Set background, text colors, and titles based on role
  const bgColor = isBDO ? 'bg-blue-50/30' 
                : isHealth ? 'bg-emerald-50/30' 
                : isGWMC ? 'bg-indigo-50/30' 
                : 'bg-green-50/30';
                
  const titleColor = isBDO ? 'text-blue-500' 
                   : isHealth ? 'text-emerald-500' 
                   : isGWMC ? 'text-indigo-500' 
                   : 'text-green-500';
                   
  const subtitle = isBDO ? "Taluka BDO Console" 
                 : isHealth ? "Health Officer Console" 
                 : isGWMC ? "District GWMC Console" 
                 : "Village Panchayat Console";

  return (
    <div className={`flex h-screen ${bgColor}`}>
      
      <PanchayatSidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}