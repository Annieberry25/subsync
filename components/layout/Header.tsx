'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/ui/brand-logo';
import { useInbox } from '@/lib/contexts/inbox-context';
import { useSettings } from '@/lib/contexts/user-settings-context';

interface HeaderProps {
  hasUnreadNotifications?: boolean;
  onOpenAskSubHalt?: () => void;
}

export default function Header({ hasUnreadNotifications, onOpenAskSubHalt }: HeaderProps) {
  const pathname = usePathname();
  const { unreadCount } = useInbox();
  const { assistantName: _assistantName } = useSettings();
  const showUnread = Boolean(hasUnreadNotifications || unreadCount > 0);
  const isInboxRoute = pathname.startsWith('/inbox');

  return (
    <header className="glass-header sticky top-0 z-30 px-(--spacing-gutter) md:px-8 flex items-center justify-between bg-[#000000] h-[calc(3.5rem+var(--spacing-safe-t))] sm:h-[calc(4rem+var(--spacing-safe-t))] pt-[var(--spacing-safe-t)]">
      {/*
        The hamburger is gone below `lg`, replaced by the floating dock. The
        sidebar that normally carries the SubHalt brand is hidden at these
        widths, so the brand moves here rather than leaving the corner empty.
        The mark rather than the wordmark: on a phone the header has to share
        its row with the notification and Ask buttons, and the full wordmark
        crowds them out.
      */}
      <Link
        href="/"
        aria-label="SubHalt home"
        className="lg:hidden shrink-0 flex items-center"
      >
        <BrandMark size={30} priority />
      </Link>
      <div className="hidden lg:block" />

      {/* Right: Notification Icon connecting to Inbox & Ask SubHalt AI launcher */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onOpenAskSubHalt && (
          <button
            type="button"
            onClick={onOpenAskSubHalt}
            className="px-3 sm:px-3.5 py-1.5 min-h-[44px] rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="hidden sm:inline">Ask SubHalt Assistant</span>
            <span className="sm:hidden">Ask SubHalt</span>
          </button>
        )}

        {/*
          The bell is the primary route into the Inbox now that Inbox no longer
          has a dock slot, so it carries a count rather than a bare dot.
        */}
        {!isInboxRoute && showUnread && (
          <Link
            href="/inbox"
            aria-label={`Notifications (${unreadCount} unread items)`}
            title={`Inbox (${unreadCount} unread items)`}
            className="relative p-2 -mr-2 text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] transition-colors cursor-pointer rounded-xl flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <Bell className="w-5 h-5 text-[#94A3B8]" aria-hidden="true" />
            <span className="absolute top-1 right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-[#14B8A6] text-[#091512] text-[10px] font-bold flex items-center justify-center tabular-nums pointer-events-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
