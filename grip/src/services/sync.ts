import { Network } from '@capacitor/network';
import { StorageService } from './storage';
import { supabase } from '../lib/supabase';

export const SyncEngine = {
    isSyncing: false,
    syncPromise: null as Promise<void> | null,

    async start() {
        // Listen for network changes
        Network.addListener('networkStatusChange', status => {
            console.log('Network status changed', status);
            if (status.connected) {
                this.syncAll();
            }
        });

        // Initial check
        const status = await Network.getStatus();
        if (status.connected) {
            this.syncAll();
        }
    },

    syncAll(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;

    console.log("Starting background sync...");
    this.syncPromise = (async () => {
        this.isSyncing = true;
        try {
            // Removed the strict Server Heartbeat Check.
            // The frontend will now instantly push data to Supabase.
            // If the Python worker is offline, the data will simply wait safely in the 'pending' database queue!
            
            await this.syncIssues();
            await this.syncSensors();
        } catch (e) {
            console.error("Sync run failed:", e);
        } finally {
            this.isSyncing = false;
            this.syncPromise = null;
        }
    })();

    return this.syncPromise;
},

    async syncIssues() {
        const issues = await StorageService.getPendingIssues();

        for (const issue of issues) {
            try {
                if (issue.lat === 0 || issue.lng === 0) {
                    console.warn(`SyncEngine: Skipping issue ${issue.id} due to invalid [0,0] coordinates.`);
                    await StorageService.deleteIssue(issue.id);
                    continue;
                }

                // Safely extract the Blob depending on the platform (Web Base64 vs Native File URI)
                let blob: Blob;

                if (issue.imageUri.startsWith('data:')) {
                    // LAPTOP/WEB: Manually decode the Base64 string to bypass Safari's fetch() limits
                    const base64Data = issue.imageUri.split(',')[1];
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    blob = new Blob([byteArray], { type: 'image/jpeg' });
                } else {
                    // MOBILE/NATIVE: Use standard fetch for Capacitor device file paths
                    const response = await fetch(issue.imageUri);
                    blob = await response.blob();
                }

                const fileName = `images/report_${issue.id}.jpg`;

                // 1. Upload high-res image to Supabase Storage Bucket
                const { error: uploadError } = await supabase.storage
                    .from('reports')
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

                // 2. Insert metadata into Supabase Database for Python Worker to discover
                const { error: dbError } = await supabase
                    .from('reports')
                    .insert({
                        id: issue.id,
                        user_id: issue.user_id,
                        issue_type: issue.type || 'auto',
                        latitude: issue.lat,
                        longitude: issue.lng,
                        timestamp: issue.timestamp,
                        image_path: fileName,
                        status: 'pending' // Python Worker grabs this
                    });

                if (dbError) throw new Error(`DB Error: ${dbError.message}`);

                console.log(`Successfully synced issue ${issue.id} to Supabase`);
                await StorageService.deleteIssue(issue.id);
                // Keep the UI silent on success to avoid annoying popups on background syncs
            } catch (err: any) {
                console.error(`Failed to sync issue ${issue.id}`, err);
                alert(`❌ Sync Failed: ${err?.message || err}`);
                // Will be retried on next online event
            }
        }
    },

    async syncSensors() {
        const batches = await StorageService.getPendingSensorBatches();

        for (const batch of batches) {
            try {
                await StorageService.markBatchSyncing(batch.id);

                const fileName = `sensors/batch_${batch.id}.json`;
                // Create a JSON Blob of the passive telemetry
                const jsonBlob = new Blob([JSON.stringify({ id: batch.id, readings: batch.readings })], { type: 'application/json' });

                // 1. Upload massive telemetry file to Storage to save Postgres limits
                const { error: uploadError } = await supabase.storage
                    .from('reports')
                    .upload(fileName, jsonBlob, {
                        contentType: 'application/json',
                        upsert: true
                    });

                if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

                // 2. Insert metadata into Database
                const { error: dbError } = await supabase
                    .from('sensors')
                    .insert({
                        batch_id: batch.id,
                        user_id: batch.user_id,
                        reading_count: batch.readings.length,
                        local_file_path: fileName,
                        status: 'pending' // Python Worker grabs this
                    });

                if (dbError) throw new Error(`DB Error: ${dbError.message}`);

                console.log(`Successfully synced sensor batch ${batch.id} to Supabase`);
                await StorageService.deleteSensorBatch(batch.id);
            } catch (err: any) {
                console.error(`Failed to sync batch ${batch.id}`, err);
                // alert(`❌ Sensor Sync Failed: ${err?.message || err}`);
            }
        }
    }
};
