'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CreditCard, Building2, Plug, ShieldCheck } from 'lucide-react';

const tabs = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'Providers', href: '/admin/providers', icon: Building2 },
  { name: 'Integrations', href: '/admin/integrations', icon: Plug },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center">
          <ShieldCheck className="w-4.5 h-4.5 text-[#14B8A6]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#F5F7F6] tracking-tight">Admin Console</h1>
          <p className="text-xs text-[#94A3B8]">SubHalt operations, users, payments, and data.</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" aria-label="Admin sections">
        {tabs.map((tab) => {
          const isActive = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#1A1D1D]'
                  : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#14B8A6]' : 'text-[#94A3B8]'}`} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}