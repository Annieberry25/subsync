'use client';
import { clearLocalStorage } from '@/lib/safe-local-storage';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sheet from '@/components/ui/sheet';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteAccountModal({ isOpen, onClose, onDeleted }: DeleteAccountModalProps) {
  // Built once so the instance identity is stable across renders (otherwise the
  // identity-fetching effect below would re-run on every keystroke).
  const [supabase] = useState(() => createClient());
  const [hasPassword, setHasPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accounts signed in only through an OAuth provider (e.g. Google) have no
  // password, so the delete confirmation asks for a one-time emailed code
  // instead. The server checks the same identity list, so this is UI only.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setHasPassword(
        !Array.isArray(data.user?.identities) ||
          data.user.identities.length === 0 ||
          data.user.identities.some((id) => id.provider === 'email')
      );
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setShowPassword(false);
    setCode('');
    setCodeSent(false);
    setError(null);
    onClose();
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

    if (hasPassword && !password) {
      setError('Please enter your password to confirm account deletion.');
      return;
    }
    if (!hasPassword && !code) {
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

      let body: Record<string, string> = {};
      if (hasPassword) {
        // 1a. Re-authenticate with the current password (fresh session token required).
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });

        if (signInError) {
          setError('Incorrect password. Please enter your current account password to authorize deletion.');
          setLoading(false);
          return;
        }
        body = { password };
      } else {
        // 1b. The one-time emailed code is verified server-side.
        body = { code };
      }

      // 2. Perform deletion server-side to avoid depending on client state.
      const res = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to delete account. Please try again.');
        setLoading(false);
        return;
      }

      // 3. Clear local data and notify parent.
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
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer border border-[#1A1D1D] disabled:opacity-50"
          >
            Cancel
          </button>
          {!hasPassword && (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading || sendingCode || codeSent}
              className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer border border-[#1A1D1D] disabled:opacity-50"
            >
              {sendingCode ? 'Sending…' : codeSent ? 'Code sent' : 'Send code'}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#D9363E] hover:bg-[#B91C1C] text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <span>{loading ? 'Deleting…' : 'Delete My Account'}</span>
          </button>
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

        {hasPassword ? (
          <>
            {/* Password. `data-sheet-autofocus` focuses it once the entrance
                animation has started, which is also what scrolls it clear of the
                on-screen keyboard on a phone. */}
            <div className="space-y-1.5">
              <label htmlFor="delete-password" className="text-[12px] font-medium text-[#94A3B8] block">
                Current Password
              </label>
              <input
                id="delete-password"
                data-sheet-autofocus=""
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#D9363E] transition-colors disabled:opacity-50"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#94A3B8]">Show password</span>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={loading}
                className="accent-[#D9363E]"
              />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] p-3 text-[11px] leading-relaxed text-[#94A3B8]">
              Your account uses a social sign-in, so it does not have a password.
              Send a one-time code to your email, then enter it below to confirm deletion.
            </div>
            {codeSent && (
              <div className="rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/10 p-3 text-[11px] text-[#5EEAD4]">
                Code sent. Check your inbox (check spam too) — it expires in a few minutes.
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