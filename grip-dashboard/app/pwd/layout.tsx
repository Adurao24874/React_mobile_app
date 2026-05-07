import '../globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'GRIP Command Center',
  description: 'Goa Realtime Infrastructure Protection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex h-screen bg-gray-50 text-slate-800">
        
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold tracking-wider text-blue-400">GRIP</h1>
            <p className="text-xs text-slate-400 mt-1">Command Center</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/pwd" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">🌍 Dashboard Map</Link>
            <Link href="/pwd/pending" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-red-400">⚠️ Pending Action</Link>
            <Link href="/pwd/resolved" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-green-400">✅ Resolved</Link>
            <Link href="/pwd/workers" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">👷 Field Workers</Link>
            <Link href="/pwd/departments" className="block px-4 py-3 rounded-lg hover:bg-slate-800 transition">🏢 Departments</Link>
          </nav>
        </aside>

        {/* Main Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </>
  );
}