import { LayoutDashboard, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/50 via-zinc-900 to-zinc-900 border border-indigo-500/20 p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Milestone 1 Complete</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome to SubSync Manager
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your Supabase backend database, Row Level Security policies, and application shell layout are fully connected and active.
          </p>
          <div className="pt-2 flex items-center gap-4">
            <Link
              href="/subscriptions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              <span>Explore Subscriptions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Placeholder Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Recurring Spend', value: '$0.00', change: 'Database Ready' },
          { label: 'Annual Total Spend', value: '$0.00', change: 'Database Ready' },
          { label: 'Active Subscriptions', value: '0', change: 'RLS Isolated' },
          { label: 'Upcoming Renewals', value: '0', change: 'Next 30 Days' },
        ].map((card, i) => (
          <div
            key={i}
            className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 hover:border-zinc-700/60 transition-colors"
          >
            <span className="text-xs font-medium text-zinc-500 block">{card.label}</span>
            <span className="text-2xl font-bold text-white block">{card.value}</span>
            <span className="text-[11px] text-emerald-400 font-medium">{card.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
