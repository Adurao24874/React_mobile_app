'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase'; 

interface ResolveButtonProps {
    reportId: string;
    onSuccess?: () => void; 
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
                    const fileExt = photoFile.name.split('.').pop();
                    const fileName = `resolutions/resolved_${reportId}_${Date.now()}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('reports') 
                        .upload(fileName, photoFile, { contentType: photoFile.type });

                    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

                    const { data: { publicUrl } } = supabase.storage
                        .from('reports')
                        .getPublicUrl(fileName);

                    // THE FIX: We use parseInt() to strip away the String and send a pure Integer to Postgres!
                    const { data, error: rpcError } = await supabase.rpc('resolve_report_with_geofence', {
                        p_report_id: parseInt(reportId), 
                        p_worker_lat: workerLat,
                        p_worker_lng: workerLng,
                        p_photo_url: publicUrl,
                        p_max_distance_meters: 30 
                    });

                    if (rpcError) throw new Error(`Database error: ${rpcError.message}`);

                    if (data.success) {
                        alert(`✅ Ticket Resolved! Location verified (Distance: ${data.distance_meters} meters).`);
                        if (onSuccess) onSuccess(); 
                    } else {
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
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } 
        );
    };

    return (
        <div className="p-4 border border-indigo-100 rounded-xl bg-indigo-50/30 flex flex-col gap-4 mt-4">
            <h3 className="font-bold text-slate-800">Resolve this Ticket</h3>
            
            <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
            />
            
            <button 
                onClick={handleResolve} 
                disabled={isResolving || !photoFile}
                className={`py-3 px-4 rounded-lg text-white font-bold transition-all shadow-sm ${
                    isResolving || !photoFile 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-md transform hover:-translate-y-0.5'
                }`}
            >
                {isResolving ? 'Verifying Location & Uploading...' : 'Mark as Resolved'}
            </button>
            <p className="text-xs text-slate-500 font-medium">
                * Note: Your GPS location will be verified against the report location. You must be physically on-site within 30 meters.
            </p>
        </div>
    );
}