'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { BrandWordmark } from '@/components/ui/brand-logo';
import { describeOAuthError } from '@/lib/auth/oauth-errors';
import type { SocialAuthProviderId } from '@/lib/supabase/cookie-options';
import {
  saveRememberedAccount,
  removeRememberedAccount,
  subscribeRememberedAccounts,
  getRememberedAccountsSnapshot,
  getRememberedAccountsServerSnapshot,
  RememberedAccount,
} from '@/lib/auth/remembered-accounts';
import { RememberedAccountChooser } from './remembered-account-chooser';
import { SocialAuthButtons } from './social-auth-buttons';
import { getSiteUrl, getAuthCallbackUrl } from '@/lib/utils/url-utils';

type LoginStep = 'chooser' | 'email' | 'password' | 'otp';

export function LoginFlow({ initialError }: { initialError?: string } = {}) {
  /**
   * The saved-accounts list is localStorage, i.e. an external store, so it is
   * read through useSyncExternalStore rather than seeded into useState.
   *
   * A useState initializer runs during render on the client only, so the server
   * emitted the email step while the client emitted the account chooser — a
   * hydration mismatch on every /login visit for anyone who had signed in
   * before, which React reports by discarding the server markup and re-rendering
   * the client tree. useSyncExternalStore takes an explicit server snapshot, so
   * the server and the hydration render both agree on "no accounts" and React
   * promotes to the chooser itself once the client store reports the real list.
   *
   * Promoted with `useState` + `useEffect` instead, it type-checks and passes
   * tests but trips react-hooks/set-state-in-effect, and it still renders the
   * email step for one frame before swapping — which is what made the Google
   * button look like it vanished after signing out.
   */
  const rememberedAccounts = useSyncExternalStore(
    subscribeRememberedAccounts,
    getRememberedAccountsSnapshot,
    getRememberedAccountsServerSnapshot
  );

  /**
   * `null` means "the user has not picked a step yet", so the landing step is
   * derived from whether any accounts are saved. Deriving it here rather than
   * pushing it into an effect keeps the landing screen a pure function of the
   * store, with no extra render pass.
   */
  const [requestedStep, setRequestedStep] = useState<LoginStep | null>(null);
  const step: LoginStep = requestedStep ?? (rememberedAccounts.length > 0 ? 'chooser' : 'email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();
  // Safe to call from the render body only because createClient() is a real
  // singleton — see lib/supabase/client.ts for what happens when it is not.
  const supabase = createClient();

  const handleRemoveAccount = (emailToRemove: string) => {
    // removeRememberedAccount notifies the store, which re-renders with the new
    // list; no local copy of it is kept.
    const updated = removeRememberedAccount(emailToRemove);
    if (updated.length === 0 && step === 'chooser') {
      setRequestedStep('email');
    }
  };

  const handleSelectAccount = (account: RememberedAccount) => {
    setEmail(account.email);
    setError(null);
    setSuccess(null);
    setRequestedStep('password');
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setRequestedStep('password');
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      // Server-side sign-in: session cookies are written via Set-Cookie
      // response headers (works even where document.cookie writes are blocked).
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        user?: {
          email?: string | null;
          user_metadata?: {
            full_name?: string;
            username?: string;
            avatar_url?: string;
          };
        };
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      if (data.user) {
        saveRememberedAccount({
          email: data.user.email || email.trim(),
          displayName: data.user.user_metadata?.full_name,
          username: data.user.user_metadata?.username,
          avatarUrl: data.user.user_metadata?.avatar_url,
        });
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getSiteUrl()}/login`,
      });
      if (resetErr) throw resetErr;
      setSuccess(`Password reset instructions sent to ${email.trim()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
        },
      });

      if (otpErr) throw otpErr;

      setRequestedStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send one-time code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError('Please enter the code sent to your email.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });

      if (verifyErr) throw verifyErr;

      if (data.user) {
        saveRememberedAccount({
          email: data.user.email || email.trim(),
          displayName: data.user.user_metadata?.full_name,
          username: data.user.user_metadata?.username,
          avatarUrl: data.user.user_metadata?.avatar_url,
        });
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: SocialAuthProviderId) => {
    setError(null);
    setSuccess(null);
    setSocialLoading(provider);

    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Always the origin the flow started on: the PKCE code verifier is a
          // cookie on that host, so a redirectTo anywhere else delivers the
          // callback where it does not exist.
          redirectTo: getAuthCallbackUrl(),
        },
      });

      if (oauthErr) {
        setError(describeOAuthError(oauthErr, provider));
      }
    } catch (err: unknown) {
      setError(describeOAuthError(err, provider));
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="w-full">
      {/* Alert Notices (Errors only, or explicit success actions) */}
      {error && (
        <div className="mb-5 p-3 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-2.5 text-[#D9363E] text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && step !== 'otp' && (
        <div className="mb-5 p-3 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center gap-2.5 text-[#14B8A6] text-xs leading-relaxed">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* STEP 0: Remembered Account Chooser */}
      {step === 'chooser' && (
        <RememberedAccountChooser
          accounts={rememberedAccounts}
          onSelectAccount={handleSelectAccount}
          onRemoveAccount={handleRemoveAccount}
          onSocialAuth={handleSocialAuth}
          socialLoading={socialLoading}
          onUseAnotherAccount={() => {
            setError(null);
            setSuccess(null);
            setRequestedStep('email');
          }}
        />
      )}

      {/* STEP 1: Enter Email & Social Login */}
      {step === 'email' && (
        <div>
          {rememberedAccounts.length > 0 && (
            <div className="mb-5 text-left">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setRequestedStep('chooser');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Saved accounts</span>
              </button>
            </div>
          )}

          {/* Logo/brand */}
          <div className="flex flex-col items-center justify-center space-y-2 mb-6">
            <BrandWordmark height={30} priority />
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight text-center">
            Welcome back
          </h1>

          {/* Description */}
          <p className="text-xs sm:text-sm text-[#94A3B8] text-center mt-1.5 mb-7">
            Log in to your account to manage your recurring subscriptions.
          </p>

          {/* Social buttons */}
          <SocialAuthButtons
            loadingProvider={socialLoading}
            disabled={loading}
            onSelect={handleSocialAuth}
          />

          {/* OR divider */}
          <div className="flex items-center gap-3 my-7 py-0.5">
            <div className="flex-1 h-px bg-[#1A1D1D]" />
            <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">OR</span>
            <div className="flex-1 h-px bg-[#1A1D1D]" />
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                className="w-full px-4 py-2 text-xs sm:text-sm rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/60 transition-colors h-10 sm:h-10.5"
              />
            </div>

            <Button type="submit" size="md" className="w-full font-semibold h-10 sm:h-10.5 rounded-full">
              Continue
            </Button>

            {/* Sign-up footer */}
            <div className="text-center mt-7 pt-1">
              <p className="text-xs text-[#94A3B8]">
                Don&apos;t have an account?{' '}
                <Link id="nav-to-signup" href="/signup" className="text-[#14B8A6] hover:underline font-semibold cursor-pointer">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: Dedicated Password Screen */}
      {step === 'password' && (
        <div>
          {/* Back button */}
          <div className="mb-5 text-left">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setRequestedStep('email');
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight text-center mb-6">
            Enter your password
          </h1>

          <form onSubmit={handlePasswordLogin} className="space-y-5">
            {/* Email Address display block with Edit action */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Email address</label>
              <div className="w-full px-4 py-2.5 rounded-xl bg-[#000000] border border-[#1A1D1D] flex items-center justify-between gap-3 text-xs sm:text-sm">
                <span className="text-[#F5F7F6] font-medium truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setRequestedStep('email');
                  }}
                  className="text-xs text-[#14B8A6] hover:underline font-semibold shrink-0 cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Password input + Forgot password */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#94A3B8]">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#94A3B8] hover:text-[#14B8A6] transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  className="w-full px-4 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/60 transition-colors h-10.5 sm:h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer p-1 rounded-md flex items-center justify-center"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <Button type="submit" size="md" loading={loading} className="w-full font-semibold h-10.5 sm:h-11 rounded-full mt-2">
              Continue
            </Button>
          </form>

          {/* OR divider */}
          <div className="flex items-center gap-3 my-7 py-0.5">
            <div className="flex-1 h-px bg-[#1A1D1D]" />
            <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">OR</span>
            <div className="flex-1 h-px bg-[#1A1D1D]" />
          </div>

          {/* Secondary Option: Log in with a one-time code */}
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={handleRequestOtp}
            loading={loading}
            className="w-full text-xs sm:text-sm font-semibold h-10.5 sm:h-11 rounded-full"
          >
            Log in with a one-time code
          </Button>

          {/* Footer: Terms of Use | Privacy Policy */}
          <div className="text-center mt-8 pt-4 border-t border-[#1A1D1D]/50 text-[11px] text-[#94A3B8] flex items-center justify-center gap-3">
            <a href="/settings" className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Terms of Use</a>
            <span className="text-[#1A1D1D]">|</span>
            <a href="/settings" className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Privacy Policy</a>
          </div>
        </div>
      )}

      {/* STEP 3: One-Time Code Verification Page */}
      {step === 'otp' && (
        <div>
          {/* Back button */}
          <div className="mb-5 text-left">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setRequestedStep('email');
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight text-center">
            Check your inbox
          </h1>

          {/* Description */}
          <p className="text-xs sm:text-sm text-[#94A3B8] text-center mt-1.5 mb-7">
            We sent a code to <span className="text-[#F5F7F6] font-medium">{email}</span>
          </p>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Label outside input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Verification code</label>
              <input
                type="text"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder=""
                className="w-full px-4 py-2 text-center text-base sm:text-lg font-mono tracking-widest rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/60 transition-colors h-10.5 sm:h-11"
              />
            </div>

            <Button type="submit" size="md" loading={loading} className="w-full font-semibold h-10.5 sm:h-11 rounded-full">
              Verify & Log in
            </Button>
          </form>

          {/* Resend code */}
          <div className="text-center mt-5">
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={loading}
              className="text-xs text-[#14B8A6] hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              Resend code
            </button>
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-3 my-7 py-0.5">
            <div className="flex-1 h-px bg-[#1A1D1D]" />
            <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">OR</span>
            <div className="flex-1 h-px bg-[#1A1D1D]" />
          </div>

          {/* Secondary Option: Continue with password */}
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setRequestedStep('password');
            }}
            className="w-full text-xs sm:text-sm font-semibold h-10.5 sm:h-11 rounded-full"
          >
            Continue with password
          </Button>

          {/* Footer: Terms of Use | Privacy Policy */}
          <div className="text-center mt-8 pt-4 border-t border-[#1A1D1D]/50 text-[11px] text-[#94A3B8] flex items-center justify-center gap-3">
            <a href="/settings" className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Terms of Use</a>
            <span className="text-[#1A1D1D]">|</span>
            <a href="/settings" className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Privacy Policy</a>
          </div>
        </div>
      )}
    </div>
  );
}
