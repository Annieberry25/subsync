'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';

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

const REMINDER_FORM_ID = 'payment-reminder-form';

export default function PaymentReminderModal({
  isOpen,
  onClose,
  onSave,
  subscriptionName,
}: PaymentReminderModalProps) {
  const { toast } = useToast();

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

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      placement="bottom"
      size="sm"
      title="Payment Reminder"
      description="Choose when you'd like to be reminded before renewal."
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl border border-[#1A1D1D] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={REMINDER_FORM_ID}
            className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#14B8A6] hover:opacity-90 text-[#091512] transition-colors cursor-pointer flex items-center justify-center"
          >
            Save Reminder
          </button>
        </div>
      }
    >
        {/* Form Body. Actions live in the Sheet footer and submit via `form`. */}
        <form id={REMINDER_FORM_ID} onSubmit={handleSave} className="space-y-4 pt-1">
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

        </form>
    </Sheet>
  );
}
