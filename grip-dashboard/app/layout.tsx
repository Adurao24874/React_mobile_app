import './globals.css';

export const metadata = {
  title: 'GRIP | Government Access Portal',
  description: 'Goa Realtime Infrastructure Protection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 antialiased min-h-screen">
        {/* No sidebars here! Just render the page (Login, PWD, or Panchayat) */}
        {children}
      </body>
    </html>
  );
}