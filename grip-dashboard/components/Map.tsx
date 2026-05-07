"use client";

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 1. Updated interface to perfectly match your Supabase 'reports' API
export interface MapMarker {
  id: string; // Updated to UUID string
  lat: number;
  lng: number;
  status: string;
  issue_type: string; // Changed from issue_name
  village_name?: string; 
  ai_predictions: string | Array<{ confidence: number }> | null; // Changed from ml_confidence_score
}

// 2. Bulletproofed function! Added a fallback so it NEVER crashes on undefined
const getIssueIcon = (category?: string) => {
  let bgColor = 'bg-blue-500'; // Default Blue
  const catLower = (category || 'unknown').toLowerCase(); // The safe fallback!

  // Color logic: Red for potholes, Yellow for garbage, Purple for lights
  if (catLower.includes('pothole') || catLower.includes('subsidence') || catLower.includes('road')) bgColor = 'bg-rose-500';
  else if (catLower.includes('dumping') || catLower.includes('garbage')) bgColor = 'bg-amber-500';
  else if (catLower.includes('light')) bgColor = 'bg-purple-500';

  // We use L.divIcon to draw custom HTML dots instead of using image files
  return L.divIcon({
    className: 'custom-map-icon',
    html: `<div class="w-4 h-4 ${bgColor} rounded-full border-2 border-white shadow-md hover:scale-125 transition-transform"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// Helper to safely parse the AI predictions JSON from the database
const getConfidenceScore = (predictions: string | Array<{ confidence: number }> | null) => {
  try {
    const parsed = typeof predictions === 'string' ? JSON.parse(predictions) : predictions;
    if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(1);
  } catch {
    return "N/A";
  }
  return "N/A";
};

export default function Map({ markers = [] }: { markers: MapMarker[] }) {
  const goaCenter: [number, number] = [15.2993, 74.1240];

  // 3. Define the exact geographical box that contains Goa
  const goaBounds = L.latLngBounds(
    [14.85, 73.60], // Southwest Corner
    [15.85, 74.40]  // Northeast Corner
  );

  return (
    // Make sure the container has a set height and relative positioning
    <div className="h-[500px] w-full bg-slate-100 z-0 relative rounded-xl overflow-hidden">
      <MapContainer 
        center={goaCenter} 
        zoom={10} 
        minZoom={9} 
        maxBounds={goaBounds} // Locks the camera inside Goa
        maxBoundsViscosity={1.0} // Gives it a "bouncy" wall feel if they try to drag out
        style={{ height: '100%', width: '100%', zIndex: 10 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />

        {markers.map((marker) => (
          <Marker 
            key={marker.id} 
            position={[marker.lat, marker.lng]} 
            icon={getIssueIcon(marker.issue_type)} // Successfully mapped to issue_type!
          >
            {/* 4. The Detailed Popup */}
            <Popup>
              <div className="p-1 min-w-[200px]">
                <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${marker.status.toLowerCase() === 'dispatched' ? 'text-blue-500' : 'text-amber-500'}`}>
                  {marker.status}
                </span>
                <h3 className="font-bold text-slate-800 text-base mb-1">{marker.issue_type}</h3>
                <div className="text-sm text-slate-600 space-y-1 mt-2 pt-2 border-t border-slate-100">
                  <p><strong>Area:</strong> {marker.village_name || 'Processing Coordinates'}</p>
                  <p><strong>AI Confidence:</strong> {getConfidenceScore(marker.ai_predictions)}%</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}