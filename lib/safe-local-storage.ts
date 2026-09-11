import { logger } from '@/lib/logger';

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    logger.warn('[safe-local-storage] write failed (possibly quota exceeded)', {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    logger.warn('[safe-local-storage] read failed', {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function safeRemoveItem(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    logger.warn('[safe-local-storage] remove failed', {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function safeParseJSON<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    logger.warn('[safe-local-storage] parse error for key', {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

export function safeSetJSON(key: string, value: unknown): boolean {
  return safeSetItem(key, JSON.stringify(value));
}

export function clearLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.clear();
  } catch (err) {
    logger.warn('[safe-local-storage] clear failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
