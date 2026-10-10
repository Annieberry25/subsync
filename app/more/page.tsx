'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, LogOut, User as UserIcon, HelpCircle, Sparkles } from 'lucide-react';
import { getVisibleNavItems, isNavItemActive, type NavItem } from '@/lib/nav';
import { useAuth, usePlan } from '@/lib/contexts/user-settings-context';
import { signOutAndRedirect } from '@/lib/auth/sign-out';
import { useToast } from '@/lib/hooks/use-toast';
import ConfirmDialog from '@/components/ui/confirm-dialog';

/**
 * Routes that already have their own dock slot. Home, Subs, Renewals and Inbox
 * are always one tap away at the bottom of the screen, so repeating them here
 * would give the user two identical targets in one menu.
 */
const DOCK_ROUTE_HREFS = new Set(['/', '/subscriptions', '/renewals', '/inbox']);

export default function MorePage() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { isPlus } = usePlan();
  const { toast } = useToast();

  const otherItems = useMemo(
    () => getVisibleNavItems(isAdmin).filter((item) => !DOCK_ROUTE_HREFS.has(item.href)),
    [isAdmin],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  /**
   * A group defaults to open when the current route lives inside it, so the
   * page never opens showing a collapsed section that contains the active
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

    if (ok) return;

    /* No redirect on failure: the cookie survives, so /login would bounce back
       to the dashboard and the tap would appear to do nothing. */
    toast.error('Could not sign you out. Please try again.', 'Sign Out Failed');
  };

  const renderRow = (item: NavItem) => {
    const active = isNavItemActive(pathname, item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className="flex items-center gap-3.5 min-h-[56px] px-4 transition-colors hover:bg-[#121414]"
      >
        <Icon
          className={`w-5 h-5 shrink-0 ${active ? 'text-[#14B8A6]' : 'text-[#94A3B8]'}`}
          aria-hidden="true"
        />
        <span
          className={`flex-1 min-w-0 truncate text-sm ${active ? 'text-[#F5F7F6] font-semibold' : 'text-[#F5F7F6] font-medium'}`}
        >
          {item.name}
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
      </Link>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">More</h1>

      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden divide-y divide-[#1A1D1D]">
        {otherItems.map((item) => {
          if (!item.children) return renderRow(item);

          const isExpanded = isGroupOpen(item);
          const isParentActive = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <div key={item.href}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [item.href]: !isExpanded }))
                }
                aria-expanded={isExpanded}
                aria-label={`Toggle ${item.name} submenu`}
                className="w-full flex items-center gap-3.5 min-h-[56px] px-4 transition-colors hover:bg-[#121414] cursor-pointer"
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${isParentActive ? 'text-[#14B8A6]' : 'text-[#94A3B8]'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 text-left truncate text-sm text-[#F5F7F6] font-medium">
                  {item.name}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
                )}
              </button>

              {isExpanded && (
                <div className="pb-1.5">
                  {item.children.map((child) => {
                    const childActive = isNavItemActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={childActive ? 'page' : undefined}
                        className="flex items-center min-h-[44px] pl-12 pr-4 text-sm transition-colors hover:bg-[#121414]"
                      >
                        <span
                          className={`truncate ${childActive ? 'text-[#14B8A6] font-semibold' : 'text-[#94A3B8] font-medium'}`}
                        >
                          {child.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden divide-y divide-[#1A1D1D]">
        <Link
          href="/profile"
          className="flex items-center gap-3.5 min-h-[56px] px-4 transition-colors hover:bg-[#121414]"
        >
          <UserIcon className="w-5 h-5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
          <span className="flex-1 text-sm text-[#F5F7F6] font-medium">Profile</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
        </Link>

        <Link
          href="/help"
          className="flex items-center gap-3.5 min-h-[56px] px-4 transition-colors hover:bg-[#121414]"
        >
          <HelpCircle className="w-5 h-5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
          <span className="flex-1 text-sm text-[#F5F7F6] font-medium">Help</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
        </Link>

        <Link
          href={
            isPlus
              ? '/settings?section=plan'
              : `/plans?from=${encodeURIComponent(pathname)}`
          }
          className="flex items-center gap-3.5 min-h-[56px] px-4 transition-colors hover:bg-[#121414]"
        >
          <Sparkles className="w-5 h-5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
          <span className="flex-1 text-sm text-[#F5F7F6] font-medium">
            {isPlus ? 'Plus' : 'Upgrade Plan'}
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setShowSignOutConfirm(true)}
        className="w-full flex items-center gap-3.5 min-h-[56px] px-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] text-[#D9363E] hover:bg-[#D9363E]/10 transition-colors text-sm font-medium cursor-pointer"
      >
        <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span>Log out</span>
      </button>

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleSignOut}
        title="Log out?"
        description="You'll need to sign in again to access your subscriptions and reminders on this device."
        confirmText="Log out"
        cancelText="Stay signed in"
        variant="danger"
      />
    </div>
  );
}
