'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, MoreVertical, ChevronRight, Edit3 } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';

interface UpcomingRenewalsSpotlightProps {
  subscriptions: SubscriptionRow[];
  onEdit: (subscription: SubscriptionRow) => void;
}

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

function getRelativeDateText(diffDays: number): string {
  if (diffDays <= 0) return 'Due Today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface RenderItem {
  id: string;
  name: string;
  planName: string;
  price: number;
  currency: string;
  category: SubscriptionRow['category'];
  relativeDate: string;
  dateStr: string;
  rawSub?: SubscriptionRow;
}

const DEFAULT_UPCOMING_FALLBACKS: RenderItem[] = [
  {
    id: 'fallback-1',
    name: 'Netflix',
    planName: 'Basic Plan',
    price: 15.00,
    currency: 'USD',
    category: 'Streaming',
    relativeDate: 'Tomorrow',
    dateStr: 'Aug 11',
  },
  {
    id: 'fallback-2',
    name: 'Spotify',
    planName: 'Premium Plan',
    price: 2.00,
    currency: 'USD',
    category: 'Streaming',
    relativeDate: 'In 3 days',
    dateStr: 'Aug 14',
  },
  {
    id: 'fallback-3',
    name: 'ChatGPT Plus',
    planName: 'Plus Plan',
    price: 20.00,
    currency: 'USD',
    category: 'Software',
    relativeDate: 'In 5 days',
    dateStr: 'Aug 16',
  },
];

export function UpcomingRenewalsSpotlight({ subscriptions, onEdit }: UpcomingRenewalsSpotlightProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const today = new Date();

  // Automatically dismiss active overflow menu on scroll, click outside, resize, or escape key
  useEffect(() => {
    if (!activeMenuId) return;

    const handleScroll = (event: Event) => {
      const target = event.target as Element | null;
      if (menuRef.current && target && menuRef.current.contains(target as Node)) {
        return;
      }
      setActiveMenuId(null);
    };

    const handleResize = () => {
      setActiveMenuId(null);
    };

    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenuId(null);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuId]);

  // Dismiss menu on page navigation
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setActiveMenuId(null);
  }

  // Find active subscriptions sorted by next_billing_date
  const upcomingList = subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .map((sub) => {
      const nextDate = new Date(sub.next_billing_date);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      return { sub, diffDays };
    })
    .sort((a, b) => a.diffDays - b.diffDays);

  const displayItems: RenderItem[] = upcomingList.slice(0, 3).map(({ sub, diffDays }) => ({
    id: sub.id,
    name: sub.name,
    planName: getPlanName(sub),
    price: Number(sub.price) || 0,
    currency: sub.currency || 'USD',
    category: sub.category,
    relativeDate: getRelativeDateText(diffDays),
    dateStr: formatDateShort(sub.next_billing_date),
    rawSub: sub,
  }));

  const itemsToRender = displayItems.length > 0 ? displayItems : DEFAULT_UPCOMING_FALLBACKS;

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-zinc-800/60 bg-zinc-950/60 shadow-xl space-y-3.5">
      {/* Header Row */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight subsync-heading">
          Upcoming Renewal Spotlight
        </h3>
        <Link
          href="/subscriptions"
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer group"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* List Container */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl divide-y divide-zinc-800/40 overflow-hidden">
        {itemsToRender.map((item) => (
          <div
            key={item.id}
            onClick={() => item.rawSub && onEdit(item.rawSub)}
            className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-zinc-800/30 transition-colors group cursor-pointer relative gap-2 sm:gap-4"
          >
            {/* Column 1: App Icon + Name + Plan */}
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1 pr-2 sm:pr-4">
              <ServiceIcon name={item.name} category={item.category} className="w-10 h-10 rounded-xl shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-white block truncate group-hover:text-indigo-300 transition-colors">
                  {item.name}
                </span>
                <span className="text-xs text-zinc-400 block font-normal truncate mt-0.5">
                  {item.planName}
                </span>
              </div>
            </div>

            {/* Column 2: Date Badge (Fixed width column) */}
            <div className="w-32 sm:w-44 shrink-0 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-amber-300 block leading-tight truncate">
                  {item.relativeDate}
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5 font-normal truncate">
                  {item.dateStr}
                </span>
              </div>
            </div>

            {/* Column 3: Monthly Price (Fixed-width, right-aligned column) */}
            <div className="w-24 sm:w-32 shrink-0 text-right">
              <span className="text-sm sm:text-base font-bold text-white block leading-tight">
                {formatCurrency(item.price, item.currency)}
              </span>
              <span className="text-[10px] text-zinc-400 block leading-tight mt-0.5 font-normal">
                / month
              </span>
            </div>

            {/* Column 4: Three-Dot Action Menu (Separate column) */}
            <div className="w-8 sm:w-10 shrink-0 flex items-center justify-end relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.rawSub) {
                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                  }
                }}
                aria-label="Action menu"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {activeMenuId === item.id && item.rawSub && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-36 glass-panel rounded-2xl p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 bg-zinc-900 border border-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      if (item.rawSub) onEdit(item.rawSub);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Edit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
