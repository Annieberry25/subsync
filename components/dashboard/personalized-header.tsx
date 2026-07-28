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

export function PersonalizedHeader({ onRefresh, onAddSubscription, loading = false }: PersonalizedHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [greeting, setGreeting] = useState('Welcome back');
  const [formattedDate, setFormattedDate] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    loadUser();

    // Time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    // Current date
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    setFormattedDate(new Date().toLocaleDateString('en-US', options));
  }, [supabase]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Subscriber';

  return (
    <div className="glass-hero p-8 md:p-10 rounded-3xl relative overflow-hidden space-y-6 shadow-2xl">
      {/* Subtle Ambient Reflections */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-env-button-sec border border-env-main text-xs font-semibold text-env-accent">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recurring Financial Dashboard</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-env-heading tracking-tight leading-tight">
            {greeting}, <span className="text-env-accent">{userName}</span> 👋
          </h2>

          <p className="text-sm text-env-body leading-relaxed">
            Track, analyze, and optimize your recurring subscriptions in one calm, unified workspace.
          </p>
        </div>

        {/* Controls & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-env-button-sec border border-env-main text-xs font-semibold text-env-body shadow-sm">
            <CalendarIcon className="w-4 h-4 text-env-accent" />
            <span>{formattedDate}</span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
            className="w-11 h-11 rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover text-env-body hover:text-env-heading flex items-center justify-center border border-env-main transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onAddSubscription}
            className="flex items-center gap-2.5 px-6 py-3 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Subscription</span>
          </button>
        </div>
      </div>
    </div>
  );
}
