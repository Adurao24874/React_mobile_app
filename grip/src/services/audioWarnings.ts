// src/services/audioWarnings.ts

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

class AudioWarningServiceClass {
    // Tracks the exact segment ID so we don't repeat the exact same pothole if stuck in traffic
    private announcedSegments: Map<string, number> = new Map();
    private readonly EXACT_SEGMENT_COOLDOWN_MS = 300000; // 5 minutes

    // Tracks the type of hazard so we don't spam "Pothole ahead" 5 times in a row for a cluster
    private lastAnnouncedType: Map<string, number> = new Map();
    private readonly HAZARD_TYPE_COOLDOWN_MS = 20000; // 20 seconds before saying the same word again

    private isSpeaking = false;

    constructor() {
        // Guaranteed cleanup every 5 minutes regardless of GPS activity
        setInterval(() => this.cleanupStaleEntries(), 300_000);
    }

    private cleanupStaleEntries() {
        const now = Date.now();
        for (const [segId, timestamp] of this.announcedSegments.entries()) {
            if (now - timestamp > this.EXACT_SEGMENT_COOLDOWN_MS) {
                this.announcedSegments.delete(segId);
            }
        }
    }

    public playWarning(label: string) {
        if (this.isSpeaking) return;
        
        let filename = '';
        switch (label) {
            case 'POTHOLE':
                filename = 'pothole.mp3';
                break;
            case 'HUMP':
                filename = 'hump.mp3';
                break;
            case 'OBSTACLE':
                filename = 'obstacle.mp3';
                break;
            case 'BAD':
                filename = 'bad.mp3';
                break;
            default:
                return; // Do nothing for minor or good
        }

        this.isSpeaking = true;
        try {
            const audio = new Audio(`/audio/${filename}`);
            audio.onended = () => {
                this.isSpeaking = false;
            };
            audio.onerror = () => {
                console.error("Failed to play audio:", filename);
                this.isSpeaking = false;
            };
            audio.play().catch(e => {
                console.error("Audio playback prevented by browser:", e);
                this.isSpeaking = false;
            });
        } catch (e) {
            this.isSpeaking = false;
        }
    }

    public checkProximity(
        currentLat: number, 
        currentLng: number, 
        currentSpeedMps: number | null, 
        currentHeading: number | null, 
        segments: any[]
    ) {
        if (this.isSpeaking) return; // Don't check if we're currently speaking to save CPU/spam

        // 1. Speed-Adaptive Warning Distance
        // If speed is missing or < 10m/s (36 km/h), default to 50m.
        // Otherwise, 5 seconds of warning time.
        const speed = currentSpeedMps ?? 0;
        const warningDistance = Math.max(50, speed * 5);

        // 2. Bounding Box Pre-filter (Spatial Indexing)
        // 1 degree latitude is approx 111,320 meters.
        // So warningDistance in degrees is roughly warningDistance / 111320
        const LAT_DELTA = warningDistance / 111320;
        const LNG_DELTA = Math.abs(LAT_DELTA / Math.cos(currentLat * Math.PI / 180));

        const nearbyHazards = segments.filter(seg => {
            // Only care about severe hazards
            if (seg.label !== 'POTHOLE' && seg.label !== 'BAD' && seg.label !== 'OBSTACLE' && seg.label !== 'HUMP') return false;
            
            return Math.abs(seg.latitude - currentLat) < LAT_DELTA &&
                   Math.abs(seg.longitude - currentLng) < LNG_DELTA;
        });

        if (nearbyHazards.length === 0) return;

        // 3. Distance & Directional Filtering
        const validTriggers = [];
        for (const hazard of nearbyHazards) {
            const dist = getDistance(currentLat, currentLng, Number(hazard.latitude), Number(hazard.longitude));
            
            if (dist <= warningDistance) {
                // Directional Filtering: Only warn if it's generally "ahead"
                if (currentHeading !== null && currentHeading !== undefined) {
                    const bearing = getBearing(currentLat, currentLng, Number(hazard.latitude), Number(hazard.longitude));
                    const delta = Math.abs((bearing - currentHeading + 360) % 360);
                    // Reject if outside a ±60° cone (i.e. if it's > 60 AND < 300)
                    if (delta > 60 && delta < 300) {
                        continue; // Skip this hazard, it's behind or parallel
                    }
                }
                
                validTriggers.push({ ...hazard, dist });
            }
        }

        // 4. Priority Queue (Sort by closest)
        if (validTriggers.length === 0) return;
        validTriggers.sort((a, b) => a.dist - b.dist);

        const now = Date.now();

        for (const hazard of validTriggers) {
            const label = hazard.label;
            
            // Have we announced this specific segment recently?
            if (this.announcedSegments.has(hazard.segment_id)) continue;

            // Have we announced this TYPE of hazard recently?
            const lastTypeTime = this.lastAnnouncedType.get(label) || 0;
            if (now - lastTypeTime < this.HAZARD_TYPE_COOLDOWN_MS) {
                this.announcedSegments.set(hazard.segment_id, now);
                continue; 
            }

            // If we get here, it's safe to announce! We announce the closest valid one and break.
            this.announcedSegments.set(hazard.segment_id, now);
            this.lastAnnouncedType.set(label, now);
            this.playWarning(label);
            break; 
        }
    }
}

export const AudioWarningService = new AudioWarningServiceClass();
