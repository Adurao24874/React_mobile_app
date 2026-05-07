import Link from "next/link";

export const metadata = {
  title: "GRIP | Waste Management",
};

export default function PanchayatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-green-50/30">
      {/* Panchayat Sidebar (Green Theme) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold tracking-wider text-emerald-500">
            GRIP : SWM
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Village Panchayat Console
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/panchayat"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            📊 KPI Dashboard
          </Link>
          <Link
            href="/panchayat/pending"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-amber-400"
          >
            ⚠️ Active Hazards
          </Link>
          <Link
            href="/panchayat/resolved"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-emerald-400"
          >
            🧾 Disposal Receipts
          </Link>
          <Link
            href="/panchayat/machinery"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            🚜 Heavy Machinery
          </Link>
          <Link
            href="/panchayat/mrf"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            🏭 Material Recovery Facility
          </Link>
          <Link
            href="/panchayat/resolved"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            ☑️ Resolved
          </Link>
          <Link
            href="/panchayat/pending"
            className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition"
          >
            ⚠️ Pending Action
          </Link>
        </nav>
      </aside>

      {/* Panchayat Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
