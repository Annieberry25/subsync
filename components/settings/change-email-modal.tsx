'use client';

import { useState } from 'react';
import { Mail, Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, X, KeyRound } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangeEmailModal({ isOpen, onClose }: ChangeEmailModalProps) {
  const { email: currentEmail, reauthenticateAndChangeEmail } = useUserSettings();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResetAndClose = () => {
    setStep(1);
    setPassword('');
    setShowPassword(false);
    setNewEmail('');
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Please enter your current password to continue.');
      return;
    }
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = newEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address format (e.g. name@example.com).');
      return;
    }

    if (trimmedEmail === currentEmail.toLowerCase()) {
      setError('The new email address must be different from your current email address.');
      return;
    }

    setLoading(true);

    try {
      await reauthenticateAndChangeEmail(password, trimmedEmail);
      setStep(3);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
        // If password re-auth failed, return to step 1 so user can re-enter password
        if (err.message.toLowerCase().includes('password')) {
          setStep(1);
        }
      } else {
        setError('Failed to update email address. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#0F1111] border border-[#1A1D1D] rounded-2xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 relative text-[#F5F7F6]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F5F7F6] p-1 rounded-lg hover:bg-[#1A1D1D] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Change Email Address</h2>
          </div>
          <p className="text-xs text-[#94A3B8]">
            {step === 1 && 'Step 1 of 2: Re-authenticate your account'}
            {step === 2 && 'Step 2 of 2: Enter your new email address'}
            {step === 3 && 'Verification email dispatched'}
          </p>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-start gap-2 text-[#D9363E] text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Re-authentication Form */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center gap-2.5 text-xs text-[#94A3B8]">
              <KeyRound className="w-4 h-4 text-[#14B8A6] shrink-0" />
              <span>For security, please enter your current password to authorize this email update.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#94A3B8] block">Current Password</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoFocus
                  className="w-full h-10 pl-10 pr-10 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F5F7F6] p-1 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="h-9 px-4 text-xs font-semibold rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Enter New Email */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#94A3B8] block">Current Email</label>
              <input
                type="email"
                disabled
                value={currentEmail}
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F]/60 text-[#94A3B8] cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#94A3B8] block">New Email Address</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  autoFocus
                  className="w-full h-10 pl-10 pr-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                disabled={loading}
                className="h-9 px-3 text-xs font-semibold rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  disabled={loading}
                  className="h-9 px-4 text-xs font-semibold rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 px-5 rounded-xl bg-[#14B8A6] hover:opacity-90 disabled:opacity-50 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#091512]" />}
                  <span>Send Verification Email</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 3: Success / Verification Sent State */}
        {step === 3 && (
          <div className="space-y-5 pt-1">
            <div className="p-4 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 space-y-2">
              <div className="flex items-center gap-2 text-[#14B8A6] text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Verification Email Sent!</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                We sent a confirmation link to <span className="text-[#F5F7F6] font-medium">{newEmail}</span>. Please check your inbox and click the link to verify your new email.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[11px] text-[#94A3B8] leading-relaxed">
              Your account email will remain <span className="text-[#F5F7F6] font-medium">{currentEmail}</span> until the new address is verified.
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="h-9 px-6 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
