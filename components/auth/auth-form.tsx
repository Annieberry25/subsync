'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="w-full max-w-md rounded-[20px] p-5 sm:p-8 bg-[#171A21] border border-[#2B313D] space-y-5 sm:space-y-6">
      {/* Auth Mode Toggle Tabs */}
      <div className="flex bg-[#1D222B] p-1 rounded-xl border border-[#2B313D]">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
          className={`flex-1 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
            mode === 'signin'
              ? 'bg-[#4F46E5] text-white'
              : 'text-[#A1AAB8] hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
          className={`flex-1 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
            mode === 'signup'
              ? 'bg-[#4F46E5] text-white'
              : 'text-[#A1AAB8] hover:text-white'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Header text */}
      <div className="text-center">
        <h2 className="text-xl sm:text-[28px] font-bold text-white tracking-tight leading-snug sm:leading-[36px]">
          {mode === 'signin' ? 'Welcome back to SubSync' : 'Create your SubSync account'}
        </h2>
        <p className="text-xs sm:text-[15px] text-[#A1AAB8] mt-1 leading-relaxed sm:leading-[22px]">
          {mode === 'signin'
            ? 'Enter your credentials to access your subscription dashboard.'
            : 'Start tracking and optimizing your recurring subscriptions today.'}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center gap-2.5 text-[#EF4444] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center gap-2.5 text-[#22C55E] text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Form Inputs */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#6F7787] block">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F7787]" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#1D222B] border border-[#2B313D] text-white placeholder-[#6F7787] focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#6F7787] block">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F7787]" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#1D222B] border border-[#2B313D] text-white placeholder-[#6F7787] focus:outline-none focus:border-[#4F46E5] transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-[#6F7787] block">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F7787]" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#1D222B] border border-[#2B313D] text-white placeholder-[#6F7787] focus:outline-none focus:border-[#4F46E5] transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{mode === 'signin' ? 'Sign In to Dashboard' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
