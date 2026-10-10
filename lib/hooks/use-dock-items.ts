'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Home, CreditCard, CalendarClock, MessageCircle, Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isNavItemActive, isFullPageRoute } from '@/lib/nav';

export type DockSlotKey = 'home' | 'subscriptions' | 'renewals' | 'inbox' | 'more';

export interface DockSlot {
  key: DockSlotKey;
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
}

const PRIMARY_SLOTS: {
  key: Exclude<DockSlotKey, 'more'>;
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'subscriptions', label: 'Subs', href: '/subscriptions', icon: CreditCard },
  { key: 'renewals', label: 'Renewals', href: '/renewals', icon: CalendarClock },
  { key: 'inbox', label: 'Inbox', href: '/inbox', icon: MessageCircle },
];

/**
 * The dock is always exactly five slots wide.
 *
 * The first four are top-level destinations and the fifth routes to the full
 * More page. The count is fixed rather than derived from flags on purpose: a
 * variable slot count would make the bar reflow when a feature flag flips, and
 * the resulting target widths would stop being predictable.
 *
 * More also acts as the active fallback for every route it owns (Profile,
 * Settings, History, Bills, Export), so the bar never reads as having nothing
 * selected while the user is somewhere under More.
 */
export function useDockItems() {
  const pathname = usePathname();

  return useMemo(() => {
    const visible = !isFullPageRoute(pathname);

    const routeSlots: DockSlot[] = PRIMARY_SLOTS.map((slot) => ({
      ...slot,
      active: isNavItemActive(pathname, slot.href),
    }));

    const moreActive = !routeSlots.some((slot) => slot.active) && visible;

    const slots: DockSlot[] = [
      ...routeSlots,
      { key: 'more', label: 'More', href: '/more', icon: Ellipsis, active: moreActive },
    ];

    return { slots, visible };
  }, [pathname]);
}

export default useDockItems;
