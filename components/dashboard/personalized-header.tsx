'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useTheme } from '@/lib/hooks/use-theme';
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Sparkles,
  Moon,
  Sun,
  Sunset,
  Sparkle,
} from 'lucide-react';

interface PersonalizedHeaderProps {
  onRefresh: () => void;
  onAddSubscription?: () => void;
  loading?: boolean;
  renewingThisWeekCount?: number;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

function getFormattedDate() {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

export function PersonalizedHeader({
  onRefresh,
  loading = false,
  renewingThisWeekCount = 0,
}: PersonalizedHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [greeting] = useState<string>(getGreeting);
  const [formattedDate] = useState(getFormattedDate);
  const { theme } = useTheme();

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, [supabase]);

  const getDisplayName = () => {
    if (user?.user_metadata?.full_name?.trim()) {
      return user.user_metadata.full_name.trim();
    }
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'Subscriber';
  };

  const displayName = getDisplayName();

  return (
    <div className="glass-hero p-6 sm:p-8 md:p-10 rounded-3xl relative overflow-hidden shadow-2xl">
      {/* Subtle Ambient Background Reflections */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content & Controls Container */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
        {/* Left Side: Pill Badge, Greeting Title (First Visual Element), Subtext, & Renewals Status Bullet */}
        <div className="space-y-3.5 max-w-2xl">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-env-button-sec border border-env-main text-xs font-semibold text-env-accent shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recurring Financial Dashboard</span>
          </div>

          {/* Greeting Headline - First Visual Element on the Line */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-env-heading tracking-tight leading-tight">
            {greeting}, <span className="text-env-accent">{displayName}</span>
            <span className="inline-block text-xl sm:text-2xl ml-2 opacity-85 select-none">👋</span>
          </h2>

          {/* Sub-headline */}
          <p className="text-xs sm:text-sm text-env-body font-medium">
            Here&apos;s your subscription overview for today.
          </p>

          {/* Status Bullet */}
          <div className="flex items-center gap-2 text-xs text-env-body pt-0.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
            <span className="font-semibold text-env-heading">
              {renewingThisWeekCount > 0
                ? `You have ${renewingThisWeekCount} renewal${renewingThisWeekCount > 1 ? 's' : ''} this week.`
                : 'All subscription renewals are up to date for this week.'}
            </span>
          </div>
        </div>

        {/* Right Side: Date Display & Refresh Action */}
        <div className="flex items-center gap-2.5 shrink-0 self-start">
          <div className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl bg-env-button-sec border border-env-main text-xs font-bold text-env-heading shadow-sm">
            <CalendarIcon className="w-4 h-4 text-env-accent" />
            <span>{formattedDate}</span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover text-env-body hover:text-env-heading flex items-center justify-center border border-env-main transition-all cursor-pointer shadow-md shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Premium Decorative-Only Theme Illustration Positioned at Bottom Right */}
      <div
        className="absolute -bottom-2 right-4 md:right-8 lg:right-12 pointer-events-none select-none opacity-90 hidden sm:flex items-end justify-center z-0"
        aria-hidden="true"
      >
        {theme === 'dark' && (
          <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl" />
            <Moon className="w-16 h-16 md:w-20 md:h-20 text-indigo-300 drop-shadow-[0_0_24px_rgba(129,140,248,0.55)] transform -rotate-12" />
            <Sparkle className="w-4 h-4 text-purple-300 absolute top-2 right-4 animate-pulse" />
            <Sparkle className="w-3 h-3 text-indigo-400 absolute bottom-6 left-2 animate-pulse" />
          </div>
        )}

        {theme === 'ivory' && (
          <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center">
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl" />
            <Sun className="w-16 h-16 md:w-20 md:h-20 text-amber-500 drop-shadow-[0_0_24px_rgba(245,158,11,0.45)]" />
            <Sparkle className="w-4 h-4 text-amber-400 absolute top-2 right-4 animate-pulse" />
            <Sparkle className="w-3 h-3 text-amber-600 absolute bottom-6 left-2 animate-pulse" />
          </div>
        )}

        {theme === 'sand' && (
          <div className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl" />
            <Sunset className="w-16 h-16 md:w-20 md:h-20 text-amber-700 drop-shadow-[0_0_24px_rgba(194,65,12,0.45)]" />
            <Sparkle className="w-4 h-4 text-orange-400 absolute top-2 right-4 animate-pulse" />
            <Sparkle className="w-3 h-3 text-amber-800 absolute bottom-6 left-2 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
