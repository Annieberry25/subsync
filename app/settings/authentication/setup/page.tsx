'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, Copy, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/hooks/use-toast';
import { MFA_FACTOR_FRIENDLY_NAME, totpQrCodeSrc } from '@/lib/auth/mfa';

const TOTP_CODE_LENGTH = 6;

export default function AuthenticatorSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        /**
         * Supabase allows one TOTP factor per friendly name, so an abandoned
         * attempt leaves a factor behind that makes every later `enroll` fail
         * with "a factor with the friendly name ... already exists". Clear the
         * half-finished state before enrolling rather than reporting an error
         * the user can do nothing about.
         */
        const { data: existing } = await supabase.auth.mfa.listFactors();
        const totp = existing?.all?.filter((f) => f.factor_type === 'totp') ?? [];

        // Nothing to set up if a factor is already verified. Bailing here also
        // means a stale link to this page can never unenroll a working factor.
        if (totp.some((f) => f.status === 'verified')) {
          if (active) router.replace('/settings/authentication');
          return;
        }

        for (const factor of totp) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: MFA_FACTOR_FRIENDLY_NAME,
        });
        if (error || !data) throw error ?? new Error('Could not start setup.');
        if (!active) return;
        setEnrollData({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      } catch (err: unknown) {
        if (!active) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not start two-factor setup.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, router]);

  const handleBack = async () => {
    // Backing out before the code is confirmed leaves an unverified factor
    // behind; discard it so the account is not left with a dangling enrollment.
    if (enrollData?.id) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
      } catch {
        /* best effort */
      }
    }
    router.back();
  };

  const handleVerify = async () => {
    if (!enrollData) return;
    const code = verificationCode.trim();
    if (code.length < TOTP_CODE_LENGTH) {
      toast.error('Enter the 6-digit code from your authenticator app.', 'Validation Error');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.id,
        code,
      });
      if (error) throw error;
      toast.success('Two-factor authentication is now on.', '2FA Enabled');
      router.replace('/settings/authentication');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'That code could not be verified.',
        'Verification Failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopySecret = async () => {
    if (!enrollData) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard access can be blocked; the key is still visible to type. */
    }
  };

  return (
    <div className="space-y-8 max-w-3xl pb-16 animate-fade-in text-[#F5F7F6]">
      {/* Header: bare back chevron + title */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            data-touch="compact"
            className="w-9 h-9 -ml-2 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Set up your authenticator app
          </h1>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          Scan the QR code with Google Authenticator, Authy, or any TOTP app, then enter the 6-digit
          code it shows.
        </p>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#94A3B8]">
          <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />
          <span>Preparing your setup...</span>
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-5 text-xs text-[#D9363E] leading-relaxed">
          {errorMessage}
        </div>
      ) : enrollData ? (
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-5 space-y-5">
          <div className="flex justify-center">
            <div className="p-3 rounded-xl bg-white">
              {/* Supabase returns the QR as an SVG string, so it is rendered as a
                  data-URI <img> rather than anything needing a domain allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={totpQrCodeSrc(enrollData.qr)}
                alt="Authenticator setup QR code"
                className="w-44 h-44"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#94A3B8] block">
              Or enter this key manually
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate px-4 py-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs text-[#F5F7F6] font-mono">
                {enrollData.secret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                aria-label="Copy setup key"
                data-touch="compact"
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl border border-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#14B8A6]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="totp-verify-input"
              className="text-xs font-medium text-[#94A3B8] block"
            >
              Enter the 6-digit code
            </label>
            <input
              id="totp-verify-input"
              type="text"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, TOTP_CODE_LENGTH))
              }
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={TOTP_CODE_LENGTH}
              className="w-full h-12 px-4 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={busy}
              className="flex-1 h-12 rounded-xl border border-[#1A1D1D] text-sm font-semibold text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy}
              className="flex-1 h-12 rounded-xl bg-[#F5F7F6] hover:bg-white disabled:opacity-50 text-[#091512] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Verify</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
