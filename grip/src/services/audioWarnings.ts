// src/services/audioWarnings.ts

import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capacitor-community/native-audio';

export interface RoadSegment {
    segment_id?: string;
    label?: string;
    condition_label?: string;
    latitude: number | string;
    longitude: number | string;
}

// Haversine formula to calculate distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

// Calculate bearing from point 1 to point 2 in degrees (0-360)
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; // in degrees
}

const HAZARD_AUDIO_FILES: Record<string, string> = {
    'POTHOLE': 'pothole.mp3',
    'HUMP': 'hump.mp3',
    'OBSTACLE': 'obstacle.mp3',
    'BAD': 'bad.mp3',
    'ACTIVATED': 'activated.mp3',
};

const HAZARD_LABELS = new Set(['POTHOLE', 'HUMP', 'OBSTACLE', 'BAD']);

class AudioWarningServiceClass {
    // Configuration constants
    private readonly MIN_WARNING_DISTANCE_M = 40;
    private readonly LOOKAHEAD_SECONDS = 6;
    private readonly HEADING_CONE_HALF_DEG = 60;
    private readonly MIN_DIRECTIONAL_SPEED_MPS = 3;
    private readonly METERS_PER_LATITUDE_DEGREE = 111000;

    // Cooldown constants
    private readonly EXACT_SEGMENT_COOLDOWN_MS = 300000; // 5 minutes
    private readonly HAZARD_TYPE_COOLDOWN_MS = 20000; // 20 seconds before saying the same word again

    // Tracks the exact segment ID so we don't repeat the exact same pothole if stuck in traffic
    private announcedSegments: Map<string, number> = new Map();

    // Tracks the type of hazard so we don't spam "Pothole ahead" 5 times in a row for a cluster
    private lastAnnouncedType: Map<string, number> = new Map();

    private isSpeaking = false;
    private audioQueue: string[] = [];
    private isNative = Capacitor.isNativePlatform();
    private activeNativeAssetId: string | null = null;
    private nativeSafetyTimeout: any = null;

    constructor() {
        // Guaranteed cleanup every 5 minutes regardless of GPS activity
        setInterval(() => this.cleanupStaleEntries(), 300_000);

        if (this.isNative) {
            this.preloadNativeAudio();
            this.setupNativeListeners();
        }
    }

    private cleanupStaleEntries() {
        const now = Date.now();
        for (const [segId, timestamp] of this.announcedSegments.entries()) {
            if (now - timestamp > this.EXACT_SEGMENT_COOLDOWN_MS) {
                this.announcedSegments.delete(segId);
            }
        }
        for (const [type, timestamp] of this.lastAnnouncedType.entries()) {
            if (now - timestamp > this.HAZARD_TYPE_COOLDOWN_MS) {
                this.lastAnnouncedType.delete(type);
            }
        }
    }

    private getNormalizedLabel(seg: RoadSegment): string {
        return (seg.label || seg.condition_label || '').toUpperCase();
    }

    private async preloadNativeAudio() {
        try {
            for (const [key, filename] of Object.entries(HAZARD_AUDIO_FILES)) {
                await NativeAudio.preload({
                    assetId: key.toLowerCase(),
                    assetPath: Capacitor.getPlatform() === 'android' ? `public/audio/${filename}` : `audio/${filename}`,
                    audioChannelNum: 1,
                    isUrl: false
                });
            }
        } catch (e) {
            console.error("Failed to preload native audio assets:", e);
        }
    }

    private setupNativeListeners() {
        try {
            NativeAudio.addListener('complete', (event) => {
                if (this.activeNativeAssetId === event.assetId) {
                    if (this.nativeSafetyTimeout) {
                        clearTimeout(this.nativeSafetyTimeout);
                        this.nativeSafetyTimeout = null;
                    }
                    this.activeNativeAssetId = null;
                    this.isSpeaking = false;
                    this.processQueue();
                }
            });
        } catch (e) {
            console.error("Failed to set up native audio listener:", e);
        }
    }

    private queueWarning(label: string) {
        this.audioQueue.push(label);
        this.processQueue();
    }

    private processQueue() {
        if (this.isSpeaking || this.audioQueue.length === 0) return;
        const nextLabel = this.audioQueue.shift();
        if (nextLabel) {
            this.playWarning(nextLabel);
        }
    }

    public playWarning(label: string) {
        if (!label) return;
        const upperLabel = label.toUpperCase();
        const filename = HAZARD_AUDIO_FILES[upperLabel];
        if (!filename) return;

        if (this.isSpeaking) return;
        this.isSpeaking = true;

        if (this.isNative) {
            this.playWarningNative(upperLabel.toLowerCase());
        } else {
            this.playWarningWeb(filename);
        }
    }

