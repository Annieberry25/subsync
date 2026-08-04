'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useTheme } from '@/lib/hooks/use-theme';
import { 
  LayoutDashboard, 
  CreditCard, 
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
  const { theme } = useTheme();
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

  const premiumCardStyles = {
    dark: {
      cardBg: 'bg-gradient-to-b from-indigo-950/50 via-slate-900/80 to-slate-950/90 border-indigo-500/20 shadow-xl',
      title: 'text-white',
      desc: 'text-zinc-400',
      crown: 'text-amber-400 fill-amber-400/20',
    },
    ivory: {
      cardBg: 'bg-indigo-900/[0.06] border-indigo-400/25 shadow-sm',
      title: 'text-zinc-900 font-extrabold',
      desc: 'text-zinc-600',
      crown: 'text-amber-500 fill-amber-500/20',
    },
    sand: {
      cardBg: 'bg-amber-900/[0.08] border-amber-700/20 shadow-sm',
      title: 'text-amber-950 font-extrabold',
      desc: 'text-amber-900/75',
      crown: 'text-amber-600 fill-amber-600/20',
    },
  }[theme || 'dark'];

  const content = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Logo & Mobile Close */}
        <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between">
          <Link href="/" onClick={onMobileClose} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-3.5 h-3.5 fill-current text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-sm subsync-heading tracking-tight leading-none">SubSync</span>
              <span className="block text-[8px] subsync-muted font-bold tracking-normal uppercase leading-none mt-0.5">Manager</span>
            </div>
          </Link>

          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
              className="md:hidden w-7 h-7 rounded-lg text-env-muted hover:text-env-heading hover:bg-env-button-sec transition-colors flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="px-3 pt-1 pb-3 space-y-1" aria-label="Main Navigation">
          <div className="px-3 pb-0.5 text-[11px] font-extrabold subsync-muted uppercase tracking-widest">
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
                className={`flex items-center gap-2.5 px-3 py-1.5 min-h-[32px] rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 shadow-sm'
                    : 'subsync-subtitle hover:subsync-heading hover:bg-env-button-sec'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'subsync-muted'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: Go Premium Card & User Profile */}
      <div className="px-3 pt-2 pb-5 space-y-2.5 mt-auto">
        {/* Go Premium Card (Slimmer, Theme-Aware) */}
        <div className={`px-3 py-2.5 rounded-2xl border ${premiumCardStyles.cardBg} space-y-2 transition-colors duration-200`}>
          <div className="flex items-center gap-2">
            <Crown className={`w-4 h-4 ${premiumCardStyles.crown} shrink-0`} />
            <span className={`font-bold ${premiumCardStyles.title} text-xs tracking-tight`}>Go Premium</span>
          </div>
          <p className={`text-[11px] ${premiumCardStyles.desc} leading-snug font-normal`}>
            Unlock advanced analytics, savings insights and more.
          </p>
          <button
            type="button"
            className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/30 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center min-h-[32px]"
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
            className="w-full flex items-center justify-between p-1.5 rounded-2xl hover:bg-env-button-sec transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-env-main shrink-0"
                />
              ) : initials ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-extrabold ring-1 ring-env-main shrink-0">
                  {initials}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-env-button-sec border border-env-main flex items-center justify-center text-env-muted shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-env-heading tracking-tight truncate block">
                  {userName}
                </span>
                <span className="text-[11px] text-env-muted truncate block">
                  {user?.email || 'saysay@example.com'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-env-muted group-hover:text-env-heading transition-colors shrink-0 ml-1" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
              onClick={() => setShowProfileMenu(false)}
            >
              <Link
                href="/settings"
                onClick={onMobileClose}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
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
      {/* Desktop Sidebar (Slightly narrower: 242px instead of 256px) */}
      <aside className="w-[242px] glass-sidebar border-r border-zinc-800/20 hidden md:flex flex-col h-screen sticky top-0 shrink-0 z-20">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden animate-in fade-in duration-150"
          onClick={onMobileClose}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-[266px] max-w-[80vw] glass-sidebar h-full shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
