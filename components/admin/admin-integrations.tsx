'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, MessageSquare, Inbox as InboxIcon, ShieldCheck } from 'lucide-react';
import type { AdminOverview } from '@/lib/types/admin.types';
import { LoadingState, ErrorState } from '@/components/admin/admin-ui';

const CARDS = [
  {
    key: 'gmailConnections' as const,
    icon: Mail,
    label: 'Gmail Connections',
    describe: 'Users who authorized Gmail scanning. Tokens are stored server-side only and never returned by any client-facing endpoint.',
  },
  {
    key: 'aiConversations' as const,
    icon: MessageSquare,
    label: 'AI Conversations',
    describe: 'Chat history rows stored in ai_conversations. Each row is scoped to its owner via RLS.',
  },
  {
    key: 'inboxItems' as const,
    icon: InboxIcon,
    label: 'Inbox Items',
    describe: 'Items in the inbox feed. Owner-scoped via RLS.',
  },
];

export default function AdminIntegrationsTab() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load integration stats.');
        return;
      }
      setError(null);
      setOverview(data as AdminOverview);
    } catch {
      setError('Failed to load integration stats.');
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  if (error) return <ErrorState message={error} />;
  if (!overview) return <LoadingState label="Loading integration stats…" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CARDS.map((card) => (
          <div key={card.key} className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/25 flex items-center justify-center">
                <card.icon className="w-4 h-4 text-[#14B8A6]" />
              </div>
              <span className="text-xs font-medium text-[#94A3B8]">{card.label}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[#F5F7F6] tracking-tight">
              {overview[card.key].toLocaleString()}
            </p>
            <p className="mt-2 text-[11px] text-[#94A3B8] leading-relaxed">{card.describe}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#14B8A6] mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-[#F5F7F6]">Security note</p>
          <p className="mt-1 text-[11px] text-[#94A3B8] leading-relaxed">
            Gmail OAuth tokens are stored in <code className="text-[#F5F7F6] bg-[#0D0F0F] px-1 rounded">gmail_connections</code> with no
            client-side RLS policies — only service-role API routes touch them. This admin console only ever surfaces counts for that table.
          </p>
        </div>
      </div>
    </div>
  );
}