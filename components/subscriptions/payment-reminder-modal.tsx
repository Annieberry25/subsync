'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, Check } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface PaymentReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: { timing: string; method: string; note?: string }) => void;
  subscriptionName: string;
  nextBillingDate?: string;
}

type TimingOption = '7_days' | '3_days' | '1_day' | 'custom';
type MethodOption = 'push' | 'email' | 'both';

const timingChoices: { id: TimingOption; label: string }[] = [
  { id: '7_days', label: '7 days before renewal' },
  { id: '3_days', label: '3 days before renewal' },
  { id: '1_day', label: '1 day before renewal' },
  { id: 'custom', label: 'Custom date' },
];

const methodChoices: { id: MethodOption; label: string }[] = [
  { id: 'push', label: 'Push Notification' },
  { id: 'email', label: 'Email' },
  { id: 'both', label: 'Both' },
];

export default function PaymentReminderModal({
  isOpen,
  onClose,
  onSave,
  subscriptionName,
}: PaymentReminderModalProps) {
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [timing, setTiming] = useState<TimingOption>('3_days');
  const [customDate, setCustomDate] = useState('');
  const [method, setMethod] = useState<MethodOption>('both');
  const [note, setNote] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form state & handle body overflow scroll locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTiming('3_days');
      setMethod('both');
      setNote('');
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      setCustomDate(defaultDate.toISOString().split('T')[0]);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // TODO: Integrate background notification scheduling & service worker / web push API
    const timingLabel = timingChoices.find((t) => t.id === timing)?.label || timing;
    const methodLabel = methodChoices.find((m) => m.id === method)?.label || method;

    if (onSave) {
      onSave({ timing, method, note: note.trim() || undefined });
    }

    toast.success(
      `Reminder set for ${subscriptionName} (${timingLabel} via ${methodLabel}).`,
      'Reminder Saved'
    );
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[480px] glass-panel rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] flex flex-col overflow-y-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 border border-env-subtle"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-env-main pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-env-status-active-bg text-env-status-active border border-env-status-active-border flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reminder-modal-title" className="text-lg font-black text-env-heading tracking-tight">
                Payment Reminder
              </h2>
              <p className="text-xs text-env-body mt-0.5">
                Stay ahead of your next renewal by choosing when you&apos;d like to be reminded to prepare for this payment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-xl bg-env-button-sec hover:bg-env-badge text-env-muted hover:text-env-heading flex items-center justify-center transition-colors cursor-pointer border border-env-subtle shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Reminder Timing Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-env-heading block">Reminder Timing</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {timingChoices.map((choice) => {
                const isSelected = timing === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setTiming(choice.id)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-env-status-active-bg text-env-status-active border-env-status-active-border shadow-sm'
                        : 'bg-env-badge/50 text-env-body border-env-subtle hover:bg-env-badge'
                    }`}
                  >
                    <span>{choice.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-env-status-active shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Input if 'custom' selected */}
            {timing === 'custom' && (
              <div className="pt-1">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-env-subtle bg-env-input text-env-heading focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Reminder Method Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-env-heading block">Reminder Method</label>
            <div className="grid grid-cols-3 gap-2">
              {methodChoices.map((choice) => {
                const isSelected = method === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setMethod(choice.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/40 shadow-sm'
                        : 'bg-env-badge/50 text-env-body border-env-subtle hover:bg-env-badge'
                    }`}
                  >
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-env-heading block">
              Optional Note
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Transfer money to my subscription account before renewal."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-env-subtle bg-env-input text-env-heading placeholder-env-muted focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-env-main">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-env-body hover:bg-env-badge border border-env-subtle transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Save Reminder
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
