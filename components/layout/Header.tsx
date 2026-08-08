'use client';

import { usePathname } from 'next/navigation';
import { Menu, Bell } from 'lucide-react';

const routeTitles: Record<string, string> = {
  '/subscriptions': 'Subscriptions',
  '/export': 'Export & Analytics',
  '/settings': 'Settings',
};

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  hasUnreadNotifications?: boolean;
}

export default function Header({ onMobileMenuToggle, hasUnreadNotifications = false }: HeaderProps) {
  const pathname = usePathname();
  const title = routeTitles[pathname];

  if (!title && !hasUnreadNotifications) {
    return (
      <header className="lg:hidden glass-header h-14 sticky top-0 z-30 px-3 sm:px-4 flex items-center justify-between bg-[#101215]">
        <div className="flex items-center gap-2.5">
          {onMobileMenuToggle && (
            <button
              type="button"
              onClick={onMobileMenuToggle}
              aria-label="Open navigation menu"
              className="w-11 h-11 rounded-xl text-[#A1AAB8] hover:text-white hover:bg-[#171A21] transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="glass-header h-14 sm:h-16 sticky top-0 z-30 px-3 sm:px-6 md:px-8 flex items-center justify-between bg-[#101215]">
      {/* Left: Mobile Menu & Route Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            aria-label="Open navigation menu"
            className="lg:hidden w-11 h-11 rounded-xl text-[#A1AAB8] hover:text-white hover:bg-[#171A21] transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px] shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {title && (
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-white tracking-tight leading-none truncate">{title}</h1>
        )}
      </div>

      {/* Right: Functional Notification Icon (Only displayed if unread notifications exist) */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {hasUnreadNotifications && (
          <button
            type="button"
            aria-label="Notifications"
            title="Notifications (Unread items)"
            className="relative p-2 text-[#A1AAB8] hover:text-white transition-colors cursor-pointer rounded-xl flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <Bell className="w-5 h-5 text-[#A1AAB8]" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#F59E0B]" />
          </button>
        )}
      </div>
    </header>
  );
}
