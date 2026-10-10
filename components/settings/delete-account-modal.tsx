'use client';
import { clearLocalStorage } from '@/lib/safe-local-storage';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sheet from '@/components/ui/sheet';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

const DELETE_REASONS = [
  'Too expensive',
  'Missing features',
  'Bugs / technical issues',
  'Privacy concerns',
  'Switching to another app',
  'Other',
] as const;

export function DeleteAccountModal({ isOpen, onClose, onDeleted }: DeleteAccountModalProps) {
  // Built once so the instance identity is stable across renders.
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<'reason' | 'code'>('reason');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonLabel, setReasonLabel] = useState<string>('');
  const [reasonNote, setReasonNote] = useState('');

  const handleClose = () => {
    if (loading) return;
    setStep('reason');
    setCode('');
    setCodeSent(false);
    setError(null);
    onClose();
  };

  const handleContinue = () => {
    setError(null);
    if (!reasonLabel && !reasonNote.trim()) {
      setError('Please tell us why you are leaving so we can keep improving.');
      return;
    }
    setStep('code');
  };

  const handleSendCode = async () => {
    setError(null);
    setSendingCode(true);
    try {
      const res = await fetch('/api/profile/delete-account/send-code', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to send the code. Please try again.');
        return;
      }
      setCodeSent(true);
    } catch {
      setError('Failed to send the code. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleDelete = async () => {
    setError(null);

    if (!code) {
      setError('Enter the code sent to your email to confirm account deletion.');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('Unable to verify your session. Please log out and log back in.');
        setLoading(false);
        return;
      }

      const reason = [reasonLabel, reasonNote.trim()].filter(Boolean).join(': ');

      // Deletion is performed server-side to avoid depending on client state.
      const res = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, reason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to delete account. Please try again.');
        setLoading(false);
        return;
      }

      // Clear local data and notify parent.
      if (typeof window !== 'undefined') {
        clearLocalStorage();
      }
      onDeleted();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={handleClose}
      size="sm"
      title={<span className="text-[#D9363E]">Delete Account</span>}
      description="This action is permanent. All subscriptions, bills, and settings will be erased. Confirm that you own this account to continue."
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          {step === 'reason' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer border border-[#1A1D1D] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#D9363E] hover:bg-[#B91C1C] text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer border border-[#1A1D1D] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={loading || sendingCode || codeSent}
                className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer border border-[#1A1D1D] disabled:opacity-50"
              >
                {sendingCode ? 'Sending…' : codeSent ? 'Code sent' : 'Send code'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#D9363E] hover:bg-[#B91C1C] text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <span>{loading ? 'Deleting…' : 'Delete My Account'}</span>
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/20 text-[#D9363E] text-xs leading-relaxed">
            {error}
          </div>
        )}

        {step === 'reason' ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[#94A3B8]">
              We&apos;re sorry to see you go. Tell us why you&apos;re leaving so we can make
               SubHalt better.
            </p>
            <div className="flex flex-wrap gap-2">
              {DELETE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={loading}
                  onClick={() => setReasonLabel(reasonLabel === reason ? '' : reason)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    reasonLabel === reason
                      ? 'bg-[#D9363E]/15 text-[#FCA5A5] border border-[#D9363E]/40'
                      : 'bg-[#0D0F0F] text-[#94A3B8] border border-[#1A1D1D] hover:text-[#F5F7F6]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="delete-reason-note" className="text-[12px] font-medium text-[#94A3B8] block">
                Tell us more <span className="text-[#64748B]">(optional)</span>
              </label>
              <textarea
                id="delete-reason-note"
                data-sheet-autofocus=""
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                disabled={loading}
                rows={4}
                maxLength={2000}
                placeholder="What could we have done better?"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#D9363E] transition-colors disabled:opacity-50 resize-none"
              />
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('reason')}
              disabled={loading}
              className="text-[11px] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer disabled:opacity-50 self-start"
            >
              ← Change reason
            </button>

            <div className="rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] p-3 text-[11px] leading-relaxed text-[#94A3B8]">
              A one-time code will be sent to the email on your account. Enter it below to confirm
              deletion.
            </div>

            {codeSent && (
              <div className="rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/10 p-3 text-[11px] text-[#5EEAD4]">
                Code sent. Check your inbox (check spam too). It expires in a few minutes.
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="delete-code" className="text-[12px] font-medium text-[#94A3B8] block">
                Deletion code
              </label>
              <input
                id="delete-code"
                data-sheet-autofocus=""
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={loading}
                className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#D9363E] transition-colors disabled:opacity-50"
              />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}