'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Inbox, Bell, Calendar, CreditCard, DollarSign, ChevronRight } from 'lucide-react';
import { useInbox } from '@/lib/contexts/inbox-context';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { fetchSubscriptions } from '@/lib/services/subscription-service';

interface InboxDetailContentProps {
  params: Promise<{ id: string }>;
}

export default function InboxDetailContent({ params }: InboxDetailContentProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const messageId = resolvedParams.id;
  const { getItemById, markAsRead } = useInbox();

  const item = getItemById(messageId);

  useEffect(() => {
    if (item && !item.isRead) {
      markAsRead(item.id);
    }
  }, [item, markAsRead]);

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!item) {
    return (
      <div className="space-y-6 max-w-4xl min-h-[70vh] pb-32 w-full max-w-full overflow-x-hidden flex flex-col justify-center items-center">
        <div className="py-16 px-6 text-center flex flex-col items-center justify-center space-y-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] w-full max-w-lg">
          <div className="w-12 h-12 rounded-xl bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8]">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#F5F7F6]">Message Not Found</h2>
            <p className="text-xs text-[#94A3B8]">
              The requested message does not exist or may have been deleted.
            </p>
          </div>
          <Link
            href="/inbox"
            className="inline-flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-[#14B8A6] text-[#091512] hover:opacity-90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inbox</span>
          </Link>
        </div>
      </div>
    );
  }

  const handleViewSubscription = async () => {
    if (!item.subscriptionName) return;
    const { data: subs } = await fetchSubscriptions();
    const match = subs?.find(
      (s) => s.name.toLowerCase().trim() === item.subscriptionName?.toLowerCase().trim()
    );
    if (match) {
      router.push(`/subscriptions?highlight=${match.id}&detail=true`);
    } else {
      router.push(`/subscriptions?highlight=SubHalt&detail=true`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl min-h-[85vh] pb-32 w-full max-w-full overflow-x-hidden">
      {/* Accessible DOM Heading */}
      <h1 className="sr-only">Inbox Message Detail - {item.title}</h1>

      {/* Top Bar with Back Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1A1D1D]">
        <Link
          href="/inbox"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-xs font-semibold text-[#F5F7F6] border border-[#1A1D1D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#14B8A6]" />
          <span>Back to Inbox</span>
        </Link>
      </div>

      {/* Full Page Message Container */}
      <div className="rounded-2xl p-6 sm:p-8 bg-[#0B0D0D] border border-[#1A1D1D] space-y-6 shadow-sm">
        {/* Header section: Title and Date */}
        <div className="space-y-2 pb-5 border-b border-[#1A1D1D]">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <Bell className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span className="uppercase tracking-wider font-semibold text-[11px]">Message Detail</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F7F6]">
            {item.title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(item.date)}</span>
          </div>
        </div>

        {/* Message Description Body */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            Full Content
          </h3>
          <p className="text-sm sm:text-base font-normal leading-relaxed text-[#F5F7F6]">
            {item.description}
          </p>
        </div>

        {/* Related Subscription Section (if attached) */}
        {item.subscriptionName && (
          <div className="pt-5 border-t border-[#1A1D1D] rounded-xl bg-[#0F1111] p-4 border border-[#1A1D1D]/70 space-y-3">
            <h4 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Related Subscription</span>
            </h4>
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-[#F5F7F6]">
              <div className="flex items-center gap-2 font-semibold">
                <span>{item.subscriptionName}</span>
              </div>
              <div className="flex items-center gap-3">
                {item.subscriptionPrice !== undefined && (
                  <div className="flex items-center gap-1 text-[#14B8A6] font-bold">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{formatCurrency(item.subscriptionPrice, item.currency || 'USD')}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleViewSubscription}
                  className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-[#14B8A6] hover:opacity-90 text-[#091512] transition-colors cursor-pointer flex items-center gap-1 min-h-[34px] whitespace-nowrap"
                >
                  <span>View subscription</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
