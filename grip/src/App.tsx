import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Camera, MapPin, Activity, History, ArrowRight, ArrowLeft, CheckCircle2, Layers, RefreshCw } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { StorageService } from './services/storage';
import { SyncEngine } from './services/sync';
import { Network } from '@capacitor/network';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { KeepAwake } from '@capacitor-community/keep-awake';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

interface GripSensorPlugin {
    startRecording(): Promise<{ status: string }>;
    stopRecording(): Promise<{ status: string }>;
    getReadings(): Promise<{ readings: any[] }>;
    checkPermissions(): Promise<{ sensors: string; activity: string }>;
    requestPermissions(): Promise<{ sensors: string; activity: string }>;
    getPromptStates(): Promise<{ permissionPrompted: boolean; batteryPrompted: boolean }>;
    markPermissionPrompted(): Promise<void>;
    markBatteryPrompted(): Promise<void>;
    isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
    requestBatteryOptimizationBypass(): Promise<void>;
}
const GripSensor = registerPlugin<GripSensorPlugin>('GripSensor');

const blueDotIcon = new L.Icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const GOA_BOUNDS = {
    minLat: 14.8,
    maxLat: 15.9,
    minLng: 73.6,
    maxLng: 74.35
};

const isInGoa = (lat: number, lng: number) => (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= GOA_BOUNDS.minLat &&
    lat <= GOA_BOUNDS.maxLat &&
    lng >= GOA_BOUNDS.minLng &&
    lng <= GOA_BOUNDS.maxLng
);

function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-teal-500 to-blue-600">
            <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 text-center">
                <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-6">
                    <span className="text-4xl text-red-500"><img src="https://img.icons8.com/?size=100&id=102551&format=png&color=000000" alt="Shield" className="w-12 h-12" /></span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">GRIP</h1>
                <p className="text-white/80 mb-12 whitespace-pre-line text-lg">
                    Goa Real-time
                    Infrastructure Protection
                </p>
                <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-white text-teal-600 font-bold rounded-full text-lg shadow-lg hover:bg-gray-50 transition-colors"
                >
                    <span className="w-4 h-4 rounded-full bg-teal-500 mr-2 inline-block animate-pulse"></span>
                    Get Started
                </Link>
                <div className="mt-8 text-white/70 text-sm">
                    <p>Protecting Goa's Infrastructure in Real Time</p>
                    <p className="mt-2 text-xs">🛣️ Roads • 🌴 Trees • 🌊 Coastline</p>
                </div>
            </div>
        </div>
    );
}

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                alert('Account created! Depending on server settings you may need to check your email to confirm, otherwise you can now Log in.');
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                navigate('/dashboard');
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-zinc-900 relative">
            <div className="w-full max-w-md p-8 bg-white dark:bg-zinc-800 rounded-3xl shadow-xl z-10">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg mb-6 shadow-blue-500/30">
                    <span className="text-2xl"><img src="https://img.icons8.com/?size=100&id=102551&format=png&color=000000" alt="Shield" className="w-8 h-8" /></span>
                </div>
                <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">
                    {isSignUp ? 'Create Account' : 'Welcome to GRIP'}
                </h2>
                <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
                    {isSignUp ? 'Sign up to protect infrastructure' : 'Sign in to continue'}
                </p>

                {errorMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-200 text-red-700 text-sm font-medium">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-700 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-600 outline-none transition-all dark:text-white font-medium"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-700 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-600 outline-none transition-all dark:text-white font-medium"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="block w-full mt-8 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white text-center font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login')}
                    </button>

                    <div className="text-center pt-4">
                        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline">
                            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                        </button>
                    </div>

                    <div className="text-center pt-2 text-xs text-gray-500">
                        GRIP — Goa Real-time Infrastructure Protection
                    </div>
                </form>
            </div>
        </div>
    )
}

