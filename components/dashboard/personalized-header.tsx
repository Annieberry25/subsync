'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

import { useUserSettings } from '@/lib/contexts/user-settings-context';

interface PersonalizedHeaderProps {
  onRefresh?: () => void;
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

function getFormattedDateString() {
  const d = new Date();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export function PersonalizedHeader({
  renewingThisWeekCount = 0,
}: PersonalizedHeaderProps) {
  const { fullName: contextFullName, email: contextEmail } = useUserSettings();
  const [user, setUser] = useState<User | null>(null);
  const [greeting] = useState<string>(getGreeting);
  const [formattedDate] = useState<string>(getFormattedDateString);

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, [supabase]);

  const getDisplayName = () => {
    if (contextFullName?.trim()) {
      return contextFullName.trim();
    }
    if (user?.user_metadata?.full_name?.trim()) {
      return user.user_metadata.full_name.trim();
    }
    const currentEmail = contextEmail || user?.email;
    if (currentEmail) {
      const emailName = currentEmail.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'Say Say';
  };

  const displayName = getDisplayName();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
      <h1 className="sr-only">Dashboard</h1>
      {/* Left: Greeting + Subtitle */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">
          {greeting}, {displayName}.
        </h2>
        <p className="text-xs sm:text-sm text-[#94A3B8] font-normal leading-relaxed mt-0.5 block">
          {renewingThisWeekCount > 0
            ? `You have ${renewingThisWeekCount} renewal${renewingThisWeekCount > 1 ? 's' : ''} this week.`
            : 'All subscription renewals are up to date for this week.'}
        </p>
      </div>

      {/* Right: Date */}
      <div className="text-left sm:text-right shrink-0">
        <span className="text-xs sm:text-sm md:text-[15px] font-medium text-[#94A3B8] leading-normal sm:leading-[34px] block">
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
