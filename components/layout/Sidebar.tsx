'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CreditCard, 
  Download, 
  Settings, 
  Zap,
  ShieldCheck,
  X
} from 'lucide-react';

export const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Export & Analytics', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Logo & Mobile Close */}
        <div className="p-6 border-b border-zinc-800/40 flex items-center justify-between">
          <Link href="/" onClick={onMobileClose} className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-current text-white" />
            </div>
            <div>
              <span className="font-black text-lg subsync-heading tracking-tight">SubSync</span>
              <span className="block text-[10px] subsync-muted font-bold tracking-widest uppercase">Manager</span>
            </div>
          </Link>

          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
              className="md:hidden p-1.5 rounded-xl text-env-muted hover:text-env-heading hover:bg-env-button-sec transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5" aria-label="Main Navigation">
          <div className="px-3 pb-2 text-[11px] font-extrabold subsync-muted uppercase tracking-widest">
            Menu
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 shadow-sm'
                    : 'subsync-subtitle hover:subsync-heading hover:bg-env-button-sec'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'subsync-muted'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Connection & Status Footer */}
      <div className="p-4 border-t border-env-main space-y-3">
        <div className="px-3 py-2.5 rounded-2xl bg-env-badge border border-env-main flex items-center gap-2.5 text-xs subsync-subtitle">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="subsync-heading font-semibold block">Supabase Connected</span>
            <span className="text-[10px] subsync-muted">RLS Active</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 glass-sidebar hidden md:flex flex-col h-screen sticky top-0 shrink-0 z-20">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden animate-in fade-in duration-150"
          onClick={onMobileClose}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-72 glass-sidebar h-full shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