function WelcomeGuidance({ onComplete }: { onComplete: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] bg-zinc-900/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-[40px] shadow-2xl p-8 border border-white/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>

                <div className="mb-8 text-center">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Setup Guard</h2>
                    <p className="text-gray-500 dark:text-gray-400">Critical steps for continuous sensing</p>
                </div>

                <div className="space-y-6 mb-10">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Location Access</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Ensure Location is set to <span className="text-green-600 font-bold">"Allow all the time"</span>. This prevents recording from cutting out when you lock the phone.</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Battery Optimization</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Set GRIP to <span className="text-blue-600 font-bold">"Unrestricted"</span> in battery settings. This keeps our sensors active at 70Hz even during long runs.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails })}
                        className="py-4 bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors text-sm"
                    >
                        Open Settings
                    </button>
                    <button
                        onClick={onComplete}
                        className="py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 hover:opacity-90 transition-opacity text-sm"
                    >
                        I've Done This
                    </button>
                </div>
            </div>
        </div>
    );
}

function Dashboard() {
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(true);
    const [pendingSyncs, setPendingSyncs] = useState(0);
    const [showGuidance, setShowGuidance] = useState(false);

    useEffect(() => {
        SyncEngine.start();
        const updateStatus = async () => {
            const status = await Network.getStatus();
            setIsOnline(status.connected);
            const pendingIssues = await StorageService.getPendingIssues();
            const pendingBatches = await StorageService.getPendingSensorBatches();
            setPendingSyncs(pendingIssues.length + pendingBatches.length);
        };
        updateStatus();
        if (Capacitor.getPlatform() === 'android') {
            GripSensor.getPromptStates().then(async states => {
                if (!states.permissionPrompted) {
                    const status = await GripSensor.checkPermissions();
                    if (status.sensors !== 'granted' || status.activity !== 'granted') {
                        await GripSensor.requestPermissions();
                    }
                    await GripSensor.markPermissionPrompted();
                }
                if (!states.batteryPrompted) {
                    setShowGuidance(true);
                }
            });
        }
        const interval = setInterval(updateStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const completeGuidance = async () => {
        setShowGuidance(false);
        if (Capacitor.getPlatform() === 'android') {
            await GripSensor.markBatteryPrompted();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 pb-20">
            {showGuidance && <WelcomeGuidance onComplete={completeGuidance} />}
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 pt-12 pb-8 rounded-b-[40px] shadow-lg text-white mb-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <span className="text-2xl text-blue-500">👤</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">GRIP</h1>
                            <p className="text-white/80 font-medium">Citizen</p>
                        </div>
                    </div>
                    <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                        <ArrowRight className="w-6 h-6" />
                    </button>
                </div>
                <div className={`p-3 rounded-2xl flex items-center justify-between backdrop-blur-md shadow-inner ${isOnline && pendingSyncs === 0 ? 'bg-white/10 text-white' : (isOnline && pendingSyncs > 0 ? 'bg-yellow-500/20 text-yellow-50' : 'bg-red-500/20 text-red-50')}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        <span className="text-sm font-semibold">{isOnline ? 'System Online' : 'Offline Mode'}</span>
                    </div>
                    {pendingSyncs > 0 && <div className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">{pendingSyncs} pending sync</div>}
                </div>
            </div>
            <div className="px-6 space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Report infrastructure issues in your area</p>
                </div>
                <div className="space-y-4">
                    <button onClick={() => navigate('/report/garbage')} className="w-full bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center gap-4 hover:shadow-md transition-all text-left">
                        <div className="w-14 h-14 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0"><span className="text-2xl">🗑️</span></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Report Issue</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">Capture and report illegal garbage dump road crack and potholes</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-green-500" />
                    </button>
                    <button onClick={() => navigate('/report/pothole')} className="w-full bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center gap-4 hover:shadow-md transition-all text-left">
                        <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0"><Activity className="w-7 h-7" /></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Pothole Detection</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">Auto-detect road irregularities using sensors</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-blue-500" />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => navigate('/map')} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer">
                        <MapPin className="w-6 h-6 text-green-500" />
                        <span className="font-semibold text-gray-900 dark:text-white">View Map</span>
                    </button>
                    <button onClick={() => navigate('/history')} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                        <History className="w-6 h-6 text-blue-500" />
                        <span className="font-semibold text-gray-900 dark:text-white">History</span>
                    </button>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700 mt-8">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 text-lg">Quick Stats</h3>
                    <div className="flex justify-between text-center px-2">
                        <div><p className="text-3xl font-bold text-green-500 mb-1">12</p><p className="text-xs font-semibold text-gray-500">Reported</p></div>
                        <div className="w-px bg-gray-200 dark:bg-zinc-700"></div>
                        <div><p className="text-3xl font-bold text-blue-500 mb-1">5</p><p className="text-xs font-semibold text-gray-500">In Progress</p></div>
                        <div className="w-px bg-gray-200 dark:bg-zinc-700"></div>
                        <div><p className="text-3xl font-bold text-gray-800 dark:text-gray-300 mb-1">8</p><p className="text-xs font-semibold text-gray-500">Resolved</p></div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ReportGarbage() {
    const navigate = useNavigate();
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [loc, setLoc] = useState<{ lat: number, lng: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState('');

    const takePicture = async () => {
    try {
        const image = await CapCamera.getPhoto({ 
            quality: 60, 
            width: 1280, 
            height: 720, 
            allowEditing: false, 
            // 1. Change the result type to return raw Base64 data instead of a temporary URI
            resultType: CameraResultType.Base64, 
            source: CameraSource.Camera 
        });
        
        if (image.base64String) {
            // 2. Format it into a standard data URL so the SyncEngine can fetch() it easily
            const base64DataUrl = `data:image/jpeg;base64,${image.base64String}`;
            setImageUri(base64DataUrl);
            fetchLocation();
        }
    } catch (e) { 
        console.error("Camera error:", e); 
    }
};

    const fetchLocation = async () => {
        const isWeb = Capacitor.getPlatform() === 'web';
        if (isWeb) {
            if (!navigator.geolocation) { alert("Your browser does not support Geolocation."); return; }
            navigator.geolocation.getCurrentPosition((position) => {
                setLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
            }, (error) => { alert(`Laptop GPS Error: ${error.message}`); setLoc(null); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
        } else {
            try {
                const coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
                setLoc({ lat: coordinates.coords.latitude, lng: coordinates.coords.longitude });
            } catch (e) { console.warn("Mobile Location fetch failed:", e); setLoc(null); }
        }
    };

    const handleSave = async () => {
        if (!imageUri || !loc) return;
        setIsSaving(true);
        try {
            await StorageService.saveIssue({ imageUri, lat: loc.lat, lng: loc.lng, timestamp: Date.now(), type: 'auto' });
            setSavedMessage("Issue saved locally. It will automatically sync when online.");
            setTimeout(() => navigate('/dashboard'), 2500);
        } catch (e: any) {
            console.error("Storage error:", e);
            alert(e.message || "Failed to save issue locally.");
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 pt-12 pb-4 text-white flex items-center gap-4 shadow-md">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
                <h1 className="text-xl font-bold">Report Issue</h1>
            </div>
            <div className="p-6 space-y-6">
                {savedMessage && <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4"><CheckCircle2 className="w-5 h-5 flex-shrink-0" /><p className="text-sm font-medium">{savedMessage}</p></div>}
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700">
                    {imageUri ? (
                        <div className="w-full aspect-square bg-black rounded-2xl mb-6 overflow-hidden relative border border-gray-200 dark:border-zinc-700"><img src={imageUri} alt="Captured Garbage" className="w-full h-full object-cover" /><button onClick={takePicture} className="absolute bottom-4 right-4 bg-white text-gray-900 p-3 rounded-full shadow-lg hover:scale-105 transition-transform"><Camera className="w-5 h-5" /></button></div>
                    ) : (
                        <div className="w-full aspect-square bg-gray-100 dark:bg-zinc-700 rounded-2xl flex flex-col items-center justify-center text-gray-400 mb-6 border-2 border-dashed border-gray-200 dark:border-zinc-600"><Camera className="w-12 h-12 mb-2 opacity-50" /><p className="font-medium">No image captured</p></div>
                    )}
                    {!imageUri ? (
                        <button onClick={takePicture} className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"><Camera className="w-5 h-5" />Capture Image</button>
                    ) : (
                        <button onClick={handleSave} disabled={isSaving || !loc} className="w-full py-4 bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all">{isSaving ? "Saving Offline..." : "Save Report"}</button>
                    )}
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center flex-shrink-0"><MapPin className="w-5 h-5" /></div>
                        <div className="overflow-hidden"><p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Location</p>{loc ? <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p> : <p className="font-medium text-gray-400 text-sm">Waiting for image...</p>}</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${loc ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-300 dark:bg-zinc-600 animate-pulse'}`}></div>
                </div>
            </div>
        </div>
    )
}

function LiveMapUpdater({ position }: { position: { lat: number, lng: number } | null }) {
    const map = useMap();
    useEffect(() => { if (position) { map.flyTo([position.lat, position.lng], map.getZoom(), { animate: true, duration: 1.0 }); } }, [position, map]);
    return null;
}

function MapBoundsUpdater({ points }: { points: any[] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(
                points
                    .filter(p => isInGoa(Number(p.latitude), Number(p.longitude)))
                    .map(p => [Number(p.latitude), Number(p.longitude)])
            );
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
        }
    }, [points, map]);
    return null;
}

function PotholeDetection() {
    const navigate = useNavigate();
    const [isRecording, setIsRecording] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number, accuracy: number } | null>(null);
    const [sampleCount, setSampleCount] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'saving' | 'success' | 'failed'>('idle');
    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const [liveAccel, setLiveAccel] = useState({ x: 0, y: 0, z: 0 });
    const [liveGyro, setLiveGyro] = useState({ x: 0, y: 0, z: 0 });
    const batchRef = useRef<any[]>([]);
    const geoWatchId = useRef<string | null>(null);
    const saveIntervalRef = useRef<any>(null);
    const latestLocationRef = useRef<{ lat: number, lng: number, accuracy: number } | null>(null);

    useEffect(() => {
        const checkRecovery = async () => { if (await StorageService.recoverActiveSession()) { try { await SyncEngine.syncAll(); } catch (e) { } } };
        checkRecovery();
    }, []);

    const startMonitoring = async () => {
        try {
            setUploadStatus('idle');
            if (Capacitor.getPlatform() === 'android') {
                const fsPerms = await ForegroundService.checkPermissions();
                if (fsPerms.display !== 'granted') await ForegroundService.requestPermissions();

                await ForegroundService.startForegroundService({
                    id: 112233,
                    title: "GRIP Sensing Active",
                    body: "Protecting Goa's roads in background",
                    smallIcon: "res://drawable/ic_launcher_foreground"
                });

                await KeepAwake.keepAwake();

                const battery = await GripSensor.isBatteryOptimizationIgnored();
                if (!battery.isIgnored) {
                    const confirm = window.confirm("Samsung/Aggressive devices detected. To record while screen is OFF, you MUST set Battery to 'Unrestricted' in the next screen. Open Settings?");
                    if (confirm) {
                        await GripSensor.requestBatteryOptimizationBypass();
                        await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails });
                    }
                }
            }
            if (typeof (DeviceMotionEvent as any).requestPermission === 'function') await (DeviceMotionEvent as any).requestPermission();
            const watcherId = await BackgroundGeolocation.addWatcher({ backgroundMessage: "Tracking road quality", backgroundTitle: "GRIP Recording", requestPermissions: false, stale: false, distanceFilter: 0 }, (position) => {
                if (position) {
                    const loc = { lat: position.latitude, lng: position.longitude, accuracy: position.accuracy };
                    latestLocationRef.current = loc;
                    setCurrentLocation(loc);
                }
            });
            geoWatchId.current = watcherId;
            batchRef.current = [];
            setSampleCount(0);
            if (Capacitor.getPlatform() === 'android') await GripSensor.startRecording();
            setIsRecording(true);
            saveIntervalRef.current = setInterval(async () => {
                if (Capacitor.getPlatform() === 'android') {
                    const stats = await GripSensor.getReadings();
                    if (stats.readings && stats.readings.length > 0) {
                        const latest = stats.readings[stats.readings.length - 1];
                        setLiveAccel({ x: latest.accelX, y: latest.accelY, z: latest.accelZ });
                        setLiveGyro({ x: latest.gyroX, y: latest.gyroY, z: latest.gyroZ });

                        const latestLoc = latestLocationRef.current;
                        const canTagGps = !!latestLoc && latestLoc.accuracy <= 60 && isInGoa(latestLoc.lat, latestLoc.lng);
                        const normalizedReadings = stats.readings.map((r: any) => canTagGps ? { ...r, lat: latestLoc!.lat, lng: latestLoc!.lng } : r);

                        // CRITICAL: Accumulate readings so we don't lose them!
                        batchRef.current = [...batchRef.current, ...normalizedReadings];
                        setSampleCount(batchRef.current.length);

                        // Periodically backup to local storage for crash recovery
                        if (batchRef.current.length % 250 === 0) {
                            StorageService.saveActiveSession(batchRef.current);
                        }
                    }
                }
            }, 1000);
        } catch (e: any) { alert(`Error: ${e.message}`); setIsRecording(false); }
    };

    const stopMonitoring = async () => {
        setIsRecording(false);
        if (Capacitor.getPlatform() === 'android') {
            await ForegroundService.stopForegroundService();
            await KeepAwake.allowSleep();
        }
        if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null; }
        if (Capacitor.getPlatform() === 'android') {
            const result = await GripSensor.getReadings();
            await GripSensor.stopRecording();
            if (result.readings) {
                batchRef.current = [...batchRef.current, ...result.readings];
                setSampleCount(batchRef.current.length);
            }
        }
        if (geoWatchId.current) await BackgroundGeolocation.removeWatcher({ id: geoWatchId.current });
        setShowSavePrompt(true);
    };

    const saveSession = async () => {
        setShowSavePrompt(false); setUploadStatus('saving');
        await StorageService.saveSensorBatch({ readings: batchRef.current });
        await StorageService.clearActiveSession();
        try { await SyncEngine.syncAll(); setUploadStatus('success'); } catch (err) { setUploadStatus('failed'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 pt-12 pb-4 text-white flex items-center gap-4 shadow-md">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
                <h1 className="text-xl font-bold">Trip Telemetry</h1>
            </div>
            <div className="p-6 space-y-6">
                <div className="relative w-full h-72 rounded-3xl overflow-hidden shadow-sm bg-zinc-800 z-0">
                    <MapContainer center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [15.4909, 73.8278]} zoom={17} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]} icon={blueDotIcon} />}
                        <LiveMapUpdater position={currentLocation} />
                    </MapContainer>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Accelerometer</h3>
                        <div className="flex justify-between font-mono"><span className="text-blue-500">x: {liveAccel.x.toFixed(2)}</span><span className="text-green-500">y: {liveAccel.y.toFixed(2)}</span><span className="text-purple-500">z: {liveAccel.z.toFixed(2)}</span></div>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Gyroscope</h3>
                        <div className="flex justify-between font-mono"><span className="text-blue-500">x: {liveGyro.x.toFixed(2)}</span><span className="text-green-500">y: {liveGyro.y.toFixed(2)}</span><span className="text-purple-500">z: {liveGyro.z.toFixed(2)}</span></div>
                    </div>
                </div>
                {uploadStatus !== 'idle' && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${uploadStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {uploadStatus === 'saving' && <Activity className="animate-spin w-5 h-5" />}
                        {uploadStatus === 'success' && <CheckCircle2 className="w-5 h-5" />}
                        <p className="text-sm font-bold">{uploadStatus === 'saving' ? 'Syncing...' : (uploadStatus === 'success' ? 'Data Uploaded!' : 'Sync Failed')}</p>
                    </div>
                )}
                <div className="flex justify-between px-2 text-xs font-medium text-gray-500"><span>Samples</span><span className="font-mono">{sampleCount}</span></div>
                <button onClick={isRecording ? stopMonitoring : startMonitoring} className={`w-full py-5 text-white font-bold rounded-2xl ${isRecording ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-blue-600'}`}>
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
                {showSavePrompt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-xl text-center"><h3 className="text-xl font-bold">Session Ended</h3><p>Upload {sampleCount} samples?</p><div className="flex gap-3"><button onClick={() => setShowSavePrompt(false)} className="flex-1 py-3 bg-gray-100 rounded-xl">Discard</button><button onClick={saveSession} className="flex-1 py-3 bg-blue-600 text-white rounded-xl">Save</button></div></div></div>
                )}
            </div>
        </div>
    )
}

