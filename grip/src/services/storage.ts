import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';

// Initialize stores
export const issueStore = localforage.createInstance({
    name: "GRIP",
    storeName: "issues"
});

export const sensorStore = localforage.createInstance({
    name: "GRIP",
    storeName: "sensors"
});

export const activeStore = localforage.createInstance({
    name: "GRIP",
    storeName: "active_session"
});

export interface IssuePayload {
    id: string;
    user_id?: string;
    imageUri: string;
    lat: number;
    lng: number;
    timestamp: number;
    type: string;
    status: 'pending' | 'syncing' | 'synced';
}

export interface SensorBatch {
    id: string;
    user_id?: string;
    readings: Array<{
        accelZ: number;
        gyroX: number;
        gyroY: number;
        gyroZ: number;
        lat?: number;
        lng?: number;
        timestamp: number;
    }>;
    status: 'pending' | 'syncing' | 'synced';
}

export const StorageService = {
    // Save a new issue (e.g. Garbage Report)
    async saveIssue(payload: Omit<IssuePayload, 'id' | 'status' | 'user_id'>) {
        if (payload.lat === 0 || payload.lng === 0) {
            console.error("Refusing to save issue with 0,0 coordinates");
            throw new Error("Invalid GPS coordinates (0,0). Please wait for a GPS lock.");
        }
        const id = uuidv4();
        const { data: { session } } = await supabase.auth.getSession();
        const issue: IssuePayload = {
            ...payload,
            id,
            user_id: session?.user.id,
            status: 'pending'
        };
        await issueStore.setItem(id, issue);
        return issue;
    },

    // Get all pending issues for sync
    async getPendingIssues(): Promise<IssuePayload[]> {
        const issues: IssuePayload[] = [];
        await issueStore.iterate((value: IssuePayload) => {
            if (value.status === 'pending') {
                issues.push(value);
            }
        });
        return issues;
    },

    // Mark issue as syncing
    async markIssueSyncing(id: string) {
        const issue = await issueStore.getItem<IssuePayload>(id);
        if (issue) {
            issue.status = 'syncing';
            await issueStore.setItem(id, issue);
        }
    },

    // Delete synced issue
    async deleteIssue(id: string) {
        await issueStore.removeItem(id);
    },

    // Save a sensor batch (e.g. for Potholes)
    async saveSensorBatch(batchData: Omit<SensorBatch, 'id' | 'status' | 'user_id'>) {
        const id = uuidv4();
        const { data: { session } } = await supabase.auth.getSession();
        const batch: SensorBatch = {
            ...batchData,
            id,
            user_id: session?.user.id,
            status: 'pending'
        };
        await sensorStore.setItem(id, batch);
        return batch;
    },

    // Get all pending sensor batches
    async getPendingSensorBatches(): Promise<SensorBatch[]> {
        const batches: SensorBatch[] = [];
        await sensorStore.iterate((value: SensorBatch) => {
            if (value.status === 'pending') {
                batches.push(value);
            }
        });
        return batches;
    },

    // Mark batch as syncing
    async markBatchSyncing(id: string) {
        const batch = await sensorStore.getItem<SensorBatch>(id);
        if (batch) {
            batch.status = 'syncing';
            await sensorStore.setItem(id, batch);
        }
    },

    // Delete synced batch
    async deleteSensorBatch(id: string) {
        await sensorStore.removeItem(id);
    },

    // --- CRASH RECOVERY & AUTO-SAVE ---

    // Save the ongoing session data periodically to prevent loss on crash
    async saveActiveSession(readings: any[]) {
        if (readings.length === 0) return;
        const { data: { session } } = await supabase.auth.getSession();

        const activeBatch = {
            id: 'ongoing_crash_recovery', // Fixed ID for the active slot
            user_id: session?.user.id,
            readings: readings,
            status: 'pending' // Ready for sync if recovered
        };
        await activeStore.setItem('current_batch', activeBatch);
    },

    // Check if there was an active session abandoned due to a crash, and move it to the pending sync queue
    async recoverActiveSession() {
        try {
            const abandonedSession = await activeStore.getItem<SensorBatch>('current_batch');
            if (abandonedSession && abandonedSession.readings && abandonedSession.readings.length > 50) {
                // We have a substantial orphaned session! Move it to the main sensor queue.
                const newId = uuidv4();
                const recoveredBatch: SensorBatch = {
                    ...abandonedSession,
                    id: newId
                };
                console.log(`Recovered a crashed session with ${recoveredBatch.readings.length} readings into batch ${newId}`);
                await sensorStore.setItem(newId, recoveredBatch);
                // Clear the active slot
                await activeStore.removeItem('current_batch');
                return true;
            } else if (abandonedSession) {
                // Too small or invalid, just clear it
                await activeStore.removeItem('current_batch');
            }
        } catch (e) {
            console.error("Failed to recover active session:", e);
        }
        return false;
    },

    // Clear the active session backup once the user explicitly saves or discards correctly
    async clearActiveSession() {
        await activeStore.removeItem('current_batch');
    }
};
