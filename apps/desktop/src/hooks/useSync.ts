import { useState, useEffect, useCallback } from 'react';
import { syncService } from '../lib/sync';

interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt: Date | null;
  pendingCount: number;
  error: string | null;
}

interface UseSyncReturn extends SyncState {
  sync: () => Promise<void>;
  downloadData: () => Promise<boolean>;
  startAutoSync: (intervalMs?: number) => void;
  stopAutoSync: () => void;
}

export function useSync(): UseSyncReturn {
  const [state, setState] = useState<SyncState>(syncService.getState());

  useEffect(() => {
    // Subscribe to sync service events
    const unsubscribe = syncService.subscribe((event, data) => {
      if (event === 'status') {
        setState(data);
      }
    });

    // Get initial state
    setState(syncService.getState());

    // Update pending count
    syncService.updatePendingCount();

    return () => {
      unsubscribe();
    };
  }, []);

  const sync = useCallback(async () => {
    await syncService.syncPendingData();
  }, []);

  const downloadData = useCallback(async () => {
    return syncService.downloadAllData();
  }, []);

  const startAutoSync = useCallback((intervalMs?: number) => {
    syncService.startAutoSync(intervalMs);
  }, []);

  const stopAutoSync = useCallback(() => {
    syncService.stopAutoSync();
  }, []);

  return {
    ...state,
    sync,
    downloadData,
    startAutoSync,
    stopAutoSync,
  };
}
