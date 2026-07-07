"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  status: string;
  color?: string; 
  title?: string;
  description?: string;
  issue_type?: string;
  village_name?: string;
  ai_predictions?: string | Array<{ confidence: number }> | null;
  is_my_territory?: boolean; // <-- Added this to catch the API flag!
}

const getCustomIcon = (hexColor?: string) => {
  const bgColor = hexColor || "#3b82f6"; // Defaults to blue

  return L.divIcon({
    className: "", 
    html: `
      <div style="
        width: 20px; 
        height: 20px; 
        background-color: ${bgColor}; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        cursor: pointer;
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10], 
  });
};

const getConfidenceScore = (predictions: string | Array<{ confidence: number }> | null) => {
  try {
    const parsed = typeof predictions === "string" ? JSON.parse(predictions) : predictions;
    if (parsed && parsed.length > 0) return (parsed[0].confidence * 100).toFixed(1);
  } catch {
    return "N/A";
  }
  return "N/A";
};

export default function Map({ markers = [] }: { markers: MapMarker[] }) {
  const goaCenter: [number, number] = [15.2993, 74.1240];

  const goaBounds = L.latLngBounds(
    [14.50, 73.00], 
    [16.00, 75.00]  
  );

  return (
    <div className="h-full min-h-[500px] w-full bg-slate-100 z-0 relative rounded-xl overflow-hidden">
      <MapContainer
        center={goaCenter}
        zoom={10}
        minZoom={8}
        maxBounds={goaBounds}
        maxBoundsViscosity={0.8} 
        style={{ height: "100%", width: "100%", zIndex: 10 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />

        {markers.map((marker, index) => {
          if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number' || isNaN(marker.lat)) {
            return null; 
          }

          const isFallback = marker.lat === 15.2993 && marker.lng === 74.1240;
          const displayLat = isFallback ? marker.lat + (Math.random() - 0.5) * 0.0001 : marker.lat;
          const displayLng = isFallback ? marker.lng + (Math.random() - 0.5) * 0.0001 : marker.lng;

          const safeStatus = (marker.status || "pending").toLowerCase();

          // THE MAGIC COLOR FIX: Red for mine, Blue for others. 
          // (It also respects marker.color if you pass it manually elsewhere in your app)
          let dotColor = marker.color;
          if (!dotColor) {
             dotColor = marker.is_my_territory ? "#ef4444" : "#3b82f6"; // Tailwind red-500 & blue-500
          }

          return (
            <Marker
              key={`marker-${marker.id}-${index}`}
              position={[displayLat, displayLng]}
              icon={getCustomIcon(dotColor)} 
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 px-2 py-0.5 rounded-full inline-block ${safeStatus === "dispatched" ? "bg-blue-100 text-blue-700" : safeStatus === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {safeStatus}
                  </span>
                  
                  <h3 className="font-bold text-slate-800 text-base mb-1">
                    {marker.title || marker.issue_type || "Reported Issue"}
                  </h3>
                  
                  <div className="text-sm text-slate-600 space-y-1 mt-2 pt-2 border-t border-slate-100">
                    <p>
                      <strong>Area:</strong> {marker.description || marker.village_name || "Fallback Location"}
                    </p>

                    {/* Quick indicator inside the popup so the user knows if it's their job to fix it */}
                    <p>
                      <strong>Jurisdiction:</strong> {marker.is_my_territory ? <span className="text-red-600 font-bold">My Panchayat</span> : "Other Panchayat"}
                    </p>

                    {marker.ai_predictions && getConfidenceScore(marker.ai_predictions) !== "N/A" && (
                      <p>
                        <strong>AI Confidence:</strong> {getConfidenceScore(marker.ai_predictions)}%
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}