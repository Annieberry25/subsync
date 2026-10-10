'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/contexts/user-settings-context';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditEmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { email, reauthenticateAndChangeEmail } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      toast.error('Please enter a valid email address.', 'Validation Error');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast.error('Please enter a valid email address format (e.g. name@example.com).', 'Validation Error');
      return;
    }

    if (email && trimmedEmail === email.toLowerCase()) {
      toast.error('The new email must be different from your current email.', 'Validation Error');
      return;
    }

    if (!password) {
      toast.error('Please enter your current password to authorize this change.', 'Validation Error');
      return;
    }

    setSaving(true);
    try {
      await reauthenticateAndChangeEmail(password, trimmedEmail);
      toast.success(`We sent a verification link to ${trimmedEmail}.`, 'Verification Email Sent');
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update email address. Please try again.';
      toast.error(msg, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      {/* Header: bare back chevron + title */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            data-touch="compact"
            className="w-9 h-9 -ml-2 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer lg:hidden"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Enter Your New Email</h1>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          For security, enter your current password to authorize this change.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="new-email-input"
            className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block"
          >
            New Email
          </label>
          <input
            id="new-email-input"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoFocus
            className="w-full h-12 px-4 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm-password-input"
            className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block"
          >
            Current Password
          </label>
          <div className="relative">
            <input
              id="confirm-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-12 pl-4 pr-11 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              data-touch="compact"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Save, with generous breathing room below the password box */}
      <div className="pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-[#F5F7F6] hover:bg-white disabled:opacity-50 text-[#091512] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <span>Save</span>
          )}
        </button>
      </div>
    </div>
  );
}
