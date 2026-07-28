'use client';

import { useState } from 'react';
import { Calendar, CreditCard, ExternalLink, Edit2, Trash2, Copy, Check } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { useToast } from '@/lib/hooks/use-toast';
import { ServiceIcon } from '@/components/ui/service-icon';

interface SubscriptionCardProps {
  subscription: SubscriptionRow;
  onEdit: (subscription: SubscriptionRow) => void;
  onDeleteRequest: (subscription: SubscriptionRow) => void;
}

const categoryColors: Record<string, string> = {
  Streaming: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Software: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Utilities: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Fitness: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Finance: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Education: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Gaming: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Other: 'bg-env-badge text-env-body border-env-main',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  canceled: 'bg-env-badge text-env-muted border-env-main',
  trial: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

export default function SubscriptionCard({ subscription, onEdit, onDeleteRequest }: SubscriptionCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const formattedPrice = formatCurrency(Number(subscription.price), subscription.currency);
  const categoryStyle = categoryColors[subscription.category] || categoryColors.Other;
  const statusStyle = statusColors[subscription.status] || statusColors.active;

  // Calculate days until next renewal
  const nextDate = new Date(subscription.next_billing_date);
  const today = new Date();
  const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

  const handleCopyLink = () => {
    if (!subscription.provider_url) return;
    navigator.clipboard.writeText(subscription.provider_url);
    setCopied(true);
    toast.info(`Copied provider URL for ${subscription.name} to clipboard.`, 'Link Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card group relative rounded-3xl p-5 space-y-4 flex flex-col justify-between shadow-xl">
      <div className="space-y-4">
        {/* Top Header Row with Branded Service Icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ServiceIcon 
              name={subscription.name} 
              category={subscription.category} 
              className="w-11 h-11 group-hover:scale-105 transition-transform duration-300 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-env-heading text-base tracking-tight flex items-center gap-1.5 truncate">
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
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${categoryStyle}`}>
                  {subscription.category}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${statusStyle}`}>
                  {subscription.status}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {subscription.provider_url && (
              <button
                type="button"
                onClick={handleCopyLink}
                title="Copy provider URL"
                aria-label="Copy provider URL"
                className="w-8 h-8 rounded-xl bg-env-button-sec hover:bg-env-badge text-env-body hover:text-env-heading flex items-center justify-center transition-colors cursor-pointer border border-env-subtle"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(subscription)}
              title="Edit subscription"
              aria-label={`Edit ${subscription.name}`}
              className="w-8 h-8 rounded-xl bg-env-button-sec hover:bg-env-badge text-env-body hover:text-env-heading flex items-center justify-center transition-colors cursor-pointer border border-env-subtle"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteRequest(subscription)}
              title="Delete subscription"
              aria-label={`Delete ${subscription.name}`}
              className="w-8 h-8 rounded-xl bg-env-button-sec hover:bg-rose-500/20 text-env-body hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer border border-env-subtle"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Price & Cycle Section */}
        <div className="flex items-baseline justify-between border-t border-b border-env-main py-3">
          <div>
            <span className="text-2xl font-black text-env-heading tracking-tight">{formattedPrice}</span>
            <span className="text-xs text-env-muted font-medium ml-1">/ {subscription.billing_cycle}</span>
          </div>

          {subscription.payment_method && (
            <div className="flex items-center gap-1.5 text-xs text-env-body bg-env-badge px-2.5 py-1 rounded-xl border border-env-main">
              <CreditCard className="w-3.5 h-3.5 text-env-muted" />
              <span className="truncate max-w-[120px]">{subscription.payment_method}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs text-env-body">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-env-muted" />
            <span>Next bill: <strong className="text-env-heading font-semibold">{subscription.next_billing_date}</strong></span>
          </div>

          {diffDays >= 0 && diffDays <= 7 && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
              Due in {diffDays === 0 ? 'today' : `${diffDays}d`}
            </span>
          )}
        </div>

        {subscription.notes && (
          <p className="text-[11px] text-env-muted line-clamp-2 bg-env-badge p-2.5 rounded-xl border border-env-subtle italic">
            &quot;{subscription.notes}&quot;
          </p>
        )}
      </div>
    </div>
  );
}
