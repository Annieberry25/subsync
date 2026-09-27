import type { LucideIcon } from 'lucide-react';
import { Loader2, Inbox } from 'lucide-react';
import { formatCurrencyAmount } from '@/lib/services/currency-service';

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/25 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#14B8A6]" />
        </div>
        <span className="text-xs font-medium text-[#94A3B8]">{label}</span>
      </div>
      <div className="mt-3 text-xl font-semibold text-[#F5F7F6] tracking-tight">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-[#94A3B8]">{hint}</div> : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
      <Loader2 className="w-6 h-6 animate-spin text-[#14B8A6] mb-3" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-8 text-center">
      <p className="text-sm text-[#F87171]">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-[#94A3B8]">
      <Inbox className="w-6 h-6 mb-3 opacity-60" />
      <span className="text-xs">{message}</span>
    </div>
  );
}

export function PlanBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    free: 'bg-[#1A1D1D] text-[#94A3B8] border-[#2A2E2E]',
    plus: 'bg-[#14B8A6]/10 text-[#14B8A6] border-[#14B8A6]/25',
    premium: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${styles[tier] ?? styles.free}`}>
      {tier}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-[#14B8A6]/10 text-[#14B8A6] border-[#14B8A6]/25',
    pending: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
    failed: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/30',
    cancelled: 'bg-[#64748B]/10 text-[#94A3B8] border-[#2A2E2E]',
    expired: 'bg-[#64748B]/10 text-[#94A3B8] border-[#2A2E2E]',
    verified: 'bg-[#14B8A6]/10 text-[#14B8A6] border-[#14B8A6]/25',
    user_submitted: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
    unverified: 'bg-[#64748B]/10 text-[#94A3B8] border-[#2A2E2E]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${styles[status] ?? styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return formatCurrencyAmount(amount, currency);
  } catch {
    return `${amount}`;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}