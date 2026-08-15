'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  getRememberedAccounts,
  saveRememberedAccount,
  removeRememberedAccount,
  RememberedAccount,
} from '@/lib/auth/remembered-accounts';
import { RememberedAccountChooser } from './remembered-account-chooser';
import { getAuthCallbackUrl } from '@/lib/utils/url-utils';

export function LoginFlow() {
  const [step, setStep] = useState<'chooser' | 'email' | 'password' | 'otp'>('email');
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const cached = getRememberedAccounts();
    setRememberedAccounts(cached);
    if (cached.length > 0) {
      setStep('chooser');
    }
  }, []);

  const handleRemoveAccount = (emailToRemove: string) => {
    const updated = removeRememberedAccount(emailToRemove);
    setRememberedAccounts(updated);
    if (updated.length === 0 && step === 'chooser') {
      setStep('email');
    }
  };

  const handleSelectAccount = (account: RememberedAccount) => {
    setEmail(account.email);
    setError(null);
    setSuccess(null);
    setStep('password');
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
    setStep('password');
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

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
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/login`,
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

      setStep('otp');
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

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    setSuccess(null);
    setSocialLoading(provider);

    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl(),
        },
      });

      if (oauthErr) {
        const providerName = provider === 'google' ? 'Google' : 'Apple';
        if (
          oauthErr.message.includes('not enabled') ||
          oauthErr.message.includes('Unsupported provider') ||
          oauthErr.message.includes('provider')
        ) {
          setError(`${providerName} authentication requires provider configuration in your Supabase dashboard.`);
        } else {
          setError(oauthErr.message);
        }
      }
    } catch (err: unknown) {
      const providerName = provider === 'google' ? 'Google' : 'Apple';
      setError(`${providerName} authentication requires provider setup in Supabase.`);
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
          onUseAnotherAccount={() => {
            setError(null);
            setSuccess(null);
            setStep('email');
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
                  setStep('chooser');
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
            <span className="text-xl font-bold text-[#14B8A6] tracking-tight">SubHalt</span>
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
          <div className="space-y-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleSocialAuth('google')}
              disabled={!!socialLoading || loading}
              loading={socialLoading === 'google'}
              className="w-full text-xs sm:text-sm font-semibold h-10 sm:h-10.5 rounded-full"
              icon={
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"
                  />
                </svg>
              }
            >
              Continue with Google
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => handleSocialAuth('apple')}
              disabled={!!socialLoading || loading}
              loading={socialLoading === 'apple'}
              className="w-full text-xs sm:text-sm font-semibold h-10 sm:h-10.5 rounded-full"
              icon={
                <svg className="w-4 h-4 fill-current text-white shrink-0" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.67-.82 1.13-1.96.99-3.1-.97.04-2.17.65-2.87 1.47-.62.72-1.16 1.88-1.01 3.01 1.09.09 2.22-.56 2.89-1.38z" />
                </svg>
              }
            >
              Continue with Apple
            </Button>
          </div>

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
                setStep('email');
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
                    setStep('email');
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
            <span className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Terms of Use</span>
            <span className="text-[#1A1D1D]">|</span>
            <span className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Privacy Policy</span>
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
                setStep('email');
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
              setStep('password');
            }}
            className="w-full text-xs sm:text-sm font-semibold h-10.5 sm:h-11 rounded-full"
          >
            Continue with password
          </Button>

          {/* Footer: Terms of Use | Privacy Policy */}
          <div className="text-center mt-8 pt-4 border-t border-[#1A1D1D]/50 text-[11px] text-[#94A3B8] flex items-center justify-center gap-3">
            <span className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Terms of Use</span>
            <span className="text-[#1A1D1D]">|</span>
            <span className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      )}
    </div>
  );
}
