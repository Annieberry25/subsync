'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/services/subscription-service';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subscriptionData: Omit<SubscriptionInsert, 'user_id'>, id?: string) => Promise<void>;
  initialData?: SubscriptionRow | null;
}

const categories = ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'] as const;
const billingCycles = ['monthly', 'yearly', 'weekly', 'quarterly', 'custom'] as const;
const statuses = ['active', 'paused', 'canceled', 'trial'] as const;

export default function SubscriptionModal({ isOpen, onClose, onSave, initialData }: SubscriptionModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<typeof billingCycles[number]>('monthly');
  const [category, setCategory] = useState<typeof categories[number]>('Software');
  const [status, setStatus] = useState<typeof statuses[number]>('active');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPrice(initialData.price.toString());
      setCurrency(initialData.currency || 'USD');
      setBillingCycle(initialData.billing_cycle);
      setCategory(initialData.category);
      setStatus(initialData.status);
      setNextBillingDate(initialData.next_billing_date);
      setPaymentMethod(initialData.payment_method || '');
      setProviderUrl(initialData.provider_url || '');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setPrice('');
      setCurrency('USD');
      setBillingCycle('monthly');
      setCategory('Software');
      setStatus('active');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setNextBillingDate(nextMonth.toISOString().split('T')[0]);
      setPaymentMethod('');
      setProviderUrl('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Please enter a valid non-negative price.');
      return;
    }

    if (!nextBillingDate) {
      setError('Please select a valid next billing date.');
      return;
    }

    setLoading(true);

    try {
      await onSave({
        name,
        price: parsedPrice,
        currency,
        billing_cycle: billingCycle,
        category,
        status,
        next_billing_date: nextBillingDate,
        payment_method: paymentMethod || null,
        provider_url: providerUrl || null,
        notes: notes || null,
      }, initialData?.id);

      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save subscription.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-bold text-white">
            {initialData ? 'Edit Subscription' : 'Add New Subscription'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">Subscription Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Netflix, Spotify, GitHub Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Price & Currency & Billing Cycle */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Price *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="15.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Cycle *</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as typeof billingCycles[number])}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white focus:outline-none focus:border-indigo-500 transition-colors capitalize"
              >
                {billingCycles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof categories[number])}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof statuses[number])}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white focus:outline-none focus:border-indigo-500 transition-colors capitalize"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Next Billing Date & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Next Billing Date *</label>
              <input
                type="date"
                required
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Payment Method</label>
              <input
                type="text"
                placeholder="e.g. Visa ending 4242"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Provider URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">Provider URL (Optional)</label>
            <input
              type="url"
              placeholder="https://netflix.com/account"
              value={providerUrl}
              onChange={(e) => setProviderUrl(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 block">Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="Additional renewal notes or plan tier details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{initialData ? 'Update Subscription' : 'Create Subscription'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
