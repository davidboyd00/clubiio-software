import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  checkConnection: () => Promise<boolean>;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Mark that we were offline before (for showing sync notification)
      if (!isOnline) {
        setWasOffline(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  // Clear wasOffline flag after it's been observed
  useEffect(() => {
    if (wasOffline && isOnline) {
      const timer = setTimeout(() => setWasOffline(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }

    // Try to reach the server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:3000/api') + '/health',
        {
          method: 'HEAD',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  return { isOnline, wasOffline, checkConnection };
}
