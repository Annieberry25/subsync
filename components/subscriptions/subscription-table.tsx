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
  onOpenNotes?: (subscription: SubscriptionRow) => void;
  reminders?: Record<string, { timing: string; method: string; note?: string; dismissed?: boolean }>;
  onDismissReminder?: (subscription: SubscriptionRow) => void;
}

const statusDotColors: Record<string, string> = {
  active: 'bg-[#14B8A6]',
  trial: 'bg-[#F59E0B]',
  paused: 'bg-[#6B7280]',
  canceled: 'bg-[#D9363E]',
};

function getPlanName(sub: SubscriptionRow): string {
  if (sub.notes && sub.notes.trim()) {
    return sub.notes.trim();
  }
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Subscription`;
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
  onOpenNotes,
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
          className="w-52 rounded-2xl bg-[#0F1111] border border-[#1A1D1D] shadow-xl py-1.5 z-[9999]"
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
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
            <span>View Subscription Details</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              onEdit(activeSubForMenu);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <span>Edit Subscription</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuSubId(null);
              onPaymentReminderRequest(activeSubForMenu);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Bell className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
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
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Settings className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <span>Manage Subscription</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetSub = activeSubForMenu;
              setActiveMenuSubId(null);
              onOpenNotes?.(targetSub);
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Clock className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <span>Notes</span>
          </button>

          <div className="border-t border-[#1A1D1D] my-1" />

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
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#D9363E] hover:bg-[#D9363E]/10 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#D9363E] shrink-0" />
            <span>Delete Subscription</span>
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] shadow-sm">
      {/* Contained Horizontal Scroll Wrapper */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[#1A1D1D] text-xs font-medium text-[#94A3B8] bg-[#0B0D0D]">
              <th className="py-3.5 px-5 font-medium">Provider</th>
              <th className="py-3.5 px-4 font-medium">Plan</th>
              <th className="py-3.5 px-4 font-medium">Category</th>
              <th className="py-3.5 px-4 font-medium">Amount</th>
              <th className="py-3.5 px-4 font-medium">Next Billing</th>
              <th className="py-3.5 px-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1D1D] text-xs sm:text-sm">
            {subscriptions.map((sub) => {
              const formattedPrice = formatCurrency(Number(sub.price), sub.currency);
              const statusDotStyle = statusDotColors[sub.status] || statusDotColors.active;
              const planName = getPlanName(sub);

              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

              const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
                if (!dateStr) return null;
                const parts = dateStr.split('T')[0].split('-');
                if (parts.length === 3) {
                  const y = parseInt(parts[0], 10);
                  const m = parseInt(parts[1], 10) - 1;
                  const d = parseInt(parts[2], 10);
                  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
                }
                const parsed = new Date(dateStr);
                return isNaN(parsed.getTime()) ? null : parsed;
              };

              const rawNextDateObj = parseLocalDate(sub.next_billing_date);
              const nextDate = rawNextDateObj || today;
              const diffTime = nextDate.getTime() - today.getTime();
              const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
              const formattedDate = rawNextDateObj
                ? rawNextDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : sub.next_billing_date;

              const isHighlighted = sub.id === highlightedSubId;

              return (
                <tr
                  key={sub.id}
                  id={`sub-card-${sub.id}`}
                  onClick={() => onSelectSubscription(sub)}
                  className={`group transition-colors cursor-pointer hover:bg-[#0F1111] ${
                    isHighlighted ? 'bg-[#14B8A6]/15 border-l-4 border-l-[#14B8A6]' : ''
                  }`}
                >
                  {/* Provider (Logo + Name) */}
                  <td className="py-4 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <ServiceIcon
                        name={sub.name}
                        category={sub.category}
                        providerUrl={sub.provider_url}
                        className="w-9 h-9 rounded-xl shrink-0 border border-[#1A1D1D]"
                      />
                      <span className="font-semibold text-[#F5F7F6] text-sm sm:text-base group-hover:text-[#14B8A6] transition-colors">
                        {sub.name}
                      </span>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="py-4 px-4 whitespace-nowrap text-[#94A3B8] font-medium text-xs sm:text-sm">
                    {planName}
                  </td>

                  {/* Category */}
                  <td className="py-4 px-4 whitespace-nowrap text-xs text-[#94A3B8] font-normal">
                    {sub.category}
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-4 whitespace-nowrap font-bold text-[#F5F7F6] text-sm sm:text-base">
                    {formattedPrice} <span className="text-xs font-normal text-[#94A3B8]">/ {sub.billing_cycle}</span>
                  </td>

                  {/* Next Billing */}
                  <td className="py-4 px-4 whitespace-nowrap text-xs sm:text-sm text-[#94A3B8]">
                    {diffDays < 0 ? (
                      <span className="text-[#D9363E] font-bold">Overdue ({Math.abs(diffDays)}d)</span>
                    ) : diffDays === 0 ? (
                      <span className="text-[#D9363E] font-bold">Due today</span>
                    ) : (
                      <span>{formattedDate} <span className="text-[11px] text-[#94A3B8]">({diffDays}d)</span></span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        ref={(el) => { buttonRefs.current[sub.id] = el; }}
                        type="button"
                        onClick={(e) => handleToggleMenu(e, sub)}
                        className="p-1.5 text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]/50 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
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
