import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  safeParseJSON,
  safeSetJSON,
  clearLocalStorage,
} from '@/lib/safe-local-storage';

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('safeSetItem / safeGetItem', () => {
  it('round-trips a value', () => {
    expect(safeSetItem('k', 'v')).toBe(true);
    expect(safeGetItem('k')).toBe('v');
  });

  it('returns false when localStorage.setItem throws (quota exceeded)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(safeSetItem('k', 'v')).toBe(false);
    spy.mockRestore();
  });

  it('returns null when localStorage.read fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(safeGetItem('k')).toBeNull();
    spy.mockRestore();
  });
});

describe('safeRemoveItem', () => {
  it('removes a key', () => {
    safeSetItem('k', 'v');
    expect(safeRemoveItem('k')).toBe(true);
    expect(safeGetItem('k')).toBeNull();
  });
});

describe('safeParseJSON / safeSetJSON', () => {
  it('parses stored JSON', () => {
    safeSetJSON('obj', { a: 1 });
    expect(safeParseJSON('obj', {})).toEqual({ a: 1 });
  });

  it('returns fallback for a missing key', () => {
    expect(safeParseJSON('nope', 42)).toBe(42);
  });

  it('returns fallback when stored value is invalid JSON', () => {
    window.localStorage.setItem('bad', '{not json');
    expect(safeParseJSON<number>('bad', 7)).toBe(7);
  });
});

describe('clearLocalStorage', () => {
  it('clears all keys', () => {
    safeSetItem('a', '1');
    safeSetItem('b', '2');
    clearLocalStorage();
    expect(safeGetItem('a')).toBeNull();
    expect(safeGetItem('b')).toBeNull();
  });
});