function LocateControl() {
    const map = useMap();
    const [locating, setLocating] = useState(false);
    const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number, accuracy: number } | null>(null);

    const handleLocate = async () => {
        setLocating(true);
        try {
            const perms = await Geolocation.checkPermissions();
            if (perms.location !== 'granted') {
                const req = await Geolocation.requestPermissions();
                if (req.location !== 'granted') {
                    alert("Location permission is required to find your position.");
                    return;
                }
            }

            const pos = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });

            const coords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy
            };

            setCurrentPos(coords);
            map.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.5 });
        } catch (e: any) {
            console.error("Locate failed:", e);
            alert(`Could not get location: ${e.message || 'Timeout'}`);
        } finally {
            setLocating(false);
        }
    };

    return (
        <>
            {currentPos && (
                <>
                    <Circle
                        center={[currentPos.lat, currentPos.lng]}
                        radius={currentPos.accuracy}
                        pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 1 }}
                    />
                    <Marker position={[currentPos.lat, currentPos.lng]} icon={blueDotIcon} />
                </>
            )}
            <div className="absolute bottom-10 right-4 z-[1001] pointer-events-auto">
                <button
                    onClick={handleLocate}
                    disabled={locating}
                    className={`w-14 h-14 rounded-full shadow-2xl border flex items-center justify-center transition-all ${locating ? 'bg-zinc-700 animate-pulse' : 'bg-white dark:bg-zinc-800 hover:scale-110 active:scale-95'
                        } ${currentPos ? 'border-blue-500 border-2' : 'border-white/10'}`}
                >
                    {locating ? (
                        <RefreshCw className="w-6 h-6 text-white animate-spin" />
                    ) : (
                        <MapPin className={`w-6 h-6 ${currentPos ? 'text-blue-500' : 'text-gray-900 dark:text-white'}`} />
                    )}
                </button>
            </div>
        </>
    );
}

