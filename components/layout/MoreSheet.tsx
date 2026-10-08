'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, LogOut, User as UserIcon, HelpCircle, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { getVisibleNavItems, isNavItemActive, type NavItem } from '@/lib/nav';
import { useInbox } from '@/lib/contexts/inbox-context';
import { useAuth, usePlan } from '@/lib/contexts/user-settings-context';
import { signOutAndRedirect } from '@/lib/auth/sign-out';
import { useToast } from '@/lib/hooks/use-toast';

/** Already reachable from a dedicated dock slot, so they are not repeated here. */
const DOCK_ROUTE_HREFS = new Set(['/', '/subscriptions', '/renewals']);

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useInbox();
  const { isAdmin } = useAuth();
  const { isPlus } = usePlan();
  const { toast } = useToast();

  const visibleNavItems = useMemo(() => getVisibleNavItems(isAdmin), [isAdmin]);
  const inboxItem = useMemo(
    () => visibleNavItems.find((item) => item.href === '/inbox'),
    [visibleNavItems],
  );
  const otherItems = useMemo(
    () =>
      visibleNavItems.filter(
        (item) => item.href !== '/inbox' && !DOCK_ROUTE_HREFS.has(item.href),
      ),
    [visibleNavItems],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  /**
   * A group defaults to open when the current route lives inside it, so the
   * sheet never opens showing a collapsed section that contains the active
   * page. Deriving that default rather than syncing it in an effect avoids
   * both a cascading render and a stale-state window.
   */
  const isGroupOpen = (item: NavItem) =>
    openGroups[item.href] ??
    Boolean(item.children && isNavItemActive(pathname, item.href));

  const handleSignOut = async () => {
    // Clears the caches and performs a hard navigation to /login itself, so there
    // is no client-side push here — see lib/auth/sign-out.ts for why.
    const ok = await signOutAndRedirect();

    if (ok) {
      onClose();
      return;
    }

    /* No redirect on failure: the cookie survives, so /login would bounce back
       to the dashboard and the tap would appear to do nothing. */
    toast.error('Could not sign you out. Please try again.', 'Sign Out Failed');
  };

  const closeThen = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const renderRow = (item: NavItem, badge?: number) => {
    const active = isNavItemActive(pathname, item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 min-h-[52px] px-3 rounded-xl transition-colors ${
          active
            ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
            : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] font-medium'
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 ${active ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`}
          aria-hidden="true"
        />
        <span className="flex-1 min-w-0 truncate">{item.name}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#14B8A6] text-[#091512] tabular-nums">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      id="more-sheet-panel"
      placement="bottom"
      size="lg"
      title="More"
    >
      <div className="space-y-1 pb-2">
        {/* Inbox is pinned first: it lost its dock slot, so this is now the
            only always-visible way into it from the bottom of the screen. */}
        {inboxItem && (
          <div className="pb-2 mb-1 border-b border-[#1A1D1D]">
            {renderRow(inboxItem, unreadCount)}
          </div>
        )}

        {otherItems.map((item) => {
          if (!item.children) return renderRow(item);

          const isExpanded = isGroupOpen(item);
          const isParentActive = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <div key={item.href} className="space-y-1">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [item.href]: !isExpanded }))
                }
                aria-expanded={isExpanded}
                aria-label={`Toggle ${item.name} submenu`}
                className={`w-full flex items-center gap-3 min-h-[52px] px-3 rounded-xl transition-colors cursor-pointer ${
                  isParentActive
                    ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
                    : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isParentActive ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 text-left truncate">{item.name}</span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
              </button>

              {isExpanded && (
                <div className="pl-4 ml-3 my-1 space-y-1 border-l border-[#1A1D1D]">
                  {item.children.map((child) => {
                    const childActive = isNavItemActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        aria-current={childActive ? 'page' : undefined}
                        className={`flex items-center min-h-[48px] px-3 rounded-lg text-xs transition-colors ${
                          childActive
                            ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold'
                            : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] font-medium'
                        }`}
                      >
                        <span className="truncate">{child.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="border-t border-[#1A1D1D] mt-3 pt-3 space-y-1">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 min-h-[52px] px-3 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] transition-colors font-medium"
          >
            <UserIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Profile</span>
          </Link>

          <Link
            href="/help"
            onClick={onClose}
            className="flex items-center gap-3 min-h-[52px] px-3 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] transition-colors font-medium"
          >
            <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Help</span>
          </Link>

          <Link
            href={
              isPlus
                ? '/settings?section=plan'
                : `/plans?from=${encodeURIComponent(pathname)}`
            }
            onClick={onClose}
            className="flex items-center gap-3 min-h-[52px] px-3 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] transition-colors font-medium"
          >
            <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isPlus ? 'Plus' : 'Upgrade Plan'}</span>
          </Link>

          <button
            type="button"
            onClick={closeThen(handleSignOut)}
            className="w-full flex items-center gap-3 min-h-[52px] px-3 rounded-xl text-[#D9363E] hover:bg-[#D9363E]/10 transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Log out</span>
          </button>

          <p className="pt-3 text-center text-[10px] text-[#5A6461] tabular-nums">
            build {process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown'}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

export default MoreSheet;
