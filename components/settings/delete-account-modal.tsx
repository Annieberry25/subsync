'use client';
import { clearLocalStorage } from '@/lib/safe-local-storage';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteAccountModal({ isOpen, onClose, onDeleted }: DeleteAccountModalProps) {
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setShowPassword(false);
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    setError(null);

    if (!password) {
      setError('Please enter your password to confirm account deletion.');
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

      // 1. Re-authenticate with the current password (fresh session token required).
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (signInError) {
        setError('Incorrect password. Please enter your current account password to authorize deletion.');
        setLoading(false);
        return;
      }

      // 2. Perform deletion server-side to avoid depending on client state.
      const res = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-desc"
    >
      <div
        className="w-full max-w-md bg-[#0F1111] border border-[#1A1D1D] rounded-[20px] p-6 space-y-5 text-[#F5F7F6]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="space-y-1">
          <h2 id="delete-account-title" className="text-lg font-bold text-[#D9363E] tracking-tight">
            Delete Account
          </h2>
          <p id="delete-account-desc" className="text-xs text-[#94A3B8] leading-relaxed">
            This action is permanent. All subscriptions, bills, and settings will be erased. Please enter your password to confirm.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/20 text-[#D9363E] text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="delete-password" className="text-[12px] font-medium text-[#94A3B8] block">
            Current Password
          </label>
          <input
            id="delete-password"
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoFocus
            disabled={loading}
            className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#D9363E] transition-colors disabled:opacity-50"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
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
            onClick={handleDelete}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#D9363E] hover:bg-[#B91C1C] text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <span>{loading ? 'Deleting…' : 'Delete My Account'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
