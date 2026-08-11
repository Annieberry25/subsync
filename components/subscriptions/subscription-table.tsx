'use client';

import { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CreditCard, ExternalLink, Edit2, MoreVertical, Clock, TrendingUp, Settings, Archive, Bell, ChevronRight, Trash2 } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { getProviderManagementUrl, archiveSubscription } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { useToast } from '@/lib/hooks/use-toast';

interface SubscriptionTableProps {
  subscriptions: SubscriptionRow[];
  highlightedSubId?: string | null;
  onSelectSubscription: (subscription: SubscriptionRow) => void;
  onEdit: (subscription: SubscriptionRow) => void;
  onDeleteRequest: (subscription: SubscriptionRow) => void;
  onArchiveRequest?: (subscription: SubscriptionRow) => void;
  onPaymentReminderRequest: (subscription: SubscriptionRow) => void;
  reminders?: Record<string, { timing: string; method: string; note?: string; dismissed?: boolean }>;
  onDismissReminder?: (subscription: SubscriptionRow) => void;
}

const statusDotColors: Record<string, string> = {
  active: 'bg-[#22C55E]',
  trial: 'bg-[#F59E0B]',
  paused: 'bg-[#6B7280]',
  canceled: 'bg-[#EF4444]',
};

function getPlanName(sub: SubscriptionRow): string {
  if (sub.notes && sub.notes.trim().toLowerCase().includes('plan')) {
    return sub.notes.trim();
  }
  const nameLower = sub.name.toLowerCase();
  if (nameLower.includes('netflix')) return 'Basic Plan';
  if (nameLower.includes('spotify')) return 'Premium Plan';
  if (nameLower.includes('chatgpt') || nameLower.includes('openai')) return 'Plus Plan';
  if (nameLower.includes('icloud') || nameLower.includes('google')) return 'Storage Plan';
  if (nameLower.includes('amazon') || nameLower.includes('prime')) return 'Prime Plan';
  
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Plan`;
}

const emptySubscribe = () => () => {};

export default function SubscriptionTable({
  subscriptions,
  highlightedSubId,
  onSelectSubscription,
  onEdit,
  onDeleteRequest,
  onArchiveRequest,
  onPaymentReminderRequest,
  reminders = {},
  onDismissReminder,
}: SubscriptionTableProps) {
  const { toast } = useToast();
  const [activeMenuSubId, setActiveMenuSubId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeSubForMenu = subscriptions.find((s) => s.id === activeMenuSubId) || null;

  const handleToggleMenu = (e: React.MouseEvent, sub: SubscriptionRow) => {
    e.stopPropagation();
    if (activeMenuSubId === sub.id) {
      setActiveMenuSubId(null);
      return;
    }

    const btn = buttonRefs.current[sub.id];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const safeRight = Math.max(16, Math.min(window.innerWidth - 208, window.innerWidth - rect.right));
      const top = rect.bottom + 6;
      setMenuPos({ top, right: safeRight });
      setActiveMenuSubId(sub.id);
    }
  };

  useEffect(() => {
    if (!activeMenuSubId) return;

    const handleScroll = (event: Event) => {
      const target = event.target as Element | null;
      if (menuRef.current && target && menuRef.current.contains(target as Node)) {
        return;
      }
      setActiveMenuSubId(null);
    };

    const handleResize = () => {
      setActiveMenuSubId(null);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setActiveMenuSubId(null);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuSubId]);

  const menuPortal = activeMenuSubId && activeSubForMenu && mounted && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            right: `${menuPos.right}px`,
            top: `${menuPos.top}px`,
          }}
          className="w-52 rounded-2xl bg-[#171A21] border border-[#2B313D] shadow-xl py-1.5 z-[9999]"
          role="menu"
          aria-orientation="vertical"
          aria-label={`Actions for ${activeSubForMenu.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              onSelectSubscription(activeSubForMenu);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#4F46E5] shrink-0" />
            <span>View Subscription Details</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              onEdit(activeSubForMenu);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Edit Subscription</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              onPaymentReminderRequest(activeSubForMenu);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Bell className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Payment Reminder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              const targetUrl = getProviderManagementUrl(activeSubForMenu.name, activeSubForMenu.provider_url);
              if (targetUrl) {
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
              } else {
                toast.info(`Managing ${activeSubForMenu.name} coming soon.`, 'Manage Plan');
              }
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Settings className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Manage Subscription</span>
          </button>

          <div className="border-t border-[#2B313D] my-1" />

          <button
            type="button"
            onClick={async () => {
              const targetSub = activeSubForMenu;
              setActiveMenuSubId(null);
              if (onArchiveRequest) {
                onArchiveRequest(targetSub);
              } else {
                const { error } = await archiveSubscription(targetSub.id);
                if (error) {
                  toast.error(error.message, 'Archiving Failed');
                } else {
                  toast.success(`Moved "${targetSub.name}" to History → Archive.`, 'Subscription Archived');
                }
              }
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Archive className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span>Archive Subscription</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              onDeleteRequest(activeSubForMenu);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
            <span>Delete Subscription</span>
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[20px] bg-[#171A21] border border-[#2B313D] shadow-sm">
      {/* Contained Horizontal Scroll Wrapper */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[#2B313D] text-[13px] font-semibold text-[#6F7787] uppercase tracking-wider bg-[#1D222B]/60">
              <th className="py-4 px-5 font-semibold">Provider</th>
              <th className="py-4 px-4 font-semibold">Plan</th>
              <th className="py-4 px-4 font-semibold">Category</th>
              <th className="py-4 px-4 font-semibold">Amount</th>
              <th className="py-4 px-4 font-semibold">Next Billing</th>
              <th className="py-4 px-5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B313D]/60 text-xs sm:text-sm">
            {subscriptions.map((sub) => {
              const formattedPrice = formatCurrency(Number(sub.price), sub.currency);
              const statusDotStyle = statusDotColors[sub.status] || statusDotColors.active;
              const planName = getPlanName(sub);

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const rawNextDate = new Date(sub.next_billing_date);
              const nextDate = !isNaN(rawNextDate.getTime())
                ? new Date(rawNextDate.getFullYear(), rawNextDate.getMonth(), rawNextDate.getDate())
                : today;
              const diffTime = nextDate.getTime() - today.getTime();
              const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
              const formattedDate = !isNaN(rawNextDate.getTime())
                ? rawNextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : sub.next_billing_date;

              const isHighlighted = sub.id === highlightedSubId;

              return (
                <tr
                  key={sub.id}
                  id={`sub-card-${sub.id}`}
                  onClick={() => onSelectSubscription(sub)}
                  className={`group transition-colors cursor-pointer hover:bg-[#1D222B]/90 ${
                    isHighlighted ? 'bg-[#4F46E5]/15 border-l-4 border-l-[#4F46E5]' : ''
                  }`}
                >
                  {/* Provider (Logo + Name + Status Dot) */}
                  <td className="py-4 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <ServiceIcon
                        name={sub.name}
                        category={sub.category}
                        providerUrl={sub.provider_url}
                        className="w-9 h-9 rounded-xl shrink-0 border border-[#2B313D]"
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm sm:text-base group-hover:text-[#6366F1] transition-colors">
                          {sub.name}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${statusDotStyle} shrink-0`}
                          title={`Status: ${sub.status}`}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="py-4 px-4 whitespace-nowrap text-[#A1AAB8] font-medium text-xs sm:text-sm">
                    {planName}
                  </td>

                  {/* Category */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1D222B] border border-[#2B313D] text-[#A1AAB8]">
                      {sub.category}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-4 whitespace-nowrap font-bold text-white text-sm sm:text-base">
                    {formattedPrice} <span className="text-xs font-normal text-[#A1AAB8]">/ {sub.billing_cycle}</span>
                  </td>

                  {/* Next Billing */}
                  <td className="py-4 px-4 whitespace-nowrap text-xs sm:text-sm text-[#A1AAB8]">
                    {diffDays <= 0 ? (
                      <span className="text-[#EF4444] font-bold">Due today</span>
                    ) : (
                      <span>{formattedDate} <span className="text-[11px] text-[#6F7787]">({diffDays}d)</span></span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        ref={(el) => { buttonRefs.current[sub.id] = el; }}
                        type="button"
                        onClick={(e) => handleToggleMenu(e, sub)}
                        className="w-8 h-8 rounded-xl bg-[#1D222B] hover:bg-[#2B313D] text-[#6F7787] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2B313D]"
                        title="Actions"
                        aria-label={`Actions for ${sub.name}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Menu Portal */}
      {menuPortal}
    </div>
  );
}
