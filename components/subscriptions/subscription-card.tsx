'use client';

import { useState } from 'react';
import { Calendar, CreditCard, ExternalLink, Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';

interface SubscriptionCardProps {
  subscription: SubscriptionRow;
  onEdit: (subscription: SubscriptionRow) => void;
  onDelete: (id: string) => Promise<void>;
}

const categoryColors: Record<string, string> = {
  Streaming: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Software: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Utilities: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Fitness: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Finance: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Education: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Gaming: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Other: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  canceled: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/40',
  trial: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function SubscriptionCard({ subscription, onEdit, onDelete }: SubscriptionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(subscription.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const formattedPrice = formatCurrency(Number(subscription.price), subscription.currency);
  const categoryStyle = categoryColors[subscription.category] || categoryColors.Other;
  const statusStyle = statusColors[subscription.status] || statusColors.active;

  // Calculate days until next renewal
  const nextDate = new Date(subscription.next_billing_date);
  const today = new Date();
  const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

  return (
    <div className="group relative bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-5 space-y-4 transition-all hover:shadow-xl hover:shadow-indigo-500/5">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center text-white font-bold text-sm tracking-wider uppercase shadow-inner">
            {subscription.name.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
              <span>{subscription.name}</span>
              {subscription.provider_url && (
                <a
                  href={subscription.provider_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${categoryStyle}`}>
                {subscription.category}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${statusStyle}`}>
                {subscription.status}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(subscription)}
            aria-label="Edit subscription"
            className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete subscription"
            className="w-8 h-8 rounded-lg bg-zinc-800/60 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      {confirmDelete && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Confirm delete?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] font-semibold hover:bg-zinc-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Price & Cycle Section */}
      <div className="flex items-baseline justify-between border-t border-b border-zinc-800/60 py-3">
        <div>
          <span className="text-2xl font-extrabold text-white">{formattedPrice}</span>
          <span className="text-xs text-zinc-500 font-medium ml-1">/ {subscription.billing_cycle}</span>
        </div>

        {subscription.payment_method && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/40 px-2.5 py-1 rounded-lg border border-zinc-800">
            <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
            <span className="truncate max-w-[120px]">{subscription.payment_method}</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <span>Next bill: {subscription.next_billing_date}</span>
        </div>

        {diffDays >= 0 && diffDays <= 7 && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            Due in {diffDays === 0 ? 'today' : `${diffDays}d`}
          </span>
        )}
      </div>

      {subscription.notes && (
        <p className="text-[11px] text-zinc-500 line-clamp-2 bg-zinc-950/40 p-2 rounded-lg border border-zinc-800/40 italic">
          "{subscription.notes}"
        </p>
      )}
    </div>
  );
}
