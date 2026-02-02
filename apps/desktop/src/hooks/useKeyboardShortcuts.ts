import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../pages/SettingsPage';

interface ShortcutCallbacks {
  onSearch?: () => void;
  onCheckout?: () => void;
  onClearCart?: () => void;
  onDiscount?: () => void;
}

export function useKeyboardShortcuts(callbacks: ShortcutCallbacks = {}) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const settings = getSettings();
      if (!settings.shortcutsEnabled) return;

      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to blur inputs
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl + K - Search
      if (ctrlKey && e.key === 'k') {
        e.preventDefault();
        callbacks.onSearch?.();
        return;
      }

      // Ctrl + Enter - Checkout
      if (ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        callbacks.onCheckout?.();
        return;
      }

      // Ctrl + Backspace - Clear cart
      if (ctrlKey && e.key === 'Backspace') {
        e.preventDefault();
        callbacks.onClearCart?.();
        return;
      }

      // Ctrl + D - Discount
      if (ctrlKey && e.key === 'd') {
        e.preventDefault();
        callbacks.onDiscount?.();
        return;
      }

      // Ctrl + Shift + D - Dashboard
      if (ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        navigate('/dashboard');
        return;
      }

      // Ctrl + Shift + H - History
      if (ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        navigate('/history');
        return;
      }

      // Ctrl + Shift + S - Settings
      if (ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        navigate('/settings');
        return;
      }

      // Escape - Go back to POS
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/pos');
        return;
      }

      // Number keys 1-9 for quick category selection
      if (!ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        // This would be handled by the POS page
        return;
      }
    },
    [callbacks, navigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Hook for global shortcuts that work everywhere
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const settings = getSettings();
      if (!settings.shortcutsEnabled) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const _ctrlKey = isMac ? e.metaKey : e.ctrlKey;
      void _ctrlKey; // Reserved for future use

      // F1 - Help / POS
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/pos');
        return;
      }

      // F2 - History
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/history');
        return;
      }

      // F3 - Dashboard
      if (e.key === 'F3') {
        e.preventDefault();
        navigate('/dashboard');
        return;
      }

      // F4 - Movements
      if (e.key === 'F4') {
        e.preventDefault();
        navigate('/movements');
        return;
      }

      // F10 - Close cash
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/close-cash');
        return;
      }

      // F12 - Settings
      if (e.key === 'F12') {
        e.preventDefault();
        navigate('/settings');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
