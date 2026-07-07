"use client";

import dynamic from 'next/dynamic';

// Dynamically import the map to prevent "Window is not defined" SSR errors
const MapWithoutSSR = dynamic(() => import('@/components/VibrationMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full flex items-center justify-center bg-zinc-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
    </div>
  ),
});

export default function VibrationsPage() {
  return (
    <main className="h-screen w-full overflow-hidden">
      <MapWithoutSSR />
    </main>
  );
}