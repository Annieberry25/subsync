'use client';

import { usePathname } from 'next/navigation';
import { Search, Plus, Bell, User } from 'lucide-react';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/subscriptions': 'Subscriptions',
  '/export': 'Export & Analytics',
  '/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const title = routeTitles[pathname] || 'SubSync';

  return (
    <header className="h-16 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-30 px-8 flex items-center justify-between">
      {/* Route Title */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative w-64 hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search subscriptions..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Add Subscription Quick Button */}
        <button
          type="button"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Subscription</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-zinc-800" />

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User Avatar Placeholder */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-zinc-800">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
