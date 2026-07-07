import '../globals.css';
import PwdSidebar from './PwdSidebar';
import Link from 'next/link';

export const metadata = {
  title: 'GRIP Command Center',
  description: 'Goa Realtime Infrastructure Protection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex h-screen bg-gray-50 text-slate-800">
        
        <PwdSidebar />

        {/* Main Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </>
  );
}