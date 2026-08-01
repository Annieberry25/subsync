'use client';

import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CreditCard, ExternalLink, Edit2, MoreVertical, Clock, TrendingUp, Settings, Archive, Bell } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { useToast } from '@/lib/hooks/use-toast';
import { ServiceIcon } from '@/components/ui/service-icon';

interface SubscriptionCardProps {
  subscription: SubscriptionRow;
  onEdit: (subscription: SubscriptionRow) => void;
  onDeleteRequest: (subscription: SubscriptionRow) => void;
  onPaymentReminderRequest?: (subscription: SubscriptionRow) => void;
  reminderInfo?: { timing: string; method: string; note?: string; dismissed?: boolean } | null;
  onDismissReminder?: (subscription: SubscriptionRow) => void;
}

const categoryChipStyle = 'bg-env-badge text-env-body border-env-subtle';

const statusDotColors: Record<string, string> = {
  active: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
  paused: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]',
  canceled: 'bg-slate-400',
  trial: 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]',
};

const emptySubscribe = () => () => {};

export default function SubscriptionCard({
  subscription,
  onEdit,
  onDeleteRequest,
  onPaymentReminderRequest,
  reminderInfo,
  onDismissReminder,
}: SubscriptionCardProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const formattedPrice = formatCurrency(Number(subscription.price), subscription.currency);
  const statusDotStyle = statusDotColors[subscription.status] || statusDotColors.active;

  // Calculate days until next renewal cleanly without time-of-day offset errors
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rawNextDate = new Date(subscription.next_billing_date);
  const nextDate = !isNaN(rawNextDate.getTime())
    ? new Date(rawNextDate.getFullYear(), rawNextDate.getMonth(), rawNextDate.getDate())
    : today;

  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  const formattedDate = !isNaN(rawNextDate.getTime())
    ? rawNextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : subscription.next_billing_date;

  const hasReminder = Boolean((reminderInfo && !reminderInfo.dismissed) || (diffDays <= 7 && subscription.status === 'active'));
  const isReminderDue = diffDays <= 7;

  const handleToggleMenu = async () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    if (!buttonRef.current) return;

    const initialRect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - initialRect.bottom;
    const actualMenuHeight = 285; // 6 menu items + divider + container padding
    const bottomMargin = 24;
    const requiredHeight = actualMenuHeight + 6 + bottomMargin; // 315px total space needed below button

    // 1. If scrolling is required, scroll window FIRST while dropdown remains unmounted
    if (spaceBelow < requiredHeight) {
      const scrollNeeded = requiredHeight - spaceBelow;
      window.scrollBy({ top: scrollNeeded, behavior: 'smooth' });

      // Wait for smooth scroll to complete settling
      await new Promise<void>((resolve) => {
        let timer: NodeJS.Timeout;
        const onScroll = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            window.removeEventListener('scroll', onScroll);
            resolve();
          }, 50);
        };
        window.addEventListener('scroll', onScroll);
        timer = setTimeout(() => {
          window.removeEventListener('scroll', onScroll);
          resolve();
        }, 300);
      });
    }

    // 2. Recalculate post-scroll button coordinates and mount dropdown only AFTER scroll finishes
    if (buttonRef.current) {
      const finalRect = buttonRef.current.getBoundingClientRect();
      const safeRight = Math.max(16, Math.min(window.innerWidth - 208, window.innerWidth - finalRect.right));
      const top = finalRect.bottom + 6;
      setMenuPos({ top, right: safeRight });
      setMenuOpen(true);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;

    const initialWindowY = window.scrollY;
    const initialWindowX = window.scrollX;

    const handleScroll = (event: Event) => {
      const target = event.target as Element | null;
      if (menuRef.current && target && menuRef.current.contains(target as Node)) {
        return;
      }
      const dy = Math.abs(window.scrollY - initialWindowY);
      const dx = Math.abs(window.scrollX - initialWindowX);
      const isScrollableElement = target && target !== (document as unknown) && target !== (window as unknown) && 'scrollTop' in target;

      if (dy > 4 || dx > 4 || isScrollableElement) {
        setMenuOpen(false);
      }
    };

    const handleResize = () => {
      setMenuOpen(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleEdit = () => {
    setMenuOpen(false);
    onEdit(subscription);
  };

  const handleRenewalHistory = () => {
    setMenuOpen(false);
    toast.info(`Renewal History for ${subscription.name} coming soon.`, 'Feature Pending');
  };

  const handlePriceHistory = () => {
    setMenuOpen(false);
    toast.info(`Price History for ${subscription.name} coming soon.`, 'Feature Pending');
  };

  const handlePaymentReminder = () => {
    setMenuOpen(false);
    if (onPaymentReminderRequest) {
      onPaymentReminderRequest(subscription);
    }
  };

  const handleManageSubscription = () => {
    setMenuOpen(false);
    if (subscription.provider_url) {
      window.open(subscription.provider_url, '_blank', 'noopener,noreferrer');
    } else {
      toast.info(`Managing ${subscription.name} settings coming soon.`, 'Feature Pending');
    }
  };

  const handleArchive = () => {
    setMenuOpen(false);
    onDeleteRequest(subscription);
  };

  const menuPortal = menuOpen && mounted && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            right: `${menuPos.right}px`,
            top: `${menuPos.top}px`,
          }}
          className="w-52 rounded-2xl glass-panel bg-env-panel/95 backdrop-blur-xl border border-env-subtle shadow-2xl py-1.5 z-[9999] animate-in fade-in-50 zoom-in-95 origin-top-right duration-150"
          role="menu"
          aria-orientation="vertical"
          aria-label={`Actions for ${subscription.name}`}
        >
          <button
            type="button"
            onClick={handleEdit}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-env-heading hover:bg-env-badge flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Edit2 className="w-3.5 h-3.5 text-env-muted shrink-0" />
            <span>Edit Subscription</span>
          </button>

          <button
            type="button"
            onClick={handleRenewalHistory}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-env-heading hover:bg-env-badge flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Clock className="w-3.5 h-3.5 text-env-muted shrink-0" />
            <span>Renewal History</span>
          </button>

          <button
            type="button"
            onClick={handlePriceHistory}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-env-heading hover:bg-env-badge flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <TrendingUp className="w-3.5 h-3.5 text-env-muted shrink-0" />
            <span>Price History</span>
          </button>

          <button
            type="button"
            onClick={handlePaymentReminder}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-env-heading hover:bg-env-badge flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Bell className="w-3.5 h-3.5 text-env-muted shrink-0" />
            <span>Payment Reminder</span>
          </button>

          {reminderInfo && onDismissReminder && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDismissReminder(subscription);
              }}
              className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-amber-400 hover:bg-env-badge flex items-center gap-2.5 transition-colors text-left cursor-pointer"
              role="menuitem"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Dismiss Reminder</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManageSubscription}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-env-heading hover:bg-env-badge flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Settings className="w-3.5 h-3.5 text-env-muted shrink-0" />
            <span>Manage Subscription</span>
          </button>

          <div className="border-t border-env-subtle/50 my-1" />

          <button
            type="button"
            onClick={handleArchive}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Archive className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Archive Subscription</span>
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="glass-card group relative w-full rounded-3xl p-4.5 sm:p-5 flex flex-col justify-between border-0 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 gap-3.5">
      {/* Top Header Row with Branded Service Icon */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ServiceIcon
            name={subscription.name}
            category={subscription.category}
            className="w-10 h-10 group-hover:scale-105 transition-transform duration-300 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-env-heading text-base tracking-tight flex items-center gap-1.5 min-w-0">
              <span className="truncate">{subscription.name}</span>
              {subscription.provider_url && (
                <a
                  href={subscription.provider_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open provider website"
                  aria-label={`Open provider website for ${subscription.name}`}
                  className="text-env-muted hover:text-env-accent transition-colors p-0.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </h3>
          </div>
        </div>

        {/* Status Dot & Vertical Menu Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${statusDotStyle}`} title={`Status: ${subscription.status}`} />
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggleMenu}
            className="w-9 h-9 rounded-xl bg-env-button-sec hover:bg-env-badge text-env-muted hover:text-env-heading flex items-center justify-center transition-colors cursor-pointer border border-env-subtle shrink-0"
            title="Subscription actions"
            aria-label={`Actions for ${subscription.name}`}
            aria-expanded={menuOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent Price Line */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="text-2xl font-black text-env-heading tracking-tight">{formattedPrice}</span>
          <span className="text-xs text-env-muted font-medium ml-1">/ {subscription.billing_cycle}</span>
        </div>

        {subscription.payment_method && (
          <div className="flex items-center gap-1.5 text-xs text-env-body bg-env-badge px-2.5 py-1 rounded-xl border border-env-main shrink-0 max-w-[120px]">
            <CreditCard className="w-3.5 h-3.5 text-env-muted shrink-0" />
            <span className="truncate">{subscription.payment_method}</span>
          </div>
        )}
      </div>

      {/* Renewal Info & Category Row */}
      <div className="flex items-center justify-between text-xs text-env-body min-w-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Calendar className="w-3.5 h-3.5 text-env-muted shrink-0" />
          <span className="truncate text-env-muted font-medium">
            {diffDays <= 0 ? (
              <strong className="text-rose-400 font-bold">Due today</strong>
            ) : (
              <>
                Renews <strong className="text-env-heading font-semibold">{formattedDate}</strong>
              </>
            )}
            <span className="mx-1.5 text-env-muted">•</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${categoryChipStyle}`}>
              {subscription.category}
            </span>
          </span>
        </div>

        {hasReminder && (
          <button
            type="button"
            onClick={() => onPaymentReminderRequest && onPaymentReminderRequest(subscription)}
            title={
              isReminderDue
                ? `Payment Reminder Active (${reminderInfo?.timing || 'Due Today'}) - Click to modify`
                : `Payment Reminder Set (${reminderInfo?.timing})`
            }
            aria-label={`Payment reminder for ${subscription.name}`}
            className={`p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl transition-all shrink-0 ml-1 cursor-pointer ${
              diffDays <= 0
                ? 'text-env-status-danger bg-env-status-danger-bg border border-env-status-danger-border animate-reminder-shake-today shadow-sm'
                : diffDays === 1
                ? 'text-env-status-warning bg-env-status-warning-bg border border-env-status-warning-border animate-reminder-shake-1day shadow-sm'
                : 'text-env-muted bg-env-badge hover:bg-env-button-sec border border-env-subtle'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Action Menu Popover Portal */}
      {menuPortal}
    </div>
  );
}
