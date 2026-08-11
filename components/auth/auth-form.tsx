'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        router.push('/');
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) throw signUpError;

        setSuccess('Account created successfully! You can now sign in.');
        setMode('signin');
      }
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

  return (
    <div className="w-full max-w-md rounded-[20px] p-6 sm:p-8 bg-[#0B0D0D] border border-[#1A1D1D] space-y-6 shadow-2xl">
      {/* Auth Mode Toggle Tabs */}
      <div className="flex bg-[#0D0F0F] p-1 rounded-xl border border-[#1A1D1D]">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
          className={`flex-1 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
            mode === 'signin'
              ? 'bg-[#14B8A6] text-[#091512]'
              : 'text-[#94A3B8] hover:text-[#F5F7F6]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
          className={`flex-1 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
            mode === 'signup'
              ? 'bg-[#14B8A6] text-[#091512]'
              : 'text-[#94A3B8] hover:text-[#F5F7F6]'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Header text */}
      <div className="text-center space-y-2 py-1">
        <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight leading-tight sm:leading-snug">
          {mode === 'signin' ? 'Welcome back to SubSync' : 'Create your SubSync account'}
        </h2>
        <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
          {mode === 'signin'
            ? 'Enter your credentials to access your subscription dashboard.'
            : 'Start tracking and optimizing your recurring subscriptions today.'}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-2.5 text-[#D9363E] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center gap-2.5 text-[#14B8A6] text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#14B8A6]" />
          <span>{success}</span>
        </div>
      )}

      {/* Form Inputs */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#94A3B8] block">Full Name</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                <User className="w-4 h-4 text-[#94A3B8]" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-12 pr-4 py-2.5 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#94A3B8] block">Email Address</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              <Mail className="w-4 h-4 text-[#94A3B8]" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-12 pr-4 py-2.5 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#94A3B8] block">Password</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              <Lock className="w-4 h-4 text-[#94A3B8]" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-12 pr-11 py-2.5 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F5F7F6] focus:text-[#F5F7F6] focus:outline-none transition-colors cursor-pointer p-1 rounded-md flex items-center justify-center"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-[#14B8A6] hover:opacity-90 disabled:opacity-50 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{mode === 'signin' ? 'Sign In to Dashboard' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4 text-[#091512]" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
