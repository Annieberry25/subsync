'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Home, CreditCard, CalendarClock, Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isNavItemActive, isFullPageRoute } from '@/lib/nav';

export type DockSlotKey = 'home' | 'subscriptions' | 'renewals' | 'more';

export interface DockSlot {
  key: DockSlotKey;
  label: string;
  /** Absent for the More slot, which opens a sheet instead of navigating. */
  href?: string;
  icon: LucideIcon;
  active: boolean;
}

const ROUTE_SLOTS: {
  key: Exclude<DockSlotKey, 'more'>;
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'subscriptions', label: 'Subs', href: '/subscriptions', icon: CreditCard },
  { key: 'renewals', label: 'Renewals', href: '/renewals', icon: CalendarClock },
];

/**
 * The dock is always exactly four slots wide.
 *
 * The first three are route destinations and the fourth opens the More sheet.
 * The count is fixed rather than derived from flags on purpose: a variable
 * slot count would make the bar reflow when a feature flag flips, and the
 * resulting target widths would stop being predictable. Feature-flag and role
 * gating therefore lives inside the More sheet's contents, not here.
 */
export function useDockItems() {
  const pathname = usePathname();

  return useMemo(() => {
    const visible = !isFullPageRoute(pathname);

    const routeSlots: DockSlot[] = ROUTE_SLOTS.map((slot) => ({
      ...slot,
      active: isNavItemActive(pathname, slot.href),
    }));

    const moreActive =
      !routeSlots.some((slot) => slot.active) && visible;

    const slots: DockSlot[] = [
      ...routeSlots,
      { key: 'more', label: 'More', icon: Ellipsis, active: moreActive },
    ];

    return { slots, visible };
  }, [pathname]);
}

export default useDockItems;
