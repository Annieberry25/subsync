'use client';

import { useState } from 'react';
import { Check, BellRing, Mail } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';
import { getPushPermissionState, isPushSupported } from '@/lib/push/client';

interface PaymentReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: {
    /** Days before renewal for the email, or null to turn email off. */
    emailLeadDays: number | null;
    /** Days before renewal for the push, or null to turn push off. */
    pushLeadDays: number | null;
    note?: string;
  }) => void;
  subscriptionName: string;
  nextBillingDate?: string;
  /** Existing saved preference, so reopening the sheet shows what is set. */
  initialEmailLeadDays?: number | null;
  initialPushLeadDays?: number | null;
}

/**
 * Why the two channels are separate controls
 *
 * Push replaces the 10-day "coming up" notice: it is free at this volume, arrives
 * while the app is closed, and is the better shape for a nudge. Email is opt-in
 * and charged against a monthly allowance, so it is off by default and carries a
 * user-chosen lead time rather than a fixed one — "3 days before" is what most
 * people mean by "tell me when it renews".
 */

const DEFAULT_PUSH_LEAD_DAYS = 10;
const DEFAULT_EMAIL_LEAD_DAYS = 3;

const EMAIL_LEAD_CHOICES = [
  { days: 1, label: '1 day before' },
  { days: 2, label: '2 days before' },
  { days: 3, label: '3 days before' },
  { days: 5, label: '5 days before' },
  { days: 7, label: '7 days before' },
  { days: 14, label: '14 days before' },
];

const PUSH_LEAD_CHOICES = [
  { days: 1, label: '1 day before' },
  { days: 3, label: '3 days before' },
  { days: 7, label: '7 days before' },
  { days: 10, label: '10 days before' },
  { days: 14, label: '14 days before' },
];

const REMINDER_FORM_ID = 'payment-reminder-form';

export default function PaymentReminderModal({
  isOpen,
  onClose,
  onSave,
  subscriptionName,
  initialEmailLeadDays,
  initialPushLeadDays,
}: PaymentReminderModalProps) {
  const { toast } = useToast();

  const [emailEnabled, setEmailEnabled] = useState(initialEmailLeadDays !== null);
  const [emailLeadDays, setEmailLeadDays] = useState<number>(
    initialEmailLeadDays ?? DEFAULT_EMAIL_LEAD_DAYS
  );
  const [pushEnabled, setPushEnabled] = useState(
    initialPushLeadDays !== null || initialPushLeadDays === undefined
  );
  const [pushLeadDays, setPushLeadDays] = useState<number>(
    initialPushLeadDays ?? DEFAULT_PUSH_LEAD_DAYS
  );
  const [note, setNote] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    // Re-seed from props each time it opens. Without this the sheet kept the last
    // values edited for a *different* subscription, so setting 3 days on Netflix
    // and then opening Spotify showed 3 days already selected for it.
    setEmailEnabled(initialEmailLeadDays !== null);
    setEmailLeadDays(initialEmailLeadDays ?? DEFAULT_EMAIL_LEAD_DAYS);
    setPushEnabled(initialPushLeadDays !== null || initialPushLeadDays === undefined);
    setPushLeadDays(initialPushLeadDays ?? DEFAULT_PUSH_LEAD_DAYS);
    setNote('');
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const pushPermission = getPushPermissionState();
  const pushAvailable = isPushSupported();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailEnabled && !pushEnabled) {
      toast.error('Choose at least one way to be reminded.', 'No Reminder Set');
      return;
    }

    if (
      pushEnabled &&
      pushAvailable &&
      pushPermission === 'denied'
    ) {
      // Saving a preference the browser will never honour is worse than saying so:
      // the user believes they set a reminder that can never arrive.
      toast.error(
        'Notifications are blocked for this site. Allow them in your browser settings first.',
        'Notifications Blocked'
      );
      return;
    }

    onSave({
      emailLeadDays: emailEnabled ? emailLeadDays : null,
      pushLeadDays: pushEnabled ? pushLeadDays : null,
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
      description="Choose how you'd like to be reminded before this renews."
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
      <form id={REMINDER_FORM_ID} onSubmit={handleSave} className="space-y-5 pt-1">
        {/* ---- Push ---- */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[13px] font-medium text-[#94A3B8] flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#14B8A6]" />
              Push notification
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              aria-label="Push notification reminder"
              onClick={() => setPushEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border ${
                pushEnabled
                  ? 'bg-[#14B8A6] border-[#14B8A6]'
                  : 'bg-[#0D0F0D] border-[#1A1D1D]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  pushEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-[#94A3B8]/80">
            Free, and arrives even when the app is closed. Replaces the old 10-day
            email.
          </p>

          {pushEnabled && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PUSH_LEAD_CHOICES.map((choice) => {
                  const isSelected = pushLeadDays === choice.days;
                  return (
                    <button
                      key={choice.days}
                      type="button"
                      onClick={() => setPushLeadDays(choice.days)}
                      className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#14B8A6] text-[#091512] font-semibold border-[#14B8A6]'
                          : 'bg-[#0D0F0F] text-[#94A3B8] border-[#1A1D1D] hover:bg-[#1A1D1D] hover:text-[#F5F7F6]'
                      }`}
                    >
                      <span className="truncate">{choice.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {pushPermission === 'denied' && (
                <p className="text-[11px] text-[#D9363E]">
                  Notifications are blocked for this site. Allow them in your browser
                  settings, otherwise this reminder cannot be delivered.
                </p>
              )}
            </>
          )}
        </div>

        {/* ---- Email ---- */}
        <div className="space-y-2.5 pt-1 border-t border-[#1A1D1D]/60">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[13px] font-medium text-[#94A3B8] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#14B8A6]" />
              Email
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              aria-label="Email reminder"
              onClick={() => setEmailEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border ${
                emailEnabled
                  ? 'bg-[#14B8A6] border-[#14B8A6]'
                  : 'bg-[#0D0F0D] border-[#1A1D1D]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  emailEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-[#94A3B8]/80">
            Off by default — email uses a limited monthly allowance, so it is only
            sent when you ask for it.
          </p>

          {emailEnabled && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EMAIL_LEAD_CHOICES.map((choice) => {
                const isSelected = emailLeadDays === choice.days;
                return (
                  <button
                    key={choice.days}
                    type="button"
                    onClick={() => setEmailLeadDays(choice.days)}
                    className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#14B8A6] text-[#091512] font-semibold border-[#14B8A6]'
                        : 'bg-[#0D0F0D] text-[#94A3B8] border-[#1A1D1D] hover:bg-[#1A1D1D] hover:text-[#F5F7F6]'
                    }`}
                  >
                    <span className="truncate">{choice.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Note ---- */}
        <div className="space-y-1.5 pt-1">
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