'use client';

import { Menu, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInbox } from '@/lib/contexts/inbox-context';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  hasUnreadNotifications?: boolean;
  onOpenAskSubHalt?: () => void;
}

export default function Header({ onMobileMenuToggle, hasUnreadNotifications, onOpenAskSubHalt }: HeaderProps) {
  const pathname = usePathname();
  const { unreadCount } = useInbox();
  const { assistantName } = useUserSettings();
  const showUnreadDot = Boolean(hasUnreadNotifications || unreadCount > 0);
  const isInboxRoute = pathname.startsWith('/inbox');

  return (
    <header className="glass-header h-14 sm:h-16 sticky top-0 z-30 px-3 sm:px-6 md:px-8 flex items-center justify-between bg-[#000000]">
      {/* Left: Mobile Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            aria-label="Open navigation menu"
            className="lg:hidden w-11 h-11 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px] shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Right: Functional Notification Icon connecting to Inbox & Ask SubHalt AI launcher */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onOpenAskSubHalt && (
          <button
            type="button"
            onClick={onOpenAskSubHalt}
            className="px-3.5 py-1.5 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <SubHaltAvatar size="sm" />
            <span className="hidden sm:inline">Ask SubHalt Assistant</span>
            <span className="sm:hidden">Ask AI</span>
          </button>
        )}

        {!isInboxRoute && showUnreadDot && (
          <Link
            href="/inbox"
            aria-label={`Notifications (${unreadCount} unread items)`}
            title={`Inbox (${unreadCount} unread items)`}
            className="relative p-2 text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F] transition-colors cursor-pointer rounded-xl flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <Bell className="w-5 h-5 text-[#94A3B8]" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#14B8A6]" />
          </Link>
        )}
      </div>
    </header>
  );
}
