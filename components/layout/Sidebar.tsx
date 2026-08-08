'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { 
  LayoutDashboard, 
  CreditCard, 
  Calendar,
  Download, 
  Settings, 
  Zap,
  Crown,
  ChevronDown,
  LogOut,
  User as UserIcon,
  X
} from 'lucide-react';

export const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Export & Analytics', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name?.trim();
  const userName = fullName || (user?.email ? user.email.split('@')[0] : 'Say Say');

  const getInitials = (name?: string): string | null => {
    if (!name || !name.trim()) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(fullName || (user ? '' : 'Say Say'));

  const content = (
    <div className="flex flex-col justify-between h-full bg-[#101215] overflow-y-auto">
      <div>
        {/* Brand Logo & Mobile Close (Clean "SubSync" without secondary MANAGER label) */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#2B313D]">
          <Link href="/" onClick={onMobileClose} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shrink-0">
              <Zap className="w-4 h-4 fill-current text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">SubSync</span>
          </Link>

          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
              className="lg:hidden w-11 h-11 rounded-xl text-[#A1AAB8] hover:text-white hover:bg-[#171A21] transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items with 12px Medium #6F7787 Uppercase Section Label */}
        <nav className="px-3 pt-4 pb-4 space-y-1" aria-label="Main Navigation">
          <div className="px-3 pb-2 text-[12px] font-medium text-[#6F7787] tracking-[0.08em] uppercase">
            Menu
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#4F46E5]/15 text-[#4F46E5] font-semibold'
                    : 'text-[#A1AAB8] hover:text-white hover:bg-[#171A21]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#4F46E5]' : 'text-[#6F7787]'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: Upgrade Card & User Profile */}
      <div className="px-3 pt-2 pb-5 space-y-3 mt-auto">
        {/* Go Premium Card */}
        <div className="p-2.5 rounded-xl border border-[#2B313D] bg-[#171A21] space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span className="font-medium text-[#A1AAB8] text-[11px] tracking-tight">Go Premium</span>
          </div>
          <p className="text-[11px] text-[#6F7787] leading-snug font-normal">
            Unlock advanced analytics & savings insights.
          </p>
          <button
            type="button"
            className="w-full py-1.5 px-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[11px] font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center min-h-[36px]"
          >
            Upgrade Now
          </button>
        </div>

        {/* User Profile Section */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User profile options"
            aria-expanded={showProfileMenu}
            className="w-full flex items-center justify-between p-2 rounded-xl border border-[#2B313D] bg-[#171A21] hover:border-[#4F46E5] transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : initials ? (
                <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#2B313D] flex items-center justify-center text-[#A1AAB8] shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-white tracking-tight truncate block">
                  {userName}
                </span>
                <span className="text-[11px] text-[#A1AAB8] truncate block">
                  {user?.email || 'saysay@example.com'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#6F7787] group-hover:text-white transition-colors shrink-0 ml-1" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-xl bg-[#171A21] border border-[#2B313D] shadow-lg z-50 animate-in fade-in duration-150"
              onClick={() => setShowProfileMenu(false)}
            >
              <Link
                href="/settings"
                onClick={onMobileClose}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#A1AAB8] hover:text-white hover:bg-[#2B313D] rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4 text-[#6F7787]" />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#EF4444]" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Compact 240px width - Visible on lg screens 1024px+) */}
      <aside className="w-[240px] bg-[#101215] border-r border-[#2B313D] hidden lg:flex flex-col h-screen sticky top-0 shrink-0 z-20">
        {content}
      </aside>

      {/* Mobile & Tablet Drawer Overlay (Active on screens < 1024px) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 lg:hidden animate-in fade-in duration-150"
          onClick={onMobileClose}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-[260px] max-w-[80vw] bg-[#101215] h-full shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
