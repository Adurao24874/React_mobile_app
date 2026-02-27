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
                await StorageService.markIssueSyncing(issue.id);

                // Fetch image Blob from local filesystem
                const response = await fetch(issue.imageUri);
                const blob = await response.blob();
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
                        // Include the explicit ID if your Postgres assumes UUID is primary key. 
                        // If reports has an auto-incrementing ID, omit issue.id
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
