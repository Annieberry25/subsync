'use client';

import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CreditCard, ExternalLink, Edit2, MoreVertical, Clock, TrendingUp, Settings, Archive, Bell, Link2 } from 'lucide-react';
import { type SubscriptionRow, getProviderWebsite, getProviderManagementUrl, parseAccountLinks } from '@/lib/services/subscription-service';
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
  isHighlighted?: boolean;
}

// SubSync Design System v1.1 status dots (Strictly green, amber, red, neutral)
const statusDotColors: Record<string, string> = {
  active: 'bg-[#22C55E]',
  trial: 'bg-[#F59E0B]',
  paused: 'bg-[#6B7280]',
  canceled: 'bg-[#EF4444]',
};

const emptySubscribe = () => () => {};

export default function SubscriptionCard({
  subscription,
  onEdit,
  onDeleteRequest,
  onPaymentReminderRequest,
  reminderInfo,
  onDismissReminder,
  isHighlighted,
}: SubscriptionCardProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const formattedPrice = formatCurrency(Number(subscription.price), subscription.currency);
  const statusDotStyle = statusDotColors[subscription.status] || statusDotColors.active;
  const accountLinks = parseAccountLinks(subscription);

  // Calculate days until next renewal cleanly
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

  const handleToggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const safeRight = Math.max(16, Math.min(window.innerWidth - 208, window.innerWidth - rect.right));
    const top = rect.bottom + 6;
    setMenuPos({ top, right: safeRight });
    setMenuOpen(true);
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

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
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
    const targetUrl = getProviderManagementUrl(subscription.name, subscription.provider_url);
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
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
          className="w-52 rounded-2xl bg-[#171A21] border border-[#2B313D] shadow-xl py-1.5 z-[9999]"
          role="menu"
          aria-orientation="vertical"
          aria-label={`Actions for ${subscription.name}`}
        >
          <button
            type="button"
            onClick={handleEdit}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Edit Subscription</span>
          </button>

          <button
            type="button"
            onClick={handleRenewalHistory}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Clock className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Renewal History</span>
          </button>

          <button
            type="button"
            onClick={handlePriceHistory}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Price History</span>
          </button>

          <button
            type="button"
            onClick={handlePaymentReminder}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Bell className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Payment Reminder</span>
          </button>

          {reminderInfo && onDismissReminder && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDismissReminder(subscription);
              }}
              className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#F59E0B] hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
              role="menuitem"
            >
              <Bell className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              <span>Dismiss Reminder</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManageSubscription}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-[#2B313D] flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Settings className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
            <span>Manage Subscription</span>
          </button>

          <div className="border-t border-[#2B313D] my-1" />

          <button
            type="button"
            onClick={handleArchive}
            className="w-full px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            <Archive className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
            <span>Archive Subscription</span>
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      id={`sub-card-${subscription.id}`}
      className={`w-full rounded-2xl p-5 bg-[#1D222B] flex flex-col justify-between transition-all duration-300 gap-4 ${
        isHighlighted
          ? 'border-2 border-[#4F46E5] ring-2 ring-[#4F46E5]/40 shadow-lg'
          : 'border border-[#2B313D] hover:border-[#4F46E5]'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ServiceIcon
            name={subscription.name}
            category={subscription.category}
            providerUrl={getProviderWebsite(subscription.name, subscription.provider_url)}
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white text-[18px] leading-[24px] flex items-center gap-1.5 min-w-0 flex-wrap">
              <span>{subscription.name}</span>
              {getProviderManagementUrl(subscription.name, subscription.provider_url) && (
                <a
                  href={getProviderManagementUrl(subscription.name, subscription.provider_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open subscription management page"
                  aria-label={`Open subscription management page for ${subscription.name}`}
                  className="text-[#6F7787] hover:text-white transition-colors p-0.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </h3>
          </div>
        </div>

        {/* Status Dot & Vertical Menu Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full ${statusDotStyle}`} title={`Status: ${subscription.status}`} />
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggleMenu}
            className="w-9 h-9 rounded-xl bg-[#171A21] hover:bg-[#2B313D] text-[#6F7787] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2B313D] shrink-0"
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
          <span className="text-2xl font-bold text-white tracking-tight">{formattedPrice}</span>
          <span className="text-[15px] text-[#A1AAB8] ml-1">/ {subscription.billing_cycle}</span>
        </div>
      </div>

      {/* Renewal Info & Category Row */}
      <div className="flex flex-wrap items-center justify-between text-[15px] text-[#A1AAB8] min-w-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
          <span className="text-[#A1AAB8]">
            {diffDays <= 0 ? (
              <strong className="text-[#EF4444] font-semibold">Due today</strong>
            ) : (
              <>
                Renews <strong className="text-white font-medium">{formattedDate}</strong>
              </>
            )}
            <span className="mx-2 text-[#6F7787]">•</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-[#171A21] border border-[#2B313D] text-[#A1AAB8]">
              {subscription.category}
            </span>
          </span>
        </div>

        {hasReminder && (
          <button
            type="button"
            onClick={() => onPaymentReminderRequest && onPaymentReminderRequest(subscription)}
            title={`Payment Reminder Active (${reminderInfo?.timing || 'Due Soon'})`}
            aria-label={`Payment reminder for ${subscription.name}`}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl transition-colors shrink-0 ml-1 cursor-pointer text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Subscription Account Links */}
      {accountLinks.length > 0 && (
        <div className="pt-2 border-t border-[#2B313D]/60 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6F7787] uppercase tracking-wider">
            <Link2 className="w-3 h-3 text-[#4F46E5]" />
            <span>Subscription Accounts</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {accountLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#171A21] hover:bg-[#2B313D] text-xs font-medium text-[#4F46E5] hover:text-white border border-[#2B313D] transition-colors cursor-pointer"
                title={`Open ${link.label || 'Account'} link: ${link.url}`}
              >
                <span>{link.label || 'Account'}</span>
                <ExternalLink className="w-3 h-3 text-[#6F7787]" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Floating Action Menu Popover Portal */}
      {menuPortal}
    </div>
  );
}
