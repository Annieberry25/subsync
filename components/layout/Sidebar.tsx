'use me';
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CreditCard, 
  Download, 
  Settings, 
  Zap,
  ShieldCheck
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Export & Analytics', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between h-screen sticky top-0 text-zinc-300">
      <div>
        {/* Brand Logo */}
        <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">SubSync</span>
              <span className="block text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Manager</span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Menu
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Connection & User Footer */}
      <div className="p-4 border-t border-zinc-800/60 space-y-3">
        {/* Supabase RLS Status Badge */}
        <div className="px-3 py-2.5 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="text-zinc-200 font-medium block">Supabase Connected</span>
            <span className="text-[10px] text-zinc-500">RLS Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
