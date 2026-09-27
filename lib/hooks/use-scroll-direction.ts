'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks whether the document is scrolling down, with a small threshold so
 * ordinary trackpad jitter and rubber-banding do not flicker the dock.
 *
 * Listens on `window` rather than a scroll container: `main` is deliberately
 * *not* a nested scroller (see AppShell), so the document is the only thing
 * that scrolls.
 */
export function useScrollDirection(threshold = 8) {
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const evaluate = () => {
      ticking = false;
      const currentY = Math.max(0, window.scrollY);

      if (currentY <= 0) {
        setAtTop(true);
        setDirection('up');
        lastY = currentY;
        return;
      }

      setAtTop(false);

      const delta = currentY - lastY;
      if (Math.abs(delta) >= threshold) {
        setDirection(delta > 0 ? 'down' : 'up');
        lastY = currentY;
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(evaluate);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return { direction, atTop };
}

export default useScrollDirection;
