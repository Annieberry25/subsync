'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft, AtSign, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { BrandWordmark } from '@/components/ui/brand-logo';
import { saveRememberedAccount } from '@/lib/auth/remembered-accounts';
import { describeOAuthError } from '@/lib/auth/oauth-errors';
import type { SocialAuthProviderId } from '@/lib/supabase/cookie-options';
import { SocialAuthButtons } from './social-auth-buttons';
import { getAuthCallbackUrl } from '@/lib/utils/url-utils';

export function SignupFlow() {
  const [step, setStep] = useState<'email' | 'password' | 'otp' | 'username'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [username, setUsername] = useState('');

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();
  // Safe to call from the render body only because createClient() is a real
  // singleton — see lib/supabase/client.ts for what happens when it is not.
  const supabase = createClient();

  const isMinLength = password.length >= 6;
  const hasNumOrHyphen = /[0-9-]/.test(password);
  const isReqMet = isMinLength && hasNumOrHyphen;
  const isMatching = password.length > 0 && password === confirmPassword;

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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isReqMet) {
      setError('Password must be at least 6 characters with a number or hyphen.');
      return;
    }

    if (!isMatching) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        saveRememberedAccount({
          email: email.trim(),
        });
        setStep('username');
      } else {
        setStep('otp');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during signup.');
      }
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!verificationCode.trim()) {
      setError('Please enter the code sent to your email.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: verificationCode.trim(),
        type: 'signup',
      });

      if (verifyErr) throw verifyErr;

      if (data.user) {
        saveRememberedAccount({
          email: data.user.email || email.trim(),
        });
      }

      setStep('username');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedUsername = username.trim().replace(/^@/, '');
    if (!trimmedUsername) {
      setError('Please enter a username.');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateAuthErr } = await supabase.auth.updateUser({
        data: {
          username: trimmedUsername,
          full_name: trimmedUsername,
        },
      });

      if (updateAuthErr) throw updateAuthErr;

      try {
        await fetch('/api/profile/update-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: trimmedUsername }),
        });
      } catch {
        // Ignore API fallback error
      }

      saveRememberedAccount({
        email: email.trim(),
        username: trimmedUsername,
        displayName: trimmedUsername,
      });

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set username.');
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

      {/* STEP 1: Enter Email & Social Signup */}
      {step === 'email' && (
        <div>
          {/* Logo/brand */}
          <div className="flex flex-col items-center justify-center space-y-2 mb-6">
            <BrandWordmark height={30} priority />
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight text-center">
            Create your SubHalt account
          </h1>

          {/* Description */}
          <p className="text-xs sm:text-sm text-[#94A3B8] text-center mt-1.5 mb-7">
            Start tracking and optimizing your recurring subscriptions today.
          </p>

          {/* Social OAuth CTAs */}
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

            <div className="text-center mt-7 pt-1">
              <p className="text-xs text-[#94A3B8]">
                Already have an account?{' '}
                <Link id="nav-to-login" href="/login" className="text-[#14B8A6] hover:underline font-semibold cursor-pointer">
                  Log in
                </Link>
              </p>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: Create Password (Shared layout & styling with Login) */}
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
            Create a password
          </h1>

          <form onSubmit={handleCreateAccount} className="space-y-5">
            {/* Email address display with Edit link */}
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

            {/* Password input + subtle validation message */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={password.length > 0 ? 'signup-password-hint' : undefined}
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
              {/* Subtle validation message directly under password field */}
              {password.length > 0 && (
                <p id="signup-password-hint" className={`text-xs mt-1 transition-colors ${isReqMet ? 'text-[#14B8A6] font-medium' : 'text-[#94A3B8]'}`}>
                  {isReqMet ? '✓ Password requirements met' : 'At least 6 characters and 1 number or hyphen'}
                </p>
              )}
            </div>

            {/* Confirm Password input + subtle validation message */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder=""
                className="w-full px-4 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/60 transition-colors h-10.5 sm:h-11"
              />
              {/* Subtle validation message directly under confirm password field */}
              {confirmPassword.length > 0 && (
                <p className={`text-xs mt-1 transition-colors ${isMatching ? 'text-[#14B8A6] font-medium' : 'text-[#D9363E]'}`}>
                  {isMatching ? '✓ Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </div>

            {/* Submit button */}
            <Button type="submit" size="md" loading={loading} className="w-full font-semibold h-10.5 sm:h-11 rounded-full mt-2">
              Create Account
            </Button>
          </form>

          {/* OR divider */}
          <div className="flex items-center gap-3 my-7 py-0.5">
            <div className="flex-1 h-px bg-[#1A1D1D]" />
            <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">OR</span>
            <div className="flex-1 h-px bg-[#1A1D1D]" />
          </div>

          {/* Secondary Option: Use a one-time code */}
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={handleRequestOtp}
            loading={loading}
            className="w-full text-xs sm:text-sm font-semibold h-10.5 sm:h-11 rounded-full"
          >
            Use a one-time code
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

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Verification code</label>
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder=""
                className="w-full px-4 py-2 text-center text-base sm:text-lg font-mono tracking-widest rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/60 transition-colors h-10.5 sm:h-11"
              />
            </div>

            <Button type="submit" size="md" loading={loading} className="w-full font-semibold h-10.5 sm:h-11 rounded-full">
              Verify & Create Account
            </Button>
          </form>

          {/* Resend code */}
          <div className="text-center mt-5">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setSuccess(null);
                setLoading(true);
                try {
                  await supabase.auth.resend({
                    type: 'signup',
                    email: email.trim(),
                  });
                  setSuccess('Resent verification email.');
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Could not resend email.');
                } finally {
                  setLoading(false);
                }
              }}
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
            <a href="/settings" className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Terms of Use</a>
            <span className="text-[#1A1D1D]">|</span>
            <a href="/settings" className="hover:text-[#F5F7F6] transition-colors cursor-pointer">Privacy Policy</a>
          </div>
        </div>
      )}

      {/* STEP 4: Choose Username */}
      {step === 'username' && (
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight text-center">
            Choose your username
          </h1>

          <p className="text-xs sm:text-sm text-[#94A3B8] text-center mt-1.5 mb-7">
            Select a username for your profile inside SubHalt. (Login remains email-based).
          </p>

          <form onSubmit={handleUsernameSetup} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#94A3B8] block">Username</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <AtSign className="w-4 h-4 text-[#94A3B8]" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder=""
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/60 transition-colors h-10 sm:h-10.5"
                />
              </div>
              <p className="text-[10px] text-[#94A3B8] mt-1">Letters, numbers, underscores and dots only.</p>
            </div>

            <Button type="submit" size="md" loading={loading} className="w-full font-semibold h-10.5 sm:h-11 rounded-full">
              Complete setup
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
