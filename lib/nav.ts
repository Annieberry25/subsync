import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CreditCard,
  CalendarClock,
  Receipt,
  Send,
  History as HistoryIcon,
  Clock,
  Archive,
  Trash2,
  RotateCcw,
  MessageCircle,
  Download,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { BILL_PAYMENT_ENABLED } from '@/lib/config/feature-flags';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /**
   * Present on accordion parents. The sidebar renders these nested; the More
   * sheet renders the same groups so both navigation systems stay identical.
   */
  children?: NavItem[];
  /** Where the parent navigates when tapped while collapsed. */
  defaultChildHref?: string;
}

export const billsSubItems: NavItem[] = [
  { name: 'Pay a Bill', href: '/bills/pay', icon: Send },
  { name: 'Payment History', href: '/bills/history', icon: HistoryIcon },
];

export const historySubItems: NavItem[] = [
  { name: 'Past Activity', href: '/history/all', icon: Clock },
  { name: 'Archive', href: '/history/archive', icon: Archive },
  { name: 'Deleted', href: '/history/deleted', icon: Trash2 },
  { name: 'Restored', href: '/history/restored', icon: RotateCcw },
];

/**
 * Single source of truth for primary navigation, shared by the desktop
 * sidebar and the mobile More sheet.
 *
 * `/renewals` is listed here even though it was historically absent from the
 * sidebar: it is reachable from the dashboard and the renewal spotlight, but
 * had no navigation entry of its own.
 */
export const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Renewals', href: '/renewals', icon: CalendarClock },
  { name: 'Bills & Payments', href: '/bills', icon: Receipt, children: billsSubItems, defaultChildHref: '/bills/pay' },
  { name: 'Inbox', href: '/inbox', icon: MessageCircle },
  { name: 'History', href: '/history', icon: HistoryIcon, children: historySubItems, defaultChildHref: '/history/all' },
  { name: 'Export & Analytics', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { name: 'Admin', href: '/admin', icon: ShieldCheck },
];

/**
 * A section is active when the path is the section root or lives beneath it.
 * The root path needs a special case, otherwise `startsWith('/')` matches
 * every route and Dashboard would read as active everywhere.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getVisibleNavItems(isAdmin: boolean): NavItem[] {
  const base = BILL_PAYMENT_ENABLED
    ? navItems
    : navItems.filter((item) => item.href !== '/bills');
  return isAdmin ? [...base, ...adminNavItems] : base;
}

/**
 * Routes that render without the app shell. The dock and sidebar must both
 * stay off these, since they carry their own centred layout.
 */
export const FULL_PAGE_ROUTES = ['/login', '/signup', '/plans'] as const;

export function isFullPageRoute(pathname: string): boolean {
  return (FULL_PAGE_ROUTES as readonly string[]).includes(pathname);
}
