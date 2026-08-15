'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import { 
  LayoutDashboard, 
  CreditCard, 
  Download, 
  Settings, 
  History as HistoryIcon,
  Archive,
  Trash2,
  RotateCcw,
  Zap,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  LogOut,
  User as UserIcon,
  X,
  Inbox as InboxIcon,
  Clock,
  HelpCircle
} from 'lucide-react';

export const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
  { name: 'History', href: '/history', icon: HistoryIcon },
  { name: 'Export & Analytics', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const historySubItems = [
  { name: 'Past Activity', href: '/history/all', icon: Clock },
  { name: 'Archive', href: '/history/archive', icon: Archive },
  { name: 'Deleted', href: '/history/deleted', icon: Trash2 },
  { name: 'Restored', href: '/history/restored', icon: RotateCcw },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { fullName: contextFullName, email: contextEmail, isPlus } = useUserSettings();
  const { unreadCount } = useInbox();
  const [user, setUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const isHistoryRoute = pathname.startsWith('/history');
  const [isHistoryOpen, setIsHistoryOpen] = useState(isHistoryRoute);

  useEffect(() => {
    if (isHistoryRoute) {
      setIsHistoryOpen(true);
    }
  }, [isHistoryRoute]);

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
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const effectiveFullName = contextFullName?.trim() || user?.user_metadata?.full_name?.trim();
  const effectiveEmail = contextEmail || user?.email || '';
  const userName = effectiveFullName || (effectiveEmail ? effectiveEmail.split('@')[0] : 'User');

  const getInitials = (name?: string): string | null => {
    if (!name || !name.trim()) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(effectiveFullName || userName);

  const content = (
    <div className="flex flex-col justify-between h-full bg-[#000000] overflow-y-auto">
      <div>
        {/* Brand Logo & Mobile Close */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#121414]">
          <Link href="/" onClick={onMobileClose} className="flex items-center gap-3 group">
            <span className="font-bold text-lg text-[#14B8A6] tracking-tight">SubHalt</span>
          </Link>

          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
              className="lg:hidden w-11 h-11 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="px-3 pt-4 pb-4 space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            if (item.name === 'History') {
              const isParentActive = pathname.startsWith('/history');
              const Icon = item.icon;

              return (
                <div key={item.name} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                    aria-label="Toggle History submenu"
                    aria-expanded={isHistoryOpen}
                    className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs transition-colors cursor-pointer ${
                      isParentActive
                        ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
                        : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isParentActive ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`} />
                      <span>History</span>
                    </div>
                    {isHistoryOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#F5F7F6]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                    )}
                  </button>

                  {/* Submenu Children */}
                  {isHistoryOpen && (
                    <div className="pl-4 space-y-1 border-l border-[#1A1D1D] ml-5 my-1">
                      {historySubItems.map((sub) => {
                        const isSubActive =
                          pathname === sub.href ||
                          (sub.href === '/history/all' && (pathname === '/history' || pathname === '/history/'));

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onMobileClose}
                            className={`flex items-center px-3 py-2 min-h-[38px] rounded-lg text-xs transition-all ${
                              isSubActive
                                ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold'
                                : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] font-medium'
                            }`}
                          >
                            <span>{sub.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs transition-colors ${
                  isActive
                    ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
                    : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`} />
                  <span>{item.name}</span>
                </div>
                {item.name === 'Inbox' && unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#14B8A6] text-[#091512] shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: User Profile */}
      <div className="px-3 pt-2 pb-5 space-y-3 mt-auto">
        {/* User Profile Section with Expandable Account Menu */}
        <div className="relative" ref={profileMenuRef}>
          {/* SaaS Style Account Popover Menu */}
          {showProfileMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
              <Link
                href="/profile"
                onClick={() => {
                  setShowProfileMenu(false);
                  onMobileClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-[#94A3B8]" />
                <span>Profile</span>
              </Link>

              <Link
                href="/help"
                onClick={() => {
                  setShowProfileMenu(false);
                  onMobileClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#94A3B8]" />
                <span>Help</span>
              </Link>

              <Link
                href={`/plans?from=${encodeURIComponent(pathname)}`}
                onClick={() => {
                  setShowProfileMenu(false);
                  onMobileClose?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
              >
                <ArrowUpCircle className="w-4 h-4 text-[#94A3B8]" />
                <span>Upgrade Plan</span>
              </Link>

              <div className="border-t border-[#1A1D1D]/70 my-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-[#94A3B8]" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}

          {/* User Profile Card Button */}
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User profile options"
            aria-expanded={showProfileMenu}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-colors text-left group cursor-pointer ${
              showProfileMenu
                ? 'border-[#3F3F46] bg-[#121414]'
                : 'border-[#1A1D1D] bg-[#0B0D0D] hover:border-[#3F3F46] hover:bg-[#121414]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#14B8A6]/40"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] text-xs font-bold shrink-0">
                  {initials || (userName ? userName.slice(0, 2).toUpperCase() : 'SU')}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-[#F5F7F6] tracking-tight truncate block">
                  {userName}
                </span>
                <span className="text-[11px] text-[#94A3B8] truncate block">
                  {effectiveEmail}
                </span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] transition-transform duration-200 shrink-0 ml-1 ${showProfileMenu ? 'rotate-180 text-[#F5F7F6]' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Compact 240px width - Visible on lg screens 1024px+) */}
      <aside className="w-[240px] bg-[#000000] border-r border-[#1A1D1D] hidden lg:flex flex-col h-screen sticky top-0 shrink-0 z-20">
        {content}
      </aside>

      {/* Mobile & Tablet Drawer Overlay (Active on screens < 1024px) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/85 z-50 lg:hidden animate-in fade-in duration-150"
          onClick={onMobileClose}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-[260px] max-w-[80vw] bg-[#000000] h-full shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
