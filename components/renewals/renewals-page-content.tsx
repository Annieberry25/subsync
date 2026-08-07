'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { 
  fetchSubscriptions, 
  getCachedSubscriptions,
  updateSubscription,
  type SubscriptionRow, 
  type SubscriptionInsert 
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';
import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import { useToast } from '@/lib/hooks/use-toast';

function getPlanName(sub: SubscriptionRow): string {
  if (sub.notes && sub.notes.trim().toLowerCase().includes('plan')) {
    return sub.notes.trim();
  }
  const nameLower = sub.name.toLowerCase();
  if (nameLower.includes('netflix')) return 'Basic Plan';
  if (nameLower.includes('spotify')) return 'Premium Plan';
  if (nameLower.includes('chatgpt') || nameLower.includes('openai')) return 'Plus Plan';
  if (nameLower.includes('icloud') || nameLower.includes('google')) return 'Storage Plan';
  
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Plan`;
}

function getRenewalStatus(diffDays: number) {
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`,
      color: '#EF4444',
    };
  }
  if (diffDays === 0) {
    return { text: 'Today', color: '#F59E0B' };
  }
  if (diffDays === 1) {
    return { text: 'Tomorrow', color: '#F59E0B' };
  }
  if (diffDays <= 7) {
    return { text: `In ${diffDays} days`, color: '#F59E0B' };
  }
  return { text: `In ${diffDays} days`, color: '#22C55E' };
}

function getCycleSuffix(billingCycle?: string): string {
  if (!billingCycle) return '/month';
  const lower = billingCycle.toLowerCase();
  if (lower === 'yearly' || lower === 'annual') return '/yr';
  if (lower === 'quarterly') return '/quarter';
  if (lower === 'weekly') return '/wk';
  return '/month';
}

export default function RenewalsPageContent() {
  const { toast } = useToast();
  const initialCache = getCachedSubscriptions();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);

  useEffect(() => {
    let active = true;
    fetchSubscriptions().then(({ data, error: err }) => {
      if (!active) return;
      if (err && subscriptions.length === 0) {
        setError(err.message || 'Failed to load subscriptions.');
      } else if (data) {
        setSubscriptions(data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [subscriptions.length]);

  const handleSave = async (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => {
    if (id) {
      const { error: err } = await updateSubscription(id, data);
      if (err) throw err;
      toast.success('Subscription details updated.', 'Saved');
      const { data: updated } = await fetchSubscriptions();
      if (updated) setSubscriptions(updated);
    }
  };

  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return subscriptions
      .filter((sub) => sub.status === 'active' || sub.status === 'trial')
      .map((sub) => {
        const nextDate = new Date(sub.next_billing_date);
        nextDate.setHours(0, 0, 0, 0);
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
        return { sub, diffDays };
      })
      .filter(({ diffDays }) => diffDays <= 30)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [subscriptions]);

  return (
    <div className="animate-page-transition pt-0 space-y-5 bg-ambient-grid min-h-[85vh] pb-32 sm:pb-48">
      {/* Top-left Back Button */}
      <div>
        <Link
          href="/"
          prefetch={true}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A1AAB8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
      </div>

      {/* Page Title (No Subtitle) */}
      <div>
        <h1 className="text-[28px] font-bold text-white tracking-tight leading-[34px]">
          Upcoming Renewals
        </h1>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center gap-3 text-[#EF4444] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Renewal Rows Container */}
      {loading && subscriptions.length === 0 ? (
        <div className="space-y-4">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : upcomingRenewals.length === 0 ? (
        <div className="p-8 text-center bg-[#171A21] border border-[#2B313D] rounded-[20px]">
          <p className="text-base font-semibold text-white">
            No renewals in the next 30 days.
          </p>
          <p className="text-sm text-[#A1AAB8] mt-1">
            You&apos;re all caught up.
          </p>
        </div>
      ) : (
        <div className="bg-[#171A21] border border-[#2B313D]/60 rounded-[20px] space-y-3.5 p-6">
          <div className="space-y-2.5">
            {upcomingRenewals.map(({ sub, diffDays }) => {
              const status = getRenewalStatus(diffDays);
              const price = Number(sub.price) || 0;
              const cycleSuffix = getCycleSuffix(sub.billing_cycle);
              const planName = getPlanName(sub);

              return (
                <div
                  key={sub.id}
                  onClick={() => setEditingSubscription(sub)}
                  className="grid grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] items-center px-5 py-3.5 bg-[#1D222B] border border-white/[0.04] hover:border-[#4F46E5]/40 rounded-2xl transition-colors cursor-pointer gap-4"
                >
                  {/* 1. Service Logo + Name + Plan */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ServiceIcon name={sub.name} category={sub.category} className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-base font-semibold text-white block truncate">
                        {sub.name}
                      </span>
                      <span className="text-[14px] text-[#A1AAB8] block truncate mt-0.5">
                        {planName}
                      </span>
                    </div>
                  </div>

                  {/* 2. Renewal Status */}
                  <div className="flex items-center justify-center text-center min-w-0">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: status.color }}
                    >
                      {status.text}
                    </span>
                  </div>

                  {/* 3. Single-line Price */}
                  <div className="text-right min-w-0 justify-self-end">
                    <span style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                      {formatCurrency(price, sub.currency || 'USD')}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 400, color: '#A1AAB8' }}>
                      {cycleSuffix}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subscription Details Modal on click */}
      <SubscriptionModal
        isOpen={!!editingSubscription}
        onClose={() => setEditingSubscription(null)}
        onSave={handleSave}
        initialData={editingSubscription}
      />
    </div>
  );
}
