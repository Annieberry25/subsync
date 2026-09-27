'use client';

import { useEffect, useState } from 'react';

/**
 * Reads the device safe-area insets into a plain object.
 *
 * CSS already exposes these as `--spacing-safe-*` (see globals.css) and that
 * is what the dock, FAB and sheet padding use. This hook exists for the cases
 * CSS cannot express, such as deciding in JavaScript whether the software
 * keyboard has eaten the bottom inset.
 *
 * `visualViewport` is polled via `resize` because iOS does not fire it when
 * the URL bar collapses.
 */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function readInsets(): SafeAreaInsets {
  if (typeof window === 'undefined') return ZERO;

  const styles = window.getComputedStyle(document.documentElement);
  const read = (name: string) => {
    const value = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(value) ? value : 0;
  };

  return {
    top: read('--spacing-safe-t'),
    right: read('--spacing-safe-r'),
    bottom: read('--spacing-safe-b'),
    left: read('--spacing-safe-l'),
  };
}

export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(ZERO);

  useEffect(() => {
    const update = () => setInsets(readInsets());

    // `env()` is not readable during SSR, so the first client read is the
    // earliest point the real values exist.
    update();

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return insets;
}

export default useSafeArea;
