import { useEffect, useState, useRef } from 'react';
import { api } from '../api/config';


interface LockResponse {
    status: string;
    locked_by?: string;
    message?: string;
}

export const useRecordLock = (entityType: string, entityId: number | null) => {
    const [isLocked, setIsLocked] = useState<boolean>(false);
    const [lockedBy, setLockedBy] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const hasAttemptedLock = useRef<boolean>(false);
    const heartbeatInterval = useRef<any>(null); // Store timer ID
    
    const getBaseUrl = () => {
        let baseUrl = api.defaults.baseURL || 'http://localhost:8000';
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        if (baseUrl.endsWith('/api')) return baseUrl; 
        return `${baseUrl}/api`;
    };

    useEffect(() => {
        if (!entityId) {
            setIsLoading(false);
            return;
        }

        const endpoint = '/locks/acquire'; 

        const acquireLock = async () => {
            try {
                const response = await api.post<LockResponse>(endpoint, {
                    entity_type: entityType,
                    entity_id: entityId
                });

                // Check specific status returned by backend logic
                if (response.data.status === "locked") {
                     console.warn(`[LOCK SYSTEM] 🔒 Backend says Locked by: ${response.data.locked_by}`);
                     setIsLocked(true);
                     setLockedBy(response.data.locked_by || "Unknown");
                } else {
                     console.log(`[LOCK SYSTEM] 🟢 Lock Acquired/Refreshed`);
                     setIsLocked(false);
                     setLockedBy(null);
                }

            } catch (error: any) {
                if (error.response && error.response.status === 409) {
                    const detail = error.response.data?.detail;
                    const user = detail?.locked_by || "Unknown User";
                    console.warn(`[LOCK SYSTEM] 🔒 Locked by: ${user}`);
                    setIsLocked(true);
                    setLockedBy(user);
                } else {
                    console.error(`[LOCK SYSTEM] ❌ Error:`, error);
                }
            } finally {
                setIsLoading(false);
            }
        };

        // 1. Initial Lock
        if (!hasAttemptedLock.current) {
            acquireLock();
            hasAttemptedLock.current = true;
        }

        // 2. Heartbeat: Refresh lock every 2 minutes (120000 ms)
        // This makes the lock duration "dynamic". It stays as long as user is here.
        heartbeatInterval.current = setInterval(() => {
            if (!isLocked) { // Only refresh if WE own the lock
                console.log("[LOCK SYSTEM] 💓 Heartbeat - Refreshing Lock...");
                acquireLock();
            }
        }, 120000);

        // 3. Cleanup on Unmount
        return () => {
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);

            const fullUrl = `${getBaseUrl()}/locks/release`;
            const payload = JSON.stringify({ entity_type: entityType, entity_id: entityId });
            const token = localStorage.getItem('token') || localStorage.getItem('access_token');

            fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: payload,
                keepalive: true
            }).catch(err => console.error("[LOCK SYSTEM] Release failed:", err));
        };
    }, [entityType, entityId, isLocked]); // Depend on isLocked to stop heartbeat if we don't own it

    return { isLocked, lockedBy, isLoading };
};