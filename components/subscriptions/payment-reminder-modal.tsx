'use client';

import { useState } from 'react';
import { Mail, BellRing } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';
import { DEFAULT_USER_LEAD_MINUTES, MAX_LEAD_MINUTES } from '@/lib/reminders/plan';

interface PaymentReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Lead offsets in minutes before the renewal, or null when a channel was
   * explicitly turned off. The modal presents a Timing choice (radio: 12 hours /
   * 3 hours / custom) and a Method choice (Email + Push checkboxes) and
   * translates them into these two values.
   */
  onSave: (reminder: {
    emailLeadMinutes: number | null;
    pushLeadMinutes: number | null;
    note?: string;
  }) => void;
  subscriptionName: string;
  nextBillingDate?: string;
  initialEmailLeadMinutes?: number | null;
  initialPushLeadMinutes?: number | null;
}

type TimingOption = '12_hours' | '3_hours' | 'custom';

const timingChoices: { id: TimingOption; label: string; minutes?: number }[] = [
  { id: '12_hours', label: '12 Hours Before', minutes: 12 * 60 },
  { id: '3_hours', label: '3 Hours Before', minutes: 3 * 60 },
  { id: 'custom', label: 'Custom' },
];

const REMINDER_FORM_ID = 'payment-reminder-form';

/** Map the saved lead offsets in minutes back onto the Timing + Method controls. */
function seedControls(
  emailLeadMinutes: number | null | undefined,
  pushLeadMinutes: number | null | undefined
): { timing: TimingOption; email: boolean; push: boolean; customHours: string } {
  const emailSaved = typeof emailLeadMinutes === 'number' && emailLeadMinutes > 0;
  const pushSaved = typeof pushLeadMinutes === 'number' && pushLeadMinutes > 0;
  const anySaved = emailLeadMinutes !== undefined || pushLeadMinutes !== undefined;

  // No preference saved yet: this reminder is opt-in, so default to push on and
  // email off, at the default heads-up. The automatic day-before reminder is
  // separate and always on, so this only controls the user's own extra reminder.
  const email = anySaved ? emailSaved : false;
  const push = anySaved ? pushSaved : true;

  const lead = emailSaved
    ? (emailLeadMinutes as number)
    : pushSaved
      ? (pushLeadMinutes as number)
      : DEFAULT_USER_LEAD_MINUTES;
  const preset = timingChoices.find((t) => t.minutes === lead);

  return {
    timing: preset ? preset.id : 'custom',
    email,
    push,
    customHours: String(Math.max(1, Math.round(lead / 60))),
  };
}

export default function PaymentReminderModal({
  isOpen,
  onClose,
  onSave,
  subscriptionName,
  initialEmailLeadMinutes,
  initialPushLeadMinutes,
}: PaymentReminderModalProps) {
  const { toast } = useToast();

  const [timing, setTiming] = useState<TimingOption>(
    () => seedControls(initialEmailLeadMinutes, initialPushLeadMinutes).timing
  );
  const [customHours, setCustomHours] = useState(
    () => seedControls(initialEmailLeadMinutes, initialPushLeadMinutes).customHours
  );
  const [emailOn, setEmailOn] = useState(
    () => seedControls(initialEmailLeadMinutes, initialPushLeadMinutes).email
  );
  const [pushOn, setPushOn] = useState(
    () => seedControls(initialEmailLeadMinutes, initialPushLeadMinutes).push
  );
  const [note, setNote] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    // Re-seed from props each time it opens so one subscription's choices do
    // not leak into the next.
    const seeded = seedControls(initialEmailLeadMinutes, initialPushLeadMinutes);
    setTiming(seeded.timing);
    setCustomHours(seeded.customHours);
    setEmailOn(seeded.email);
    setPushOn(seeded.push);
    setNote('');
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailOn && !pushOn) {
      toast.error('Choose at least one reminder method.', 'No Method Selected');
      return;
    }

    let leadMinutes: number;
    if (timing === 'custom') {
      const hours = Number(customHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        toast.error('Enter how many hours before the renewal.', 'Invalid Time');
        return;
      }
      if (hours * 60 > MAX_LEAD_MINUTES) {
        toast.error('Pick a time within 30 days before the renewal.', 'Too Far Ahead');
        return;
      }
      leadMinutes = Math.round(hours * 60);
    } else {
      leadMinutes = timingChoices.find((t) => t.id === timing)?.minutes ?? DEFAULT_USER_LEAD_MINUTES;
    }

    onSave({
      emailLeadMinutes: emailOn ? leadMinutes : null,
      pushLeadMinutes: pushOn ? leadMinutes : null,
      note: note.trim() || undefined,
    });

    toast.success(`Reminder set for ${subscriptionName}.`, 'Reminder Saved');
    onClose();
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      placement="bottom"
      size="sm"
      title="Payment Reminder"
      description="Choose when and how you'd like to be reminded before renewal."
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
      <form id={REMINDER_FORM_ID} onSubmit={handleSave} className="space-y-5 pt-1">
        {/* ---- Timing (single choice, plain radio list) ---- */}
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium text-[#94A3B8]">Reminder Timing</legend>
          <div className="rounded-xl border border-[#1A1D1D] divide-y divide-[#1A1D1D] overflow-hidden">
            {timingChoices.map((choice) => {
              const isSelected = timing === choice.id;
              return (
                <label
                  key={choice.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reminder-timing"
                    value={choice.id}
                    checked={isSelected}
                    onChange={() => setTiming(choice.id)}
                    className="w-4 h-4 shrink-0 accent-[#14B8A6]"
                  />
                  <span
                    className={`text-xs ${isSelected ? 'text-[#F5F7F6] font-medium' : 'text-[#94A3B8]'}`}
                  >
                    {choice.label}
                  </span>
                </label>
              );
            })}
          </div>

          {timing === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={MAX_LEAD_MINUTES / 60}
                step={1}
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-24 h-11 px-3.5 py-2 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
                aria-label="Hours before renewal"
              />
              <span className="text-xs text-[#94A3B8]">hours before renewal</span>
            </div>
          )}
        </fieldset>

        {/* ---- Method (independent channels) ---- */}
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium text-[#94A3B8]">Reminder Method</legend>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                emailOn
                  ? 'bg-[#1F2425] text-[#F5F7F6] font-semibold border-[#2A3032]'
                  : 'bg-[#0D0F0F] text-[#94A3B8] border-[#1A1D1D] hover:bg-[#1A1D1D] hover:text-[#F5F7F6]'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={emailOn}
                onChange={(e) => setEmailOn(e.target.checked)}
              />
              <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Email</span>
            </label>

            <label
              className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                pushOn
                  ? 'bg-[#1F2425] text-[#F5F7F6] font-semibold border-[#2A3032]'
                  : 'bg-[#0D0F0F] text-[#94A3B8] border-[#1A1D1D] hover:bg-[#1A1D1D] hover:text-[#F5F7F6]'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={pushOn}
                onChange={(e) => setPushOn(e.target.checked)}
              />
              <BellRing className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Push Notification</span>
            </label>
          </div>
        </fieldset>

        {/* ---- Optional note ---- */}
        <div className="space-y-1.5">
          <label
            htmlFor="reminder-note"
            className="text-[13px] font-medium text-[#94A3B8] block"
          >
            Optional Note
          </label>
          <textarea
            id="reminder-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] resize-none"
          />
        </div>
      </form>
    </Sheet>
  );
}