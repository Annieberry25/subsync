'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { BrandMark, BrandWordmark } from '@/components/ui/brand-logo';
import { signOutAndRedirect } from '@/lib/auth/sign-out';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth, usePlan } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import {
  getVisibleNavItems,
  isNavItemActive,
  type NavItem,
} from '@/lib/nav';
import { 
  ChevronDown,
  ChevronRight,
  LogOut,
  User as UserIcon,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export { navItems, billsSubItems, historySubItems, adminNavItems } from '@/lib/nav';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
const { fullName: contextFullName, email: contextEmail, isAdmin } = useAuth();
  const { isPlus } = usePlan();
  const { unreadCount } = useInbox();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const isBillsRoute = pathname.startsWith('/bills');
  const [isBillsOpen, setIsBillsOpen] = useState(isBillsRoute);

  // Auto-expand nav when landing on the section (render-phase adjustment).
  const [prevBillsRoute, setPrevBillsRoute] = useState(isBillsRoute);
  if (isBillsRoute !== prevBillsRoute) {
    setPrevBillsRoute(isBillsRoute);
    if (isBillsRoute) setIsBillsOpen(true);
  }

  const isHistoryRoute = pathname.startsWith('/history');
  const [isHistoryOpen, setIsHistoryOpen] = useState(isHistoryRoute);

  const [prevHistoryRoute, setPrevHistoryRoute] = useState(isHistoryRoute);
  if (isHistoryRoute !== prevHistoryRoute) {
    setPrevHistoryRoute(isHistoryRoute);
    if (isHistoryRoute) setIsHistoryOpen(true);
  }

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, [supabase]);

  // Click outside to close account profile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleSignOut = async () => {
    // Clears the caches and performs a hard navigation to /login itself, so there
    // is no client-side push here — see lib/auth/sign-out.ts for why.
    const ok = await signOutAndRedirect();

    if (ok) {
      setShowProfileMenu(false);
      return;
    }

    // Deliberately no redirect here: the session cookie is still valid, so
    // /login would immediately bounce back to the dashboard and the click would
    // look inert. Say what went wrong instead.
    toast.error('Could not sign you out. Please try again.', 'Sign Out Failed');
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const effectiveFullName =
    contextFullName?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.user_metadata?.name?.trim();
  const effectiveEmail = contextEmail || user?.email || '';
  /* No generic "User" fallback: when neither a name nor an email is available
     the row renders the email line alone rather than inventing an identity. */
  const userName = effectiveFullName || (effectiveEmail ? effectiveEmail.split('@')[0] : '');

  const getInitials = (name?: string): string | null => {
    if (!name || !name.trim()) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(effectiveFullName || userName);

  const visibleNavItems = getVisibleNavItems(isAdmin);


  const renderSubItems = (children: NavItem[]) => (
    <div className="pl-4 space-y-1 border-l border-[#1A1D1D] ml-5 my-1">
      {children.map((sub) => {
        const isSubActive = isNavItemActive(pathname, sub.href);

        return (
          <Link
            key={sub.href}
            href={sub.href}
            className={`flex items-center px-3 py-2 min-h-[44px] rounded-lg text-xs transition-all ${
              isSubActive
                ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold'
                : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0D] font-medium'
            }`}
          >
            <span className="truncate">{sub.name}</span>
          </Link>
        );
      })}
    </div>
  );

  const content = (collapsed: boolean) => (
    <div className="flex flex-col justify-between h-full bg-[#000000] overflow-y-auto overflow-x-hidden">
      <div>
        {/* Brand Logo. Collapsed rails show the mark alone; the wordmark is far
            too wide for the 76px rail and would be clipped to a sliver. */}
        <div className={`border-b border-[#121414] flex items-center ${collapsed ? 'justify-center px-0 pt-5 pb-4' : 'justify-between px-5 pt-5 pb-4'}`}>
          <Link
            href="/"
            title="SubHalt"
            aria-label="SubHalt home"
            className={`flex items-center group ${collapsed ? 'justify-center' : 'gap-3'}`}
          >
            {collapsed ? (
              <BrandMark size={32} priority />
            ) : (
              <BrandWordmark height={26} priority />
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className={`${collapsed ? 'px-2' : 'px-3'} pt-4 pb-4 space-y-1`} aria-label="Main Navigation">
          {visibleNavItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            // Accordion parents (Bills & Payments, History)
            if (item.children) {
              const isOpen =
                item.href === '/bills' ? isBillsOpen : isHistoryOpen;
              const setIsOpen =
                item.href === '/bills' ? setIsBillsOpen : setIsHistoryOpen;

              return (
                <div key={item.href} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapse?.();
                        return;
                      }
                      setIsOpen(!isOpen);
                      if (item.defaultChildHref && !isActive) {
                        router.push(item.defaultChildHref);
                      }
                    }}
                    aria-label={`Toggle ${item.name} submenu`}
                    title={item.name}
                    aria-expanded={isOpen}
                    className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2.5 min-h-[44px] rounded-xl text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
                        : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] font-medium'
                    }`}
                  >
                    <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`}
                        aria-hidden="true"
                      />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </div>
                    {!collapsed &&
                      (isOpen ? (
                        <ChevronDown className="w-4 h-4 text-[#F5F7F6] shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" aria-hidden="true" />
                      ))}
                  </button>

                  {!collapsed && isOpen && renderSubItems(item.children)}
                </div>
              );
            }

            // Regular navigation items
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.name}
                className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2.5 min-h-[44px] rounded-xl text-xs transition-colors ${
                  isActive
                    ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
                    : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] font-medium'
                }`}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center relative' : 'gap-3'}`}>
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                  {collapsed && item.href === '/inbox' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#14B8A6]" />
                  )}
                </div>
                {!collapsed && item.href === '/inbox' && unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#14B8A6] text-[#091512] shadow-sm tabular-nums">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: User Profile */}
      <div className={`${collapsed ? 'px-2' : 'px-3'} pt-2 pb-5 space-y-3 mt-auto`}>
        <div className="relative" ref={profileMenuRef}>
          {!collapsed && showProfileMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
              <Link
                href="/profile"
                onClick={() => setShowProfileMenu(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-[#94A3B8]" aria-hidden="true" />
                <span>Profile</span>
              </Link>

              <Link
                href="/help"
                onClick={() => setShowProfileMenu(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#94A3B8]" aria-hidden="true" />
                <span>Help</span>
              </Link>

              <Link
                href={
                  isPlus
                    ? '/settings?section=plan'
                    : `/plans?from=${encodeURIComponent(pathname)}`
                }
                onClick={() => setShowProfileMenu(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#94A3B8]" aria-hidden="true" />
                <span>{isPlus ? 'Plus' : 'Upgrade Plan'}</span>
              </Link>

              <div className="border-t border-[#1A1D1D]/70 my-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleSignOut();
                  }}
                  aria-label="Log out"
                  className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs font-medium text-[#D9363E] hover:bg-[#D9363E]/10 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (collapsed) {
                onToggleCollapse?.();
                return;
              }
              setShowProfileMenu(!showProfileMenu);
            }}
            aria-label="User profile options"
            title={collapsed ? userName || 'Account' : undefined}
            aria-expanded={!collapsed && showProfileMenu}
            className={`w-full ${collapsed ? 'flex items-center justify-center p-2' : 'flex items-center justify-between p-2.5'} rounded-xl border transition-colors text-left group cursor-pointer ${
              showProfileMenu
                ? 'border-[#3F3F46] bg-[#121414]'
                : 'border-[#1A1D1D] bg-[#0B0D0D] hover:border-[#3F3F46] hover:bg-[#121414]'
            }`}
          >
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={userName || 'Account'}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#14B8A6]/40"
                  unoptimized
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] text-xs font-bold shrink-0">
                  {initials || (userName ? userName.slice(0, 2).toUpperCase() : 'SU')}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  {userName && (
                    <span className="text-xs font-semibold text-[#F5F7F6] tracking-tight truncate block">
                      {userName}
                    </span>
                  )}
                  <span className="text-[11px] text-[#94A3B8] truncate block">
                    {effectiveEmail}
                  </span>
                </div>
              )}
            </div>
            {!collapsed && (
              <ChevronDown
                className={`w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] transition-transform duration-200 shrink-0 ml-1 ${
                  showProfileMenu ? 'rotate-180 text-[#F5F7F6]' : ''
                }`}
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <aside
      className={`relative bg-[#000000] border-r border-[#1A1D1D] hidden lg:flex flex-col h-[100dvh] sticky top-0 shrink-0 z-20 transition-[width] duration-300 ease-in-out ${
        isCollapsed ? 'w-[76px]' : 'w-[240px]'
      }`}
    >
      {content(isCollapsed)}

      {/* Collapse / Expand Toggle Handle */}
      <button
        type="button"
        onClick={() => onToggleCollapse?.()}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-[13px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#0B0D0D] border border-[#1A1D1D] hover:border-[#14B8A6] text-[#94A3B8] hover:text-[#14B8A6] flex items-center justify-center transition-colors z-30 cursor-pointer"
      >
        {isCollapsed ? (
          <PanelLeftOpen className="w-3.5 h-3.5" />
        ) : (
          <PanelLeftClose className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
