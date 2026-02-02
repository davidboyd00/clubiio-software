import { useState, useEffect, useCallback } from 'react';
import {
  cashSessionsApi,
  cashRegistersApi,
  CashSession,
  CashRegister,
  SessionSummary,
} from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useOnlineStatus } from './useOnlineStatus';

interface UseCashSessionReturn {
  // State
  currentSession: CashSession | null;
  sessionSummary: SessionSummary | null;
  cashRegisters: CashRegister[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCashRegisters: () => Promise<void>;
  openSession: (cashRegisterId: string, openingAmount: number, notes?: string) => Promise<boolean>;
  closeSession: (closingAmount: number, notes?: string) => Promise<boolean>;
  addMovement: (type: 'IN' | 'OUT', amount: number, reason: string) => Promise<boolean>;
  refreshSummary: () => Promise<void>;
  checkActiveSession: () => Promise<void>;
}

export function useCashSession(): UseCashSessionReturn {
  const { venueId, cashSessionId, setCashSession } = useAuthStore();
  const { isOnline } = useOnlineStatus();

  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available cash registers
  const loadCashRegisters = useCallback(async () => {
    if (!isOnline || !venueId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await cashRegistersApi.getAll(venueId);
      if (response.data.success && response.data.data) {
        setCashRegisters(response.data.data.filter((cr) => cr.isActive));
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar cajas');
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, venueId]);

  // Check for active session (user's current open session)
  const checkActiveSession = useCallback(async () => {
    if (!isOnline) {
      setCurrentSession(null);
      return;
    }

    try {
      const response = await cashSessionsApi.getMySession();
      if (response.data.success && response.data.data) {
        setCurrentSession(response.data.data);
        // Update store with session info if not already set
        if (!cashSessionId && response.data.data.id) {
          await setCashSession(response.data.data.id, response.data.data.cashRegisterId);
        }
      } else {
        setCurrentSession(null);
      }
    } catch (err) {
      console.error('Error checking active session:', err);
      setCurrentSession(null);
    }
  }, [isOnline, cashSessionId, setCashSession]);

  // Open a new session
  const openSession = useCallback(
    async (registerId: string, openingAmount: number, notes?: string): Promise<boolean> => {
      if (!isOnline) {
        setError('Sin conexión a internet');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await cashSessionsApi.open({
          cashRegisterId: registerId,
          openingAmount,
          notes,
        });

        if (response.data.success && response.data.data) {
          const session = response.data.data;
          setCurrentSession(session);
          await setCashSession(session.id, registerId);
          return true;
        } else {
          setError(response.data.error || 'Error al abrir caja');
          return false;
        }
      } catch (err: any) {
        setError(err.message || 'Error al abrir caja');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isOnline, setCashSession]
  );

  // Close current session
  const closeSession = useCallback(
    async (closingAmount: number, notes?: string): Promise<boolean> => {
      const sessionId = currentSession?.id || cashSessionId;
      if (!isOnline || !sessionId) {
        setError('Sin sesión activa');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await cashSessionsApi.close(sessionId, {
          closingAmount,
          notes,
        });

        if (response.data.success) {
          setCurrentSession(null);
          setSessionSummary(null);
          await setCashSession(null, null);
          return true;
        } else {
          setError(response.data.error || 'Error al cerrar caja');
          return false;
        }
      } catch (err: any) {
        setError(err.message || 'Error al cerrar caja');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isOnline, currentSession, cashSessionId, setCashSession]
  );

  // Add cash movement
  const addMovement = useCallback(
    async (type: 'IN' | 'OUT', amount: number, reason: string): Promise<boolean> => {
      const sessionId = currentSession?.id || cashSessionId;
      if (!isOnline || !sessionId) {
        setError('Sin sesión activa');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await cashSessionsApi.addMovement(sessionId, {
          type,
          amount,
          reason,
        });

        if (response.data.success) {
          // Refresh summary after movement
          await refreshSummary();
          return true;
        } else {
          setError(response.data.error || 'Error al registrar movimiento');
          return false;
        }
      } catch (err: any) {
        setError(err.message || 'Error al registrar movimiento');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isOnline, currentSession, cashSessionId]
  );

  // Refresh session summary
  const refreshSummary = useCallback(async () => {
    const sessionId = currentSession?.id || cashSessionId;
    if (!isOnline || !sessionId) return;

    try {
      const response = await cashSessionsApi.getSummary(sessionId);
      if (response.data.success && response.data.data) {
        setSessionSummary(response.data.data);
        setCurrentSession(response.data.data.session);
      }
    } catch (err) {
      console.error('Error refreshing summary:', err);
    }
  }, [isOnline, currentSession, cashSessionId]);

  // Load cash registers on mount
  useEffect(() => {
    loadCashRegisters();
  }, [loadCashRegisters]);

  // Check for active session when cashRegisterId changes
  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  // Load summary when session is active
  useEffect(() => {
    if (currentSession || cashSessionId) {
      refreshSummary();
    }
  }, [currentSession, cashSessionId, refreshSummary]);

  return {
    currentSession,
    sessionSummary,
    cashRegisters,
    isLoading,
    error,
    loadCashRegisters,
    openSession,
    closeSession,
    addMovement,
    refreshSummary,
    checkActiveSession,
  };
}
