'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Plus, User as UserIcon, LogOut, Menu, Moon, Sun, Feather } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useTheme } from '@/lib/hooks/use-theme';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/subscriptions': 'Subscriptions',
  '/export': 'Export & Analytics',
  '/settings': 'Settings',
};

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  onOpenNewSubscriptionModal?: () => void;
}

export default function Header({ onMobileMenuToggle, onOpenNewSubscriptionModal }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, cycleTheme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const title = routeTitles[pathname] || 'SubSync';

  const themeIcon = {
    dark: <Moon className="w-4 h-4 text-indigo-400" />,
    ivory: <Sun className="w-4 h-4 text-amber-600" />,
    sand: <Feather className="w-4 h-4 text-amber-700" />,
  }[theme];

  const themeLabel = {
    dark: 'Midnight',
    ivory: 'Ivory',
    sand: 'Sand',
  }[theme];

  return (
    <header className="glass-header h-16 sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between">
      {/* Left: Mobile Menu & Route Title */}
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            aria-label="Open navigation menu"
            className="md:hidden w-11 h-11 rounded-2xl text-env-body hover:text-env-heading hover:bg-env-button-sec transition-colors flex items-center justify-center cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg md:text-xl font-black text-env-heading tracking-tight">{title}</h1>
      </div>

      {/* Right: Header Actions */}
      <div className="flex items-center gap-2.5 md:gap-4">
        {/* Search Input */}
        <div className="relative w-48 lg:w-64 hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-env-muted" />
          <input
            type="text"
            placeholder="Search subscriptions..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-2xl border text-env-heading placeholder-env-muted focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Add Subscription Quick Button */}
        {onOpenNewSubscriptionModal && (
          <button
            type="button"
            onClick={onOpenNewSubscriptionModal}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Subscription</span>
          </button>
        )}

        {/* 3-Theme Cycle Button */}
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Current theme: ${themeLabel}. Click to switch theme.`}
          title={`Theme: ${themeLabel}. Click to cycle between Midnight, Ivory, and Sand.`}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover border border-env-main text-xs font-bold transition-all cursor-pointer"
        >
          {themeIcon}
          <span className="hidden sm:inline text-env-heading text-xs capitalize">{themeLabel}</span>
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-env-main" />

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="User profile menu"
            aria-expanded={showMenu}
            className="flex items-center justify-center w-11 h-11 text-left cursor-pointer group rounded-full"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-env-main group-hover:ring-indigo-500 transition-all shadow-md">
              <UserIcon className="w-4 h-4" />
            </div>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div 
              className="absolute right-0 mt-2 w-56 glass-panel rounded-3xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={() => setShowMenu(false)}
            >
              <div className="px-3.5 py-2.5 border-b border-env-main mb-1">
                <p className="text-xs font-bold text-env-heading truncate">
                  {user?.user_metadata?.full_name || 'SubSync User'}
                </p>
                <p className="text-[11px] text-env-muted truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
