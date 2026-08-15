'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, Check } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface PaymentReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: { timing: string; customDate?: string; method: string; note?: string }) => void;
  subscriptionName: string;
  nextBillingDate?: string;
}

type TimingOption = '1_day' | '3_days' | '7_days' | 'custom';
type MethodOption = 'email' | 'push' | 'both';

const timingChoices: { id: TimingOption; label: string }[] = [
  { id: '1_day', label: '1 Day Before' },
  { id: '3_days', label: '3 Days Before' },
  { id: '7_days', label: '7 Days Before' },
  { id: 'custom', label: 'Custom Date' },
];

const methodChoices: { id: MethodOption; label: string }[] = [
  { id: 'email', label: 'Email Only' },
  { id: 'push', label: 'In-App Toast' },
  { id: 'both', label: 'Email + Toast' },
];

const emptySubscribe = () => () => {};

export default function PaymentReminderModal({
  isOpen,
  onClose,
  onSave,
  subscriptionName,
}: PaymentReminderModalProps) {
  const { toast } = useToast();

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [timing, setTiming] = useState<TimingOption>('3_days');
  const [customDate, setCustomDate] = useState('');
  const [method, setMethod] = useState<MethodOption>('both');
  const [note, setNote] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setTiming('3_days');
    setMethod('both');
    setNote('');
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    setCustomDate(defaultDate.toISOString().split('T')[0]);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
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
        className="w-full sm:max-w-[480px] bg-[#0F1111] border border-[#1A1D1D] rounded-t-[24px] sm:rounded-[20px] p-5 sm:p-6 space-y-4 sm:space-y-5 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-y-auto animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#1A1D1D] pb-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-[#94A3B8]" />
              </div>
              <h2 id="reminder-modal-title" className="text-lg font-bold text-[#F5F7F6] tracking-tight">
                Payment Reminder
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Choose when you&apos;d like to be reminded before renewal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer border border-[#1A1D1D] shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Reminder Timing Section */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[#94A3B8] block">Reminder Timing</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {timingChoices.map((choice) => {
                const isSelected = timing === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setTiming(choice.id)}
                    className="px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-between border border-[#1A1D1D] bg-[#0D0F0F] hover:bg-[#1A1D1D] transition-colors text-left cursor-pointer"
                  >
                    <span className={isSelected ? 'text-[#F5F7F6] font-medium' : 'text-[#94A3B8]'}>{choice.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#14B8A6] shrink-0 ml-2" />}
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
                  className="w-full h-11 px-3.5 py-2 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
                />
              </div>
            )}
          </div>

          {/* Reminder Method Section */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[#94A3B8] block">Reminder Method</label>
            <div className="grid grid-cols-3 gap-2">
              {methodChoices.map((choice) => {
                const isSelected = method === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setMethod(choice.id)}
                    className={`px-2.5 py-2.5 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#14B8A6] text-[#091512] font-semibold border-[#14B8A6] shadow-sm shadow-[#14B8A6]/10'
                        : 'bg-[#0D0F0F] text-[#94A3B8] border-[#1A1D1D] hover:bg-[#1A1D1D] hover:text-[#F5F7F6]'
                    }`}
                  >
                    <span className="truncate">{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note Section */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#94A3B8] block">
              Optional Note
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Transfer money to my subscription account before renewal."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-[#1A1D1D]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl border border-[#1A1D1D] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#14B8A6] hover:opacity-90 text-[#091512] transition-colors cursor-pointer flex items-center justify-center"
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
