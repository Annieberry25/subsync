'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => Promise<void>;
  initialData?: SubscriptionRow | null;
}

const categories = ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'] as const;
const billingCycles = ['monthly', 'yearly', 'quarterly', 'weekly'] as const;
const statuses = ['active', 'paused', 'canceled', 'trial'] as const;

export default function SubscriptionModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: SubscriptionModalProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<typeof billingCycles[number]>('monthly');
  const [category, setCategory] = useState<typeof categories[number]>('Streaming');
  const [status, setStatus] = useState<typeof statuses[number]>('active');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string; date?: string }>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPrice(initialData.price.toString());
      setCurrency(initialData.currency);
      setBillingCycle(initialData.billing_cycle as typeof billingCycles[number]);
      setCategory(initialData.category as typeof categories[number]);
      setStatus(initialData.status as typeof statuses[number]);
      setNextBillingDate(initialData.next_billing_date);
      setPaymentMethod(initialData.payment_method || '');
      setProviderUrl(initialData.provider_url || '');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setPrice('');
      setCurrency('USD');
      setBillingCycle('monthly');
      setCategory('Streaming');
      setStatus('active');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setNextBillingDate(nextMonth.toISOString().split('T')[0]);
      setPaymentMethod('');
      setProviderUrl('');
      setNotes('');
    }
    setFieldErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const setQuickDate = (monthsToAdd: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToAdd);
    setNextBillingDate(d.toISOString().split('T')[0]);
  };

  const validateForm = () => {
    const errors: { name?: string; price?: string; date?: string } = {};

    if (!name.trim()) {
      errors.name = 'Subscription name is required.';
    }

    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.price = 'Enter a valid price > 0.';
    }

    if (!nextBillingDate) {
      errors.date = 'Next billing date is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    const parsedPrice = parseFloat(price);

    try {
      await onSave(
        {
          name: name.trim(),
          price: parsedPrice,
          currency,
          billing_cycle: billingCycle,
          category,
          status,
          next_billing_date: nextBillingDate,
          payment_method: paymentMethod.trim() || null,
          provider_url: providerUrl.trim() || null,
          notes: notes.trim() || null,
        },
        initialData?.id
      );

      toast.success(
        initialData ? `Updated "${name}" successfully.` : `Added "${name}" subscription!`,
        initialData ? 'Subscription Updated' : 'Subscription Created'
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save subscription.';
      toast.error(msg, 'Save Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] glass-panel rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-env-main pb-5 shrink-0">
          <h2 id="modal-title" className="text-xl font-black text-env-heading tracking-tight">
            {initialData ? 'Edit Subscription' : 'Add New Subscription'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-2xl bg-env-button-sec hover:bg-env-badge flex items-center justify-center text-env-muted hover:text-env-heading transition-colors cursor-pointer border border-env-subtle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-env-body block">Subscription Name *</label>
            <input
              type="text"
              placeholder="e.g. Netflix, Spotify, GitHub Pro"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none transition-colors ${
                fieldErrors.name ? 'border-rose-500/80 focus:border-rose-500' : 'border-env-main focus:border-indigo-500'
              }`}
            />
            {fieldErrors.name && (
              <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* Price & Currency & Billing Cycle */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Price *</label>
              <input
                type="number"
                step="0.01"
                placeholder="15.99"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: undefined }));
                }}
                className={`w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none transition-colors ${
                  fieldErrors.price ? 'border-rose-500/80 focus:border-rose-500' : 'border-env-main focus:border-indigo-500'
                }`}
              />
              {fieldErrors.price && (
                <span className="text-[10px] text-rose-400 font-medium">{fieldErrors.price}</span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-11 px-3.5 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="USD" className="bg-env-card text-env-heading">USD ($)</option>
                <option value="EUR" className="bg-env-card text-env-heading">EUR (€)</option>
                <option value="GBP" className="bg-env-card text-env-heading">GBP (£)</option>
                <option value="CAD" className="bg-env-card text-env-heading">CAD ($)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Cycle *</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as typeof billingCycles[number])}
                className="w-full h-11 px-3.5 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors capitalize"
              >
                {billingCycles.map((c) => (
                  <option key={c} value={c} className="bg-env-card text-env-heading capitalize">{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof categories[number])}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-env-card text-env-heading">{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof statuses[number])}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors capitalize"
              >
                {statuses.map((s) => (
                  <option key={s} value={s} className="bg-env-card text-env-heading capitalize">{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Next Billing Date & Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-env-body block">Next Billing Date *</label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="px-3 py-1 rounded-xl bg-env-button-sec hover:bg-env-badge text-env-body hover:text-env-heading transition-colors cursor-pointer border border-env-subtle font-semibold"
                >
                  +1 Month
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(12)}
                  className="px-3 py-1 rounded-xl bg-env-button-sec hover:bg-env-badge text-env-body hover:text-env-heading transition-colors cursor-pointer border border-env-subtle font-semibold"
                >
                  +1 Year
                </button>
              </div>
            </div>
            <input
              type="date"
              value={nextBillingDate}
              onChange={(e) => setNextBillingDate(e.target.value)}
              className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {fieldErrors.date && (
              <span className="text-[10px] text-rose-400 font-medium">{fieldErrors.date}</span>
            )}
          </div>

          {/* Payment Method & Provider URL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Payment Method</label>
              <input
                type="text"
                placeholder="e.g. Visa ending 4242"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-env-body block">Provider URL</label>
              <input
                type="url"
                placeholder="https://netflix.com"
                value={providerUrl}
                onChange={(e) => setProviderUrl(e.target.value)}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-env-body block">Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="Additional renewal notes or plan tier details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-env-main shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl min-h-[44px] text-xs font-bold text-env-body hover:text-env-heading hover:bg-env-button-sec transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-2xl min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
