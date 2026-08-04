'use client';

import { usePathname } from 'next/navigation';
import { Menu, Moon, Sun, Feather, Bell } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';

const routeTitles: Record<string, string> = {
  '/subscriptions': 'Subscriptions',
  '/export': 'Export & Analytics',
  '/settings': 'Settings',
};

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { theme, cycleTheme } = useTheme();

  const title = routeTitles[pathname];

  const themeIcon = {
    dark: <Moon className="w-5 h-5 text-indigo-400 transition-colors" />,
    ivory: <Sun className="w-5 h-5 text-amber-500 transition-colors" />,
    sand: <Feather className="w-5 h-5 text-amber-700 transition-colors" />,
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
        {title && (
          <h1 className="text-lg md:text-xl font-black text-env-heading tracking-tight">{title}</h1>
        )}
      </div>

      {/* Right: Standalone Compact Header Action Group */}
      <div className="flex items-center gap-4 sm:gap-5">
        {/* Standalone Themed Theme Icon Button */}
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Current theme: ${themeLabel}. Click to switch theme.`}
          title={`Theme: ${themeLabel}. Click to cycle between Midnight, Ivory, and Sand.`}
          className="p-2 transition-transform hover:scale-110 cursor-pointer rounded-xl flex items-center justify-center"
        >
          {themeIcon}
        </button>

        {/* Standalone Notification Bell Button (Reuses Shared Pending/Warning Color Token) */}
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications (3 unread)"
          className="relative p-2 text-env-status-warning hover:opacity-80 transition-all cursor-pointer rounded-xl flex items-center justify-center"
        >
          <Bell className="w-5 h-5 transition-colors" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-env-status-warning text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            3
          </span>
        </button>
      </div>
    </header>
  );
}
