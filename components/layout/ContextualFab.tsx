'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Receipt } from 'lucide-react';
import { useOverlayOpen } from '@/lib/hooks/use-overlay-open';
import { useScrollDirection } from '@/lib/hooks/use-scroll-direction';
import { isFullPageRoute } from '@/lib/nav';

interface FabAction {
  label: string;
  href: string;
  icon: typeof Plus;
}

const ROUTE_ACTIONS: { match: (pathname: string) => boolean; action: FabAction }[] = [
  {
    match: (p) => p === '/' || p.startsWith('/subscriptions') || p.startsWith('/renewals'),
    action: { label: 'Add subscription', href: '/subscriptions?add=true', icon: Plus },
  },
  {
    match: (p) => p.startsWith('/bills'),
    action: { label: 'Record payment', href: '/bills/pay', icon: Receipt },
  },
];

interface ContextualFabProps {
  /** Lets a page trigger the same action from its own UI, e.g. an empty state. */
  onAction?: () => void;
}

/**
 * Route-aware primary action, kept separate from the dock so navigation and
 * action never compete for the same floating surface.
 */
export function ContextualFab({ onAction }: ContextualFabProps) {
  const pathname = usePathname();
  const router = useRouter();
  const overlayOpen = useOverlayOpen();
  const { direction, atTop } = useScrollDirection();

  const entry = ROUTE_ACTIONS.find((candidate) => candidate.match(pathname));
  const hidden = !entry || isFullPageRoute(pathname) || overlayOpen;
  const collapsed = direction === 'down' && !atTop;

  const handleClick = useCallback(() => {
    if (onAction) {
      onAction();
      return;
    }
    if (entry) router.push(entry.action.href);
  }, [entry, onAction, router]);

  if (hidden) return null;

  const { label, icon: Icon } = entry.action;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      data-contextual-fab=""
      // Below the not-yet-migrated z-50 modals; moves to z-55 with the dock
      // once every overlay uses the Sheet primitive. See MobileDock.
      className={`fixed right-4 z-35 lg:hidden w-(--spacing-fab) h-(--spacing-fab) rounded-2xl bg-[#14B8A6] text-[#091512] flex items-center justify-center shadow-lg hover:bg-[#0D9488] active:scale-95 transition-all duration-300 ease-out ${
        collapsed
          ? 'translate-y-[calc(100%+var(--spacing-dock)+var(--spacing-safe-b)+2rem)] opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100'
      }`}
      style={{
        bottom: 'calc(var(--spacing-dock) + var(--spacing-safe-b) + 0.75rem)',
      }}
    >
      <Icon className="w-6 h-6" aria-hidden="true" />
    </button>
  );
}

export default ContextualFab;
