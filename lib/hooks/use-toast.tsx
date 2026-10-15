'use client';

import { useState, createContext, useContext, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * A single forward action on the toast, surfaced as a chevron beside the copy.
 * Used where the toast reports a move the reader may want to undo or inspect, so
 * the destination is one tap away instead of something they have to go and find.
 */
export interface ToastAction {
  /** Short visible text shown before the chevron, e.g. "View". */
  label: string;
  /**
   * Fuller name for assistive tech. "View" alone is a weak accessible name on a
   * control that navigates somewhere, so callers set this to say where.
   */
  ariaLabel?: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  shakeKey?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string, action?: ToastAction) => void;
    error: (message: string, title?: string, action?: ToastAction) => void;
    info: (message: string, title?: string, action?: ToastAction) => void;
    warning: (message: string, title?: string, action?: ToastAction) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useState(() => new Map<string, NodeJS.Timeout>())[0];

  const removeToast = useCallback((id: string) => {
    const existingTimeout = timeoutsRef.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutsRef.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [timeoutsRef]);

  const addToast = useCallback(
    ({ type, title, message, duration = 4000, action }: Omit<ToastItem, 'id'>) => {
      setToasts((prev) => {
        const existingIndex = prev.findIndex(
          (t) => t.type === type && t.title === title && t.message === message
        );

        if (existingIndex !== -1) {
          const existing = prev[existingIndex];
          const prevTimeout = timeoutsRef.get(existing.id);
          if (prevTimeout) {
            clearTimeout(prevTimeout);
          }

          if (duration > 0) {
            const newTimeout = setTimeout(() => {
              removeToast(existing.id);
            }, duration);
            timeoutsRef.set(existing.id, newTimeout);
          }

          const updated = [...prev];
          updated[existingIndex] = {
            ...existing,
            duration,
            // Refreshed too: the same message can reappear with a different
            // destination, and a stale closure would send the reader nowhere.
            action,
            shakeKey: Date.now(),
          };
          return updated;
        }

        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastItem = { id, type, title, message, duration, action, shakeKey: 0 };

        if (duration > 0) {
          const newTimeout = setTimeout(() => {
            removeToast(id);
          }, duration);
          timeoutsRef.set(id, newTimeout);
        }

        return [...prev, newToast];
      });
    },
    [removeToast, timeoutsRef]
  );

  const toast = {
    success: (message: string, title?: string, action?: ToastAction) =>
      addToast({ type: 'success', message, title, action }),
    error: (message: string, title?: string, action?: ToastAction) =>
      addToast({ type: 'error', message, title, action }),
    info: (message: string, title?: string, action?: ToastAction) =>
      addToast({ type: 'info', message, title, action }),
    warning: (message: string, title?: string, action?: ToastAction) =>
      addToast({ type: 'warning', message, title, action }),
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