    private async playWarningNative(assetId: string) {
        try {
            this.activeNativeAssetId = assetId;

            // Clear any existing safety timeout
            if (this.nativeSafetyTimeout) {
                clearTimeout(this.nativeSafetyTimeout);
            }

            // Safety fallback: if native 'complete' event doesn't fire within 3.5 seconds, reset state
            this.nativeSafetyTimeout = setTimeout(() => {
                if (this.activeNativeAssetId === assetId) {
                    console.warn(`Safety timeout fired: native audio completion event missed for asset: ${assetId}`);
                    this.activeNativeAssetId = null;
                    this.isSpeaking = false;
                    this.processQueue();
                }
            }, 3500);

            await NativeAudio.play({ assetId });
        } catch (e) {
            console.error("Native play error:", e);
            if (this.nativeSafetyTimeout) {
                clearTimeout(this.nativeSafetyTimeout);
            }
            this.activeNativeAssetId = null;
            this.isSpeaking = false;
            this.processQueue();
        }
    }

    private playWarningWeb(filename: string) {
        try {
            const audio = new Audio(`./audio/${filename}`);
            audio.onended = () => {
                this.isSpeaking = false;
                this.processQueue();
            };
            audio.onerror = () => {
                console.error("Web audio playback error:", filename);
                this.isSpeaking = false;
                this.processQueue();
            };
            audio.play().catch(e => {
                console.warn("Web audio playback blocked (autoplay policies):", e);
                this.isSpeaking = false;
                this.processQueue();
            });
        } catch (e) {
            this.isSpeaking = false;
            this.processQueue();
        }
    }

    public checkProximity(
        currentLat: number, 
        currentLng: number, 
        currentSpeedMps: number | null, 
        currentHeading: number | null, 
        segments: RoadSegment[]
    ) {
        const speed = currentSpeedMps ?? 0;
        // Adaptive warning distance: 40m min, or 6 seconds of travel time
        const warningDistance = Math.max(this.MIN_WARNING_DISTANCE_M, speed * this.LOOKAHEAD_SECONDS);

        // Pre-filter for bounding box
        const LAT_DELTA = warningDistance / this.METERS_PER_LATITUDE_DEGREE;
        const LNG_DELTA = Math.abs(LAT_DELTA / Math.cos(currentLat * Math.PI / 180));

        const nearbyHazards = segments.filter(seg => {
            const label = this.getNormalizedLabel(seg);
            if (!HAZARD_LABELS.has(label)) return false;
            
            const segLat = Number(seg.latitude);
            const segLng = Number(seg.longitude);
            return Math.abs(segLat - currentLat) < LAT_DELTA &&
                   Math.abs(segLng - currentLng) < LNG_DELTA;
        });

        if (nearbyHazards.length === 0) return;

        const validTriggers = [];
        for (const hazard of nearbyHazards) {
            const segLat = Number(hazard.latitude);
            const segLng = Number(hazard.longitude);
            const dist = getDistance(currentLat, currentLng, segLat, segLng);
            
            if (dist <= warningDistance) {
                // Directional Filtering: 
                // Only apply if speed > 3m/s (approx 10km/h) to avoid issues with jumpy static GPS bearing
                // Using != null to check for both null and undefined.
                // A heading of 0 (due north) is valid and correctly handled since 0 != null is true.
                if (speed > this.MIN_DIRECTIONAL_SPEED_MPS && currentHeading != null) {
                    const bearing = getBearing(currentLat, currentLng, segLat, segLng);
                    const delta = Math.abs((bearing - currentHeading + 360) % 360);
                    // Standard 120-degree cone ahead
                    if (delta > this.HEADING_CONE_HALF_DEG && delta < 360 - this.HEADING_CONE_HALF_DEG) {
                        continue; 
                    }
                }
                
                validTriggers.push({ ...hazard, dist });
            }
        }

        if (validTriggers.length === 0) return;
        validTriggers.sort((a, b) => a.dist - b.dist);

        const now = Date.now();

        for (const hazard of validTriggers) {
            const label = this.getNormalizedLabel(hazard);
            const segId = hazard.segment_id || `${hazard.latitude}_${hazard.longitude}`;
            
            if (this.announcedSegments.has(segId)) continue;

            const lastTypeTime = this.lastAnnouncedType.get(label) || 0;
            // A segment that is suppressed due to type cooldown should not be permanently marked as announced.
            // Only add it to announcedSegments when it is actually queued/announced.
            if (now - lastTypeTime < this.HAZARD_TYPE_COOLDOWN_MS) {
                continue; 
            }

            this.announcedSegments.set(segId, now);
            this.lastAnnouncedType.set(label, now);
            this.queueWarning(label);
            break; 
        }
    }
}

export const AudioWarningService = new AudioWarningServiceClass();
