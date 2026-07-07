"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
// @ts-ignore - Bypassing type checks for speed
import "leaflet.vectorgrid";
import { ArrowLeft, Layers } from "lucide-react";
// @ts-ignore
import "leaflet/dist/leaflet.css";

const getConditionColor = (condition: string) => {
  switch (condition?.toLowerCase()) {
    case "pothole": return "#dc2626"; 
    case "bad": return "#ef4444"; 
    case "minor": return "#f59e0b"; 
    case "obstacle": 
    case "rumble": return "#a855f7"; 
    case "hump": return "#3b82f6"; 
    case "good": return "#22c55e"; 
    default: return "#fbbf24"; 
  }
};

// Our custom hook that connects the binary API to the React map
function VectorTileLayer({ showSensors }: { showSensors: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!showSensors) return;

    // Point Leaflet to our new Next.js Vector Tile Server
    // @ts-ignore
    const vectorGrid = L.vectorGrid.protobuf("/api/tiles/{z}/{x}/{y}", {
      vectorTileLayerStyles: {
        // 'vibrations' matches the name we gave it in the ST_AsMVT SQL query
        vibrations: (properties: any) => ({
          weight: 0,
          fillColor: getConditionColor(properties.label),
          fillOpacity: 1,
          fill: true,
          radius: 3, // Tiny dots for millions of points
        }),
      },
      interactive: true,
      getFeatureId: (f: any) => f.properties.segment_id,
    });

    // Make the points clickable!
    vectorGrid.on('click', (e: any) => {
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`
          <div class="font-bold text-slate-800 uppercase text-xs">${e.layer.properties.label}</div>
          <div class="text-[10px] text-slate-500 mt-1">ID: ${e.layer.properties.segment_id}</div>
        `)
        .openOn(map);
    });

    vectorGrid.addTo(map);

    return () => {
      map.removeLayer(vectorGrid); // Cleanup when closing the map
    };
  }, [map, showSensors]);

  return null;
}

export default function VibrationMap() {
  const router = useRouter();
  const [showSensors, setShowSensors] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-zinc-900 relative">
      <div className="absolute top-0 w-full z-[1000] bg-gradient-to-b from-black/80 to-transparent p-4 pt-8 text-white flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button onClick={() => router.back()} className="p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors shadow-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vibration Heatmap</h1>
            <p className="text-white/80 font-medium text-sm">PostGIS Vector Tile Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setShowFilters(!showFilters)} className="p-3 bg-white/20 backdrop-blur-md rounded-full shadow-lg border border-white/20 hover:bg-white/30">
            <Layers className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 z-0 relative">
        <MapContainer center={[15.4909, 73.8278]} zoom={11} className="w-full h-full" zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          
          {/* Render the infinite-scale vector layer */}
          <VectorTileLayer showSensors={showSensors} />
        </MapContainer>

        {showFilters && (
          <div className="absolute top-24 right-4 z-[1000] bg-white p-4 rounded-2xl shadow-xl w-48 pointer-events-auto">
            <h3 className="font-bold text-sm uppercase tracking-wider border-b pb-2 mb-3 text-slate-800">Layers</h3>
            <label className="flex items-center justify-between cursor-pointer text-slate-700 font-medium">
              <span className="text-sm">Sensor Data</span>
              <input type="checkbox" checked={showSensors} onChange={() => setShowSensors(!showSensors)} className="accent-emerald-500" />
            </label>
          </div>
        )}

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white px-5 py-3 rounded-full shadow-xl flex gap-4 text-[10px] font-bold text-gray-700 pointer-events-auto">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#dc2626" }}></div> Pothole</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }}></div> Bad</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#a855f7" }}></div> Obstacle/Rumble</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }}></div> Minor</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }}></div> Good</div>
        </div>
      </div>
    </div>
  );
}