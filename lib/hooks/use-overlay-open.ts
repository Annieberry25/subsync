'use client';

import { useEffect, useState } from 'react';

const ATTRIBUTE = 'data-overlay-open';

/**
 * True while any overlay (sheet, dialog, drawer) is open.
 *
 * Floating UI — the dock and the FAB — subscribes to this so it steps out of
 * the way instead of showing through a modal backdrop. The source of truth is
 * the `data-overlay-open` attribute that `components/ui/sheet.tsx` maintains
 * from its scroll-lock reference count, so nested overlays are handled by the
 * same counter rather than a second, separately-maintained registry.
 */
export function useOverlayOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setOpen(root.hasAttribute(ATTRIBUTE));

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [ATTRIBUTE],
    });

    return () => observer.disconnect();
  }, []);

  return open;
}

export default useOverlayOpen;
