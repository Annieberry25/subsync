'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Calendar as CalendarIcon, RefreshCw, Plus, Sparkles } from 'lucide-react';

interface PersonalizedHeaderProps {
  onRefresh: () => void;
  onAddSubscription: () => void;
  loading?: boolean;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate() {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

export function PersonalizedHeader({ onRefresh, onAddSubscription, loading = false }: PersonalizedHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [greeting] = useState(getGreeting);
  const [formattedDate] = useState(getFormattedDate);

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, [supabase]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Subscriber';

  return (
    <div className="glass-hero p-5 sm:p-7 md:p-10 rounded-3xl relative overflow-hidden space-y-5 sm:space-y-6 shadow-2xl">
      {/* Subtle Ambient Reflections */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 relative z-10">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-env-button-sec border border-env-main text-xs font-semibold text-env-accent">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recurring Financial Dashboard</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-env-heading tracking-tight leading-tight">
            {greeting}, <span className="text-env-accent">{userName}</span> 👋
          </h2>

          <p className="text-xs sm:text-sm text-env-body leading-relaxed">
            Track, analyze, and optimize your recurring subscriptions in one calm, unified workspace.
          </p>
        </div>

        {/* Controls & Quick Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 w-full lg:w-auto">
          <div className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl bg-env-button-sec border border-env-main text-xs font-semibold text-env-body shadow-sm flex-1 sm:flex-initial justify-center">
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

          <button
            type="button"
            onClick={onAddSubscription}
            className="flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3 min-h-[44px] w-full sm:w-auto rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Subscription</span>
          </button>
        </div>
      </div>
    </div>
  );
}