function MapViewer() {
    const navigate = useNavigate();
    const [conditions, setConditions] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSensors, setShowSensors] = useState(true);
    const [showReports, setShowReports] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    const fetchMapLayer = async () => {
        setLoading(true);
        try {
            // Fetch Road Conditions with pagination to bypass the 1000 row limit
            let allConditions: any[] = [];
            let from = 0;
            const PAGE_SIZE = 1000;
            const MAX_POINTS = 50000;

            while (from < MAX_POINTS) {
                const { data, error } = await supabase
                    .from('road_conditions')
                    .select('*')
                    .gte('latitude', GOA_BOUNDS.minLat)
                    .lte('latitude', GOA_BOUNDS.maxLat)
                    .gte('longitude', GOA_BOUNDS.minLng)
                    .lte('longitude', GOA_BOUNDS.maxLng)
                    .order('timestamp', { ascending: false })
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;

                allConditions = [...allConditions, ...data];
                if (data.length < PAGE_SIZE) break;
                from += PAGE_SIZE;
            }
            setConditions(allConditions);

            // Fetch Reports (usually fewer reports, so single fetch is often okay, but let's be safe)
            const repRes = await supabase
                .from('reports')
                .select('*')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .gte('latitude', GOA_BOUNDS.minLat)
                .lte('latitude', GOA_BOUNDS.maxLat)
                .gte('longitude', GOA_BOUNDS.minLng)
                .lte('longitude', GOA_BOUNDS.maxLng)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            if (repRes.data) setReports(repRes.data);
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMapLayer(); }, []);

    return (
        <div className="h-screen flex flex-col bg-zinc-900 relative">
            <div className="absolute top-0 w-full z-50 bg-gradient-to-b from-black/80 to-transparent p-4 pt-12 text-white flex justify-between items-start pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <button onClick={() => navigate(-1)} className="p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors shadow-lg pointer-events-auto"><ArrowLeft className="w-6 h-6" /></button>
                    <div className="pointer-events-auto">
                        <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
                        <div className="flex items-center gap-2">
                            <p className="text-white/80 font-medium text-sm">Real-time Road Conditions</p>
                            <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm animate-pulse-slow">{conditions.length > 0 ? `${conditions.filter(p => isInGoa(Number(p.latitude), Number(p.longitude))).length} Points` : 'No Data'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    <button onClick={fetchMapLayer} className={`p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 ${loading ? 'opacity-50' : ''}`} disabled={loading}><RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} /></button>
                    <button onClick={() => setShowFilters(!showFilters)} className="p-3 bg-white/20 backdrop-blur-md rounded-full shadow-lg border border-white/20 hover:bg-white/30"><Layers className="w-6 h-6" /></button>
                </div>
            </div>
            {loading ? (<div className="flex-1 flex items-center justify-center bg-zinc-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div></div>) : (
                <div className="flex-1 z-0 relative">
                    <MapContainer center={[15.4909, 73.8278]} zoom={11} className="w-full h-full" zoomControl={false}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        {showSensors && conditions.filter(pt => isInGoa(Number(pt.latitude), Number(pt.longitude))).map((pt, i) => (
                            <CircleMarker key={`cond-${i}`} center={[pt.latitude, pt.longitude]} radius={pt.condition_label === 'POTHOLE' || pt.condition_label === 'BAD' ? 8 : 5} pathOptions={{ color: pt.color_hex, fillColor: pt.color_hex, fillOpacity: 0.8, weight: 2 }} >
                                <Popup><div className="p-1 min-w-[140px]"><div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: pt.color_hex }}></div><span className="font-bold text-xs uppercase">{pt.condition_label}</span></div><p className="text-xs">Vibration: {pt.vibration_intensity?.toFixed(2)}</p></div></Popup>
                            </CircleMarker>
                        ))}
                        {showReports && reports.filter(rep => isInGoa(Number(rep.latitude), Number(rep.longitude))).map((rep, i) => (
                            <CircleMarker key={`rep-${i}`} center={[rep.latitude, rep.longitude]} radius={9} pathOptions={{ color: '#ffffff', fillColor: rep.issue_type === 'Garbage' ? '#a855f7' : '#ef4444', fillOpacity: 1, weight: 2 }}>
                                <Popup><div className="max-w-[200px]">{rep.image_url && <img src={supabase.storage.from('reports').getPublicUrl(rep.image_url).data.publicUrl} alt="Report" className="w-full h-32 object-cover rounded mb-2" />}<p className="font-bold text-xs">{rep.issue_type}</p></div></Popup>
                            </CircleMarker>
                        ))}
                        <LocateControl />
                        <MapBoundsUpdater points={conditions.length > 0 ? conditions : reports} />
                    </MapContainer>
                    {showFilters && (
                        <div className="absolute top-24 right-4 z-[1000] bg-white/95 dark:bg-zinc-800/95 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 w-56 flex flex-col gap-3 pointer-events-auto">
                            <h3 className="font-bold text-sm uppercase tracking-wider border-b pb-2">Layers</h3>
                            <label className="flex items-center justify-between cursor-pointer"><span className="text-sm">Sensors</span><input type="checkbox" checked={showSensors} onChange={() => setShowSensors(!showSensors)} /></label>
                            <label className="flex items-center justify-between cursor-pointer"><span className="text-sm">Reports</span><input type="checkbox" checked={showReports} onChange={() => setShowReports(!showReports)} /></label>
                        </div>
                    )}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 dark:bg-zinc-800/95 px-5 py-3 rounded-full shadow-xl flex gap-4 text-[10px] font-bold text-gray-700 pointer-events-auto">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#dc2626' }}></div> Pothole</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></div> Bad</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div> Hump</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }}></div> Good</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function HistoryFeed() {
    const navigate = useNavigate();
    const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { fetchHistory(); }, []);
    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user.id;
            const localIssues = await StorageService.getPendingIssues();
            const localSensors = await StorageService.getPendingSensorBatches();
            let cloudReports: any[] = [];
            let cloudSensors: any[] = [];
            if (userId) {
                const { data: reports } = await supabase.from('reports').select('*').eq('user_id', userId).order('created_at', { ascending: false });
                if (reports) cloudReports = reports;
                const { data: sensors } = await supabase.from('sensors').select('*').eq('user_id', userId).neq('batch_id', 'SERVER_HEARTBEAT').order('created_at', { ascending: false });
                if (sensors) cloudSensors = sensors;
            }
            const timeline = [
                ...localIssues.map(i => ({ id: i.id, type: i.type === 'Garbage' ? 'Garbage Report' : 'Pothole Report', date: new Date(i.timestamp), status: 'Queued', isLocal: true, icon: '🗑️' })),
                ...localSensors.map(s => ({ id: s.id, type: 'Sensor Session', date: new Date(s.readings[0]?.timestamp || Date.now()), status: 'Queued', isLocal: true, icon: 'Activity' })),
                ...cloudReports.map(r => ({ id: r.id, type: r.issue_type === 'Garbage' ? 'Garbage Report' : 'Pothole Report', date: new Date(r.timestamp || r.created_at), status: r.status === 'pending' ? 'Processing' : 'Success', isLocal: false, icon: '🗑️' })),
                ...cloudSensors.map(s => ({ id: s.id, type: 'Sensor Session', date: new Date(s.created_at), status: s.status === 'pending' ? 'Processing' : 'Success', isLocal: false, icon: 'Activity' }))
            ].sort((a, b) => b.date.getTime() - a.date.getTime());
            setHistoryItems(timeline);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 pb-20">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 pt-12 pb-4 text-white flex items-center gap-4"><button onClick={() => navigate('/dashboard')} className="p-2"><ArrowLeft className="w-6 h-6" /></button><h1 className="text-xl font-bold">History</h1></div>
            <div className="p-4 space-y-4">
                {loading ? (<div className="flex justify-center p-8"><Activity className="animate-spin" /></div>) : historyItems.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl flex items-center gap-4 border border-gray-100 dark:border-zinc-700">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">{item.icon === 'Activity' ? <Activity className="w-6 h-6" /> : <span className="text-xl">{item.icon}</span>}</div>
                        <div className="flex-1"><h3 className="font-bold text-gray-900 dark:text-white truncate">{item.type}</h3><p className="text-xs text-gray-500">{item.date.toLocaleString()}</p><div className="flex items-center gap-1.5 mt-2"><div className={`w-2 h-2 rounded-full ${item.status === 'Success' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div><span className="text-xs font-semibold">{item.status}</span></div></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
        return () => subscription.unsubscribe();
    }, []);
    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900"><div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div></div>;
    return (
        <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 font-sans antialiased text-gray-900 dark:text-gray-100">
                <Routes>
                    <Route path="/" element={!session ? <Home /> : <Navigate to="/dashboard" />} />
                    <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
                    <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />} />
                    <Route path="/report/garbage" element={session ? <ReportGarbage /> : <Navigate to="/login" />} />
                    <Route path="/report/pothole" element={session ? <PotholeDetection /> : <Navigate to="/login" />} />
                    <Route path="/map" element={session ? <MapViewer /> : <Navigate to="/login" />} />
                    <Route path="/history" element={session ? <HistoryFeed /> : <Navigate to="/login" />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
