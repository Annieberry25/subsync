'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

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
    if (user?.user_metadata?.full_name?.trim()) {
      return user.user_metadata.full_name.trim();
    }
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'Say Say';
  };

  const displayName = getDisplayName();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      {/* Left: 28px Greeting + 16px Subtitle */}
      <div>
        <h1
          style={{ fontSize: '28px', fontWeight: 700, lineHeight: '34px', color: '#FFFFFF' }}
          className="tracking-tight"
        >
          {greeting}, {displayName}.
        </h1>
        <p
          style={{ fontSize: '16px', fontWeight: 400, lineHeight: '24px', color: '#A1AAB8' }}
          className="mt-1.5 block"
        >
          {renewingThisWeekCount > 0
            ? `You have ${renewingThisWeekCount} renewal${renewingThisWeekCount > 1 ? 's' : ''} this week.`
            : 'All subscription renewals are up to date for this week.'}
        </p>
      </div>

      {/* Right: Date */}
      <div className="text-left sm:text-right shrink-0">
        <span
          style={{ fontSize: '15px', fontWeight: 500, lineHeight: '34px', color: '#A1AAB8' }}
          className="block"
        >
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
