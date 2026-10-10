'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { Factor } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/contexts/user-settings-context';
import { getAccountAuthMethods, type AccountAuthMethod } from '@/lib/auth/account-methods';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { ToggleSwitch } from '@/components/ui/toggle-switch';

const MIN_PASSWORD_LENGTH = 6;

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
        active
          ? 'bg-[#14B8A6]/15 text-[#14B8A6]'
          : 'bg-[#1A1D1D] text-[#94A3B8]'
      }`}
    >
      {label}
    </span>
  );
}

export default function AuthenticationPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const { updatePassword } = useAuth();

  const [methods, setMethods] = useState<AccountAuthMethod[]>([]);
  /* The account's real sign-in methods arrive asynchronously. Without this flag
     the page treats an unknown account as "no password", which flashes the
     Google note at the top of every visit and then yanks it away a moment
     later. Nothing about the account is claimed until it has been read. */
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [totpFactor, setTotpFactor] = useState<Factor | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([supabase.auth.getUser(), supabase.auth.mfa.listFactors()])
      .then(([userResult, factorResult]) => {
        if (!active) return;
        setMethods(getAccountAuthMethods(userResult.data.user));
        setTotpFactor(factorResult.data?.totp?.[0] ?? null);
        setMethodsLoaded(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [supabase]);

  const hasPassword = methods.includes('email');
  const hasGoogle = methods.includes('google');

  const handleSave = async () => {
    if (hasPassword && !currentPassword) {
      toast.error('Enter your current password to change it.', 'Validation Error');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        'Validation Error'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('The new passwords do not match.', 'Validation Error');
      return;
    }

    if (hasPassword && newPassword === currentPassword) {
      toast.error('Choose a password that is different from your current one.', 'Validation Error');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(hasPassword ? currentPassword : '', newPassword);
      toast.success('Password has been updated.', 'Password Updated');
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update your password.';
      toast.error(msg, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMfa = () => {
    if (mfaBusy) return;
    // Turning it on hands off to the setup page, which owns the QR/key and the
    // first code. Turning it off needs confirmation, since it weakens the login.
    if (!totpFactor) {
      router.push('/settings/authentication/setup');
      return;
    }
    setShowDisableConfirm(true);
  };

  const handleDisable = async () => {
    if (!totpFactor) return;
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;
      setTotpFactor(null);
      toast.success('Two-factor authentication has been turned off.', '2FA Disabled');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Could not turn off two-factor authentication.',
        'Update Failed'
      );
    } finally {
      setMfaBusy(false);
    }
  };

  const inputClass =
    'w-full h-12 pl-4 pr-11 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors';

  const renderPasswordField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    shown: boolean,
    toggle: () => void
  ) => (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={shown ? 'Hide password' : 'Show password'}
          data-touch="compact"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
        >
          {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl pb-16 animate-fade-in text-[#F5F7F6]">
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Authentication Methods</h1>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          The ways you can sign in to your SubHalt account, and how to update them.
        </p>
      </div>

      {/* Sign-in methods */}
      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden divide-y divide-[#1A1D1D]">
        <div className="flex items-center justify-between gap-4 min-h-[56px] px-4">
          <span className="text-sm font-medium text-[#F5F7F6]">Email &amp; Password</span>
          <StatusPill active={hasPassword} label={hasPassword ? 'Configured' : 'Not set'} />
        </div>

        <div className="flex items-center justify-between gap-4 min-h-[56px] px-4">
          <span className="text-sm font-medium text-[#F5F7F6]">Google</span>
          <StatusPill active={hasGoogle} label={hasGoogle ? 'Connected' : 'Not connected'} />
        </div>

        <div className="flex items-center justify-between gap-4 min-h-[56px] px-4">
          <span className="text-sm font-medium text-[#F5F7F6]">Enable 2FA</span>
          <ToggleSwitch
            checked={!!totpFactor}
            ariaLabel="Enable two-factor authentication"
            disabled={mfaBusy}
            onToggle={handleToggleMfa}
          />
        </div>
      </div>

      {/* Password form */}
      <div className="space-y-5">
        {methodsLoaded && !hasPassword && (
          <div className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs text-[#14B8A6] leading-relaxed">
            Your account currently signs in with Google. Set a password below to also sign in with
            your email address.
          </div>
        )}

        {hasPassword &&
          renderPasswordField(
            'current-password-input',
            'Current Password',
            currentPassword,
            setCurrentPassword,
            showCurrent,
            () => setShowCurrent((v) => !v)
          )}

        {renderPasswordField(
          'new-password-input',
          'New Password',
          newPassword,
          setNewPassword,
          showNew,
          () => setShowNew((v) => !v)
        )}

        {renderPasswordField(
          'confirm-password-input',
          'Confirm New Password',
          confirmPassword,
          setConfirmPassword,
          showConfirm,
          () => setShowConfirm((v) => !v)
        )}

        <div className="pt-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-[#F5F7F6] hover:bg-white disabled:opacity-50 text-[#091512] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
        onConfirm={handleDisable}
        title="Turn off two-factor authentication?"
        description="Your account will be protected by your password alone. You can turn it back on at any time."
        confirmText="Turn off"
        variant="danger"
        loading={mfaBusy}
      />
    </div>
  );
}
