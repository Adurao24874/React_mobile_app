import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Camera, MapPin, Activity, History, ArrowRight, ArrowLeft, CheckCircle2, Layers } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { StorageService } from './services/storage';
import { SyncEngine } from './services/sync';
import { Network } from '@capacitor/network';
import { Motion } from '@capacitor/motion';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';

const blueDotIcon = new L.Icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

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

function Dashboard() {
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(true);
    const [pendingSyncs, setPendingSyncs] = useState(0);

    useEffect(() => {
        // Start Sync Engine on mount
        SyncEngine.start();

        const updateStatus = async () => {
            const status = await Network.getStatus();
            setIsOnline(status.connected);

            const pendingIssues = await StorageService.getPendingIssues();
            const pendingBatches = await StorageService.getPendingSensorBatches();
            setPendingSyncs(pendingIssues.length + pendingBatches.length);
        };

        // Initial fetch
        updateStatus();

        // Poll for updates to UI
        const interval = setInterval(updateStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
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

                {/* Sync Status Banner */}
                <div className={`p-3 rounded-2xl flex items-center justify-between backdrop-blur-md shadow-inner ${isOnline && pendingSyncs === 0 ? 'bg-white/10 text-white' : (isOnline && pendingSyncs > 0 ? 'bg-yellow-500/20 text-yellow-50' : 'bg-red-500/20 text-red-50')}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        <span className="text-sm font-semibold">{isOnline ? 'System Online' : 'Offline Mode'}</span>
                    </div>
                    {pendingSyncs > 0 && (
                        <div className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">
                            {pendingSyncs} pending sync
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-6 space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Report infrastructure issues in your area</p>
                </div>

                {/* Action Cards */}
                <div className="space-y-4">
                    <button onClick={() => navigate('/report/garbage')} className="w-full bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center gap-4 hover:shadow-md transition-all text-left">
                        <div className="w-14 h-14 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">🗑️</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Report Issue</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">Capture and report illegal garbage dump road crack and potholes</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-green-500" />
                    </button>

                    <button onClick={() => navigate('/report/pothole')} className="w-full bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center gap-4 hover:shadow-md transition-all text-left">
                        <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Pothole Detection</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">Auto-detect road irregularities using sensors</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-blue-500" />
                    </button>
                </div>

                {/* Secondary Actions */}
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

                {/* Stats Card */}
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700 mt-8">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 text-lg">Quick Stats</h3>
                    <div className="flex justify-between text-center px-2">
                        <div>
                            <p className="text-3xl font-bold text-green-500 mb-1">12</p>
                            <p className="text-xs font-semibold text-gray-500">Reported</p>
                        </div>
                        <div className="w-px bg-gray-200 dark:bg-zinc-700"></div>
                        <div>
                            <p className="text-3xl font-bold text-blue-500 mb-1">5</p>
                            <p className="text-xs font-semibold text-gray-500">In Progress</p>
                        </div>
                        <div className="w-px bg-gray-200 dark:bg-zinc-700"></div>
                        <div>
                            <p className="text-3xl font-bold text-gray-800 dark:text-gray-300 mb-1">8</p>
                            <p className="text-xs font-semibold text-gray-500">Resolved</p>
                        </div>
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
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera
            });

            if (image.webPath) {
                setImageUri(image.webPath);
                fetchLocation();
            }
        } catch (e) {
            console.error("Camera error:", e);
        }
    };

    const fetchLocation = async () => {
        try {
            await Geolocation.requestPermissions();
            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            });
            setLoc({
                lat: coordinates.coords.latitude,
                lng: coordinates.coords.longitude
            });
        } catch (e) {
            console.error("Location error:", e);
            // Fallback coordinates if location fails (e.g., in a browser without perms)
            setLoc({ lat: 15.2993, lng: 74.1240 });
        }
    };

    const handleSave = async () => {
        if (!imageUri || !loc) return;

        setIsSaving(true);
        try {
            await StorageService.saveIssue({
                imageUri,
                lat: loc.lat,
                lng: loc.lng,
                timestamp: Date.now(),
                type: 'auto'
            });
            setSavedMessage("Issue saved locally. It will automatically sync when online.");
            setTimeout(() => {
                navigate('/dashboard');
            }, 2500);
        } catch (e) {
            console.error("Storage error:", e);
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 pt-12 pb-4 text-white flex items-center gap-4 shadow-md">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">Report Issue</h1>
            </div>

            <div className="p-6 space-y-6">

                {savedMessage && (
                    <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{savedMessage}</p>
                    </div>
                )}

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700">
                    {imageUri ? (
                        <div className="w-full aspect-square bg-black rounded-2xl mb-6 overflow-hidden relative border border-gray-200 dark:border-zinc-700">
                            <img src={imageUri} alt="Captured Garbage" className="w-full h-full object-cover" />
                            <button onClick={takePicture} className="absolute bottom-4 right-4 bg-white text-gray-900 p-3 rounded-full shadow-lg hover:scale-105 transition-transform">
                                <Camera className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-full aspect-square bg-gray-100 dark:bg-zinc-700 rounded-2xl flex flex-col items-center justify-center text-gray-400 mb-6 border-2 border-dashed border-gray-200 dark:border-zinc-600">
                            <Camera className="w-12 h-12 mb-2 opacity-50" />
                            <p className="font-medium">No image captured</p>
                        </div>
                    )}

                    {!imageUri ? (
                        <button onClick={takePicture} className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all">
                            <Camera className="w-5 h-5" />
                            Capture Image
                        </button>
                    ) : (
                        <button onClick={handleSave} disabled={isSaving || !loc} className="w-full py-4 bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all">
                            {isSaving ? "Saving Offline..." : "Save Report"}
                        </button>
                    )}
                </div>

                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Location</p>
                            {loc ? (
                                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                                    {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                                </p>
                            ) : (
                                <p className="font-medium text-gray-400 text-sm">Waiting for image...</p>
                            )}
                        </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${loc ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-300 dark:bg-zinc-600 animate-pulse'}`}></div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-4 rounded-2xl flex gap-3">
                    <div className="text-blue-500 mt-0.5">ℹ️</div>
                    <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                        Make sure the garbage dump is clearly visible in the photo for faster processing by authorities. This report will sync securely in the background.
                    </p>
                </div>
            </div>
        </div>
    )
}



function LiveMapUpdater({ position }: { position: { lat: number, lng: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo([position.lat, position.lng], map.getZoom(), { animate: true, duration: 1.0 });
        }
    }, [position, map]);
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
    const batchRef = useRef<Array<{
        accelZ: number;
        gyroX: number;
        gyroY: number;
        gyroZ: number;
        lat?: number;
        lng?: number;
        timestamp: number;
    }>>([]);
    const geoWatchId = useRef<string | null>(null);
    const pitchRef = useRef<number>(0);
    const rollRef = useRef<number>(0);
    const lastSavedTimeRef = useRef<number>(0);
    const currentLocationRef = useRef<{ lat: number, lng: number } | null>(null);

    useEffect(() => {
        let interval: any;
        if (isRecording) {
            interval = setInterval(() => {
                setSampleCount(batchRef.current.length);
            }, 500);
        } else {
            setSampleCount(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const startMonitoring = async () => {
        try {
            setUploadStatus('idle');

            // 1. Check if Locations Services / GPS is actually ON
            try {
                await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            } catch (error) {
                console.warn("GPS appears to be off", error);
                alert("GPS is turned off. Please enable location services to use Pothole Detection.");
                await NativeSettings.openAndroid({ option: AndroidSettings.Location });
                setIsRecording(false);
                return; // Stop execution
            }

            // 2. Request permissions for motion and location just in case
            if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                await (DeviceMotionEvent as any).requestPermission();
            }
            await Geolocation.requestPermissions();

            // Start continuous GPS watcher
            geoWatchId.current = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }, (position, err) => {
                if (err) {
                    console.error("Lost GPS during recording", err);
                    return;
                }

                if (position) {
                    setCurrentLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                    currentLocationRef.current = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                }
            });

            setIsRecording(true);
            batchRef.current = [];
            pitchRef.current = 0;
            rollRef.current = 0;
            lastSavedTimeRef.current = 0;

            const handleOrientation = (event: any) => {
                pitchRef.current = ((event.beta || 0) * Math.PI) / 180;
                rollRef.current = ((event.gamma || 0) * Math.PI) / 180;
            };

            const handleMotion = (event: DeviceMotionEvent) => {
                try {
                    const currentTime = Date.now();
                    if (currentTime - lastSavedTimeRef.current < 20) return;
                    lastSavedTimeRef.current = currentTime;

                    // Support both raw acceleration and including gravity
                    const accel = event.acceleration || event.accelerationIncludingGravity;
                    if (!accel) return;

                    const ax = accel.x || 0;
                    const ay = accel.y || 0;
                    const az = accel.z || 0;

                    const pitch = pitchRef.current || 0;
                    const roll = rollRef.current || 0;

                    // Compute true vertical acceleration independent of phone orientation
                    const vertical = ax * Math.sin(pitch) + ay * Math.sin(roll) + az * Math.cos(pitch) * Math.cos(roll);

                    // Subtract gravity to get linear vertical acceleration (if using accelerationIncludingGravity)
                    const verticalLinear = event.acceleration ? vertical : (vertical - 9.81);

                    const xGyro = event.rotationRate?.alpha || 0;
                    const yGyro = event.rotationRate?.beta || 0;
                    const zGyro = event.rotationRate?.gamma || 0;

                    setLiveAccel({ x: ax, y: ay, z: verticalLinear });
                    setLiveGyro({ x: xGyro, y: yGyro, z: zGyro });

                    batchRef.current.push({
                        accelZ: verticalLinear,
                        gyroX: xGyro,
                        gyroY: yGyro,
                        gyroZ: zGyro,
                        lat: currentLocationRef.current?.lat,
                        lng: currentLocationRef.current?.lng,
                        timestamp: currentTime
                    });
                } catch (err) {
                    console.error("Error processing sensor data:", err);
                }
            };

            window.addEventListener('deviceorientation', handleOrientation);
            window.addEventListener('devicemotion', handleMotion);

            // Store references to remove them later
            (window as any)._motionHandler = handleMotion;
            (window as any)._orientationHandler = handleOrientation;

        } catch (e) {
            console.error("Failed to start sensors:", e);
            alert("Could not access motion sensors or GPS. Ensure location is enabled.");
            setIsRecording(false);
        }
    };

    const stopMonitoring = async () => {
        setIsRecording(false);

        window.removeEventListener('devicemotion', (window as any)._motionHandler);
        window.removeEventListener('deviceorientation', (window as any)._orientationHandler);

        if (geoWatchId.current) {
            await Geolocation.clearWatch({ id: geoWatchId.current });
            geoWatchId.current = null;
        }

        if (batchRef.current.length > 0) {
            setShowSavePrompt(true);
        }
    };

    const saveSession = async () => {
        setShowSavePrompt(false);
        setUploadStatus('saving');
        await StorageService.saveSensorBatch({ readings: batchRef.current });
        batchRef.current = [];

        try {
            await SyncEngine.syncAll();
            setUploadStatus('success');
        } catch (err) {
            setUploadStatus('failed');
        }
    };

    const discardSession = () => {
        batchRef.current = [];
        setSampleCount(0);
        setShowSavePrompt(false);
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            Motion.removeAllListeners();
            if (geoWatchId.current) {
                Geolocation.clearWatch({ id: geoWatchId.current });
            }
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 pt-12 pb-4 text-white flex items-center gap-4 shadow-md">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">Trip Telemetry Session</h1>
            </div>

            <div className="p-6 space-y-6">

                {uploadStatus === 'success' && (
                    <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 mb-2">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">Session Uploaded Successfully!</p>
                        </div>
                        <button onClick={() => setUploadStatus('idle')} className="text-green-600 hover:text-green-800 font-bold px-2 py-1 text-xs">Dismiss</button>
                    </div>
                )}

                {uploadStatus === 'saving' && (
                    <div className="bg-blue-100 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 mb-2 shadow-sm">
                        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0"></div>
                        <p className="text-sm font-medium">Saving Offline & Uploading...</p>
                    </div>
                )}

                <div className="relative w-full h-72 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-700 z-0 bg-zinc-800">
                    <MapContainer
                        center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [15.2993, 74.1240]} // Goa default
                        zoom={17}
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                        zoomControl={false}
                        attributionControl={false}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {currentLocation && (
                            <>
                                <Circle
                                    center={[currentLocation.lat, currentLocation.lng]}
                                    radius={currentLocation.accuracy}
                                    pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 1 }}
                                />
                                <Marker position={[currentLocation.lat, currentLocation.lng]} icon={blueDotIcon} />
                            </>
                        )}
                        <LiveMapUpdater position={currentLocation} />
                    </MapContainer>

                    {/* Overlay status text */}
                    <div className="absolute bottom-4 left-0 right-0 z-[1000] flex justify-center pointer-events-none">
                        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-zinc-700 flex items-center gap-2 pointer-events-auto">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRecording ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                Status: <span className="text-gray-600 dark:text-gray-300 font-medium">{isRecording ? 'Recording' : 'Idle'}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Accelerometer</h3>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-blue-500 text-sm font-bold">x:</span>
                                <span className="text-gray-900 dark:text-white text-lg">{liveAccel.x.toFixed(2)}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-green-500 text-sm font-bold">y:</span>
                                <span className="text-gray-900 dark:text-white text-lg">{liveAccel.y.toFixed(2)}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-purple-500 text-sm font-bold">z:</span>
                                <span className="text-gray-900 dark:text-white text-lg">{liveAccel.z.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gyroscope</h3>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-blue-500 text-sm font-bold">x:</span>
                                <span className="text-gray-900 dark:text-white text-lg">{liveGyro.x.toFixed(2)}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-green-500 text-sm font-bold">y:</span>
                                <span className="text-gray-900 dark:text-white text-lg">{liveGyro.y.toFixed(2)}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-purple-500 text-sm font-bold">z:</span>
                                <span className="text-gray-900 dark:text-white text-lg">{liveGyro.z.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-2 pb-2">
                    <span>Samples Collected</span>
                    <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-900 dark:text-gray-200">{sampleCount}</span>
                </div>

                <button
                    onClick={isRecording ? stopMonitoring : startMonitoring}
                    className={`w-full py-5 text-white font-bold text-lg rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isRecording
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-gradient-to-r from-green-500 to-blue-600 hover:opacity-90'
                        }`}
                >
                    {isRecording ? (
                        <><span>⏹</span> End Session</>
                    ) : (
                        <><span>▶</span> Start Session</>
                    )}
                </button>

                {showSavePrompt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Session Ended
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                You collected <strong className="text-blue-500">{sampleCount}</strong> data samples during this trip. Would you like to save and upload them to the community map?
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button onClick={discardSession} className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">Discard</button>
                                <button onClick={saveSession} className="flex-1 py-3 bg-gradient-to-r from-green-500 to-blue-600 hover:opacity-90 text-white rounded-xl font-bold text-sm transition-opacity shadow-lg shadow-blue-500/25">Save Data</button>
                            </div>
                        </div>
                    </div>
                )}
                <button onClick={() => navigate('/map')} className="w-full py-4 bg-gray-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-500 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors font-bold rounded-xl border border-dashed border-blue-200 dark:border-blue-800 flex items-center justify-center gap-2">
                    <MapPin className="w-5 h-5" />
                    View Community Pothole Map
                </button>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-700 mt-8">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">How it works</h3>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 shadow-inner">1</div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">System detects road irregularities using mobile sensors (accelerometer & gyroscope)</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 shadow-inner">2</div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">Data is securely vaulted offline and synced when network is restored</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 shadow-inner">3</div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">The server analyzes physics to plot potholes globally for all riders to see on the map</p>
                        </div>
                    </div>
                </div>
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
            await Geolocation.requestPermissions();
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            setCurrentPos(coords);
            map.flyTo([coords.lat, coords.lng], 16, { animate: true });
        } catch (e) {
            console.error("Locate error", e);
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
            <div className="absolute bottom-6 right-4 z-[1000] pointer-events-auto">
                <button
                    onClick={handleLocate}
                    disabled={locating}
                    className="bg-zinc-800/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/10 hover:bg-zinc-700 transition-colors flex items-center justify-center text-white"
                >
                    {locating ? (
                        <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="4" fill="currentColor" />
                            <circle cx="12" cy="12" r="8" />
                            <line x1="12" y1="2" x2="12" y2="4" />
                            <line x1="12" y1="20" x2="12" y2="22" />
                            <line x1="2" y1="12" x2="4" y2="12" />
                            <line x1="20" y1="12" x2="22" y2="12" />
                        </svg>
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

    useEffect(() => {
        const fetchMapLayer = async () => {
            try {
                // Fetch Sensor Conditions
                const condReq = supabase
                    .from('road_conditions')
                    .select('*')
                    .order('timestamp', { ascending: false });

                // Fetch AI Image Reports
                const repReq = supabase
                    .from('reports')
                    .select('*')
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false });

                const [condRes, repRes] = await Promise.all([condReq, repReq]);

                if (condRes.error) throw condRes.error;
                if (repRes.error) throw repRes.error;

                if (condRes.data) setConditions(condRes.data);
                if (repRes.data) setReports(repRes.data);
            } catch (e) {
                console.error("Failed to load map points", e);
            } finally {
                setLoading(false);
            }
        };
        fetchMapLayer();
    }, []);

    // Goa Center roughly
    const center = [15.4909, 73.8278];

    return (
        <div className="h-screen flex flex-col bg-zinc-900 relative">
            <div className="absolute top-0 w-full z-50 bg-gradient-to-b from-black/80 to-transparent p-4 pt-12 text-white flex justify-between items-start pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <button onClick={() => navigate(-1)} className="p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors shadow-lg">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold drop-shadow-md tracking-tight">Infrastructure Map</h1>
                        <p className="text-white/80 font-medium drop-shadow-sm text-sm">Real-time Road Conditions</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center bg-zinc-900 border-t border-zinc-800">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                </div>
            ) : (
                <div className="flex-1 z-0 relative">
                    <MapContainer center={center as any} zoom={11} className="w-full h-full" zoomControl={false}>
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />

                        {/* Render Sensor Data */}
                        {showSensors && conditions.map((pt, i) => (
                            <CircleMarker
                                key={`cond-${i}`}
                                center={[pt.latitude, pt.longitude]}
                                radius={pt.condition_label === 'POTHOLE' || pt.condition_label === 'BAD' ? 8 : 5}
                                pathOptions={{
                                    color: pt.color_hex,
                                    fillColor: pt.color_hex,
                                    fillOpacity: 0.8,
                                    weight: 2
                                }}
                            >
                                <Popup className="rounded-xl overflow-hidden">
                                    <div className="p-1 min-w-[140px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pt.color_hex }}></div>
                                            <span className="font-bold text-gray-800 uppercase tracking-wider text-xs">Sensor: {pt.condition_label}</span>
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            <p><span className="font-semibold">Vibration:</span> {pt.vibration_intensity.toFixed(2)} m/s²</p>
                                            <p><span className="font-semibold">Time:</span> {new Date(pt.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ))}

                        {/* Render AI Image Reports */}
                        {showReports && reports.map((rep, i) => (
                            <CircleMarker
                                key={`rep-${i}`}
                                center={[rep.latitude, rep.longitude]}
                                radius={9}
                                pathOptions={{
                                    color: '#ffffff', // White outline
                                    fillColor: rep.issue_type === 'Garbage' ? '#a855f7' : '#ef4444', // Purple for Garbage, Red for AI Pothole
                                    fillOpacity: 1,
                                    weight: 2
                                }}
                            >
                                <Popup className="rounded-xl overflow-hidden">
                                    <div className="max-w-[200px]">
                                        {rep.image_url && (
                                            <img src={supabase.storage.from('reports').getPublicUrl(rep.image_url).data.publicUrl} alt="Report" className="w-full h-32 object-cover rounded-t-xl mb-2 bg-gray-100" />
                                        )}
                                        <div className="p-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: rep.issue_type === 'Garbage' ? '#a855f7' : '#ef4444' }}></div>
                                                <span className="font-bold text-gray-800 uppercase tracking-wider text-xs">Image: {rep.issue_type}</span>
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                <p><span className="font-semibold">Detected:</span> {rep.ai_predictions || rep.issue_type}</p>
                                                <p><span className="font-semibold">Reported:</span> {new Date(rep.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ))}
                        <LocateControl />
                    </MapContainer>

                    {/* Layer Filter Controls */}
                    <div className="absolute top-24 right-4 z-[1000] pointer-events-auto">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-white/20 hover:bg-white transition-colors"
                        >
                            <Layers className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                        </button>

                        {showFilters && (
                            <div className="absolute top-14 right-0 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 w-56 flex flex-col gap-3">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-100 dark:border-zinc-700 pb-2">Map Layers</h3>

                                <label className="flex items-center justify-between cursor-pointer group">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">Sensor Data</span>
                                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${showSensors ? 'bg-blue-500' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showSensors ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={showSensors} onChange={() => setShowSensors(!showSensors)} />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer group">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">YOLO Images</span>
                                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${showReports ? 'bg-blue-500' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showReports ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={showReports} onChange={() => setShowReports(!showReports)} />
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Map Legend Floating */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md px-5 py-3 rounded-3xl shadow-xl border border-white/20 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-bold text-gray-700 dark:text-gray-300 pointer-events-auto max-w-[95vw] lg:max-w-[1000px]">
                        {showSensors && (
                            <>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: '#dc2626' }}></div> Pothole</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: '#ef4444' }}></div> Bad</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: '#3b82f6' }}></div> Hump</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: '#f97316' }}></div> Rumble</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: '#eab308' }}></div> Minor</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: '#22c55e' }}></div> Good</div>
                            </>
                        )}
                        {showSensors && showReports && (
                            <div className="w-px h-4 bg-gray-300 dark:bg-zinc-600 hidden sm:block mx-1"></div>
                        )}
                        {showReports && (
                            <>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm border border-white" style={{ backgroundColor: '#a855f7' }}></div> YOLO Garbage</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full shadow-sm border border-white" style={{ backgroundColor: '#ef4444' }}></div> YOLO Pothole</div>
                            </>
                        )}
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

    useEffect(() => {
        fetchHistory();
    }, []);

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

                const { data: sensors } = await supabase.from('sensors').select('*').eq('user_id', userId).order('created_at', { ascending: false });
                if (sensors) cloudSensors = sensors;
            }

            // Map everything to a unified timeline
            const timeline = [
                ...localIssues.map(i => ({
                    id: i.id,
                    type: i.type === 'Garbage' ? 'Garbage Report' : 'Pothole Report',
                    date: new Date(i.timestamp),
                    status: 'Queued for Sync (Offline)',
                    isLocal: true,
                    icon: '🗑️'
                })),
                ...localSensors.map(s => ({
                    id: s.id,
                    type: 'Sensor Session',
                    date: new Date(s.readings[0]?.timestamp || Date.now()),
                    status: 'Queued for Sync (Offline)',
                    isLocal: true,
                    icon: 'Activity'
                })),
                ...cloudReports.map(r => ({
                    id: r.id,
                    type: r.issue_type === 'Garbage' ? 'Garbage Report' : 'Pothole Report',
                    date: new Date(r.timestamp || r.created_at),
                    status: r.status === 'pending' ? 'Uploaded / Pending Processing' : 'Processed by AI',
                    isLocal: false,
                    icon: '🗑️'
                })),
                ...cloudSensors.map(s => ({
                    id: s.id,
                    type: 'Sensor Session',
                    date: new Date(s.created_at),
                    status: s.status === 'pending' ? 'Uploaded / Pending Processing' : 'Processed by AI',
                    isLocal: false,
                    icon: 'Activity'
                }))
            ];

            timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
            setHistoryItems(timeline);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 pb-20">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 p-4 pt-12 pb-4 text-white flex items-center gap-4 shadow-md">
                <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">Activity History</h1>
            </div>

            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center p-8"><div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div></div>
                ) : historyItems.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 font-medium bg-white dark:bg-zinc-800 rounded-3xl py-12 shadow-sm border border-gray-100 dark:border-zinc-700">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        No history found.
                    </div>
                ) : (
                    historyItems.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.icon === 'Activity' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                {item.icon === 'Activity' ? <Activity className="w-6 h-6" /> : <span className="text-xl">{item.icon}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{item.type}</h3>
                                <p className="text-xs text-gray-500">{item.date.toLocaleString()}</p>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-gray-50 dark:bg-zinc-700 w-auto max-w-full">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status.includes('Queued') ? 'bg-yellow-500 animate-[pulse_2s_ease-in-out_infinite]' : item.status.includes('Processed') ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.status}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900"><div className="w-8 h-8 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div></div>;
    }

    return (
        <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 font-sans antialiased text-gray-900 dark:text-gray-100 selection:bg-blue-500/30">
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
