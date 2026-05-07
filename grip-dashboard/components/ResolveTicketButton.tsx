'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Adjust this path if your supabase client is elsewhere

interface ResolveButtonProps {
    reportId: string;
    onSuccess?: () => void; // Optional callback to refresh the page/map after success
}

export default function ResolveTicketButton({ reportId, onSuccess }: ResolveButtonProps) {
    const [isResolving, setIsResolving] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    const handleResolve = async () => {
        if (!photoFile) {
            alert("❌ Please upload a photo of the resolved issue first.");
            return;
        }

        setIsResolving(true);

        // 1. Force a high-accuracy GPS lock from the worker's device
        if (!navigator.geolocation) {
            alert("❌ Geolocation is not supported by your browser.");
            setIsResolving(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const workerLat = position.coords.latitude;
                const workerLng = position.coords.longitude;

                try {
                    // 2. Upload the Resolution Photo to Supabase Storage
                    const fileExt = photoFile.name.split('.').pop();
                    const fileName = `resolutions/resolved_${reportId}_${Date.now()}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('reports') // Assuming you are using the same bucket
                        .upload(fileName, photoFile, { contentType: photoFile.type });

                    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

                    // Get the public URL for the newly uploaded photo
                    const { data: { publicUrl } } = supabase.storage
                        .from('reports')
                        .getPublicUrl(fileName);

                    // 3. Call our custom Haversine Geofence RPC in the Database
                    const { data, error: rpcError } = await supabase.rpc('resolve_report_with_geofence', {
                        p_report_id: reportId,
                        p_worker_lat: workerLat,
                        p_worker_lng: workerLng,
                        p_photo_url: publicUrl,
                        p_max_distance_meters: 30 // Strict 30-meter radius
                    });

                    if (rpcError) throw new Error(`Database error: ${rpcError.message}`);

                    // 4. Handle the Database's Verdict
                    if (data.success) {
                        alert(`✅ Ticket Resolved! Location verified (Distance: ${data.distance_meters} meters).`);
                        if (onSuccess) onSuccess(); // Refresh the UI
                    } else {
                        // The database rejected it (e.g., worker is 500 meters away)
                        alert(`🛑 ${data.error}`);
                    }

                } catch (error: unknown) {
                    console.error("Resolution workflow failed:", error);
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    alert(`❌ Error: ${message}`);
                } finally {
                    setIsResolving(false);
                }
            },
            (geoError) => {
                console.error("GPS Error:", geoError);
                alert("❌ Failed to get your exact location. Please ensure location services are turned on and try again.");
                setIsResolving(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Force fresh, precise GPS data
        );
    };

    return (
        <div className="p-4 border rounded-lg bg-gray-50 flex flex-col gap-4 mt-4">
            <h3 className="font-semibold text-gray-800">Resolve this Ticket</h3>
            
            <input 
                type="file" 
                accept="image/*" 
                capture="environment" // Suggests opening the mobile camera directly
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            
            <button 
                onClick={handleResolve} 
                disabled={isResolving || !photoFile}
                className={`py-2 px-4 rounded-md text-white font-bold transition-all ${
                    isResolving || !photoFile 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 shadow-md'
                }`}
            >
                {isResolving ? 'Verifying Location & Uploading...' : 'Mark as Resolved'}
            </button>
            <p className="text-xs text-gray-500">
                * Note: Your GPS location will be verified against the report location. You must be physically on-site.
            </p>
        </div>
    );
}