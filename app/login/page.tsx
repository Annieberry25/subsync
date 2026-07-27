import AuthForm from '@/components/auth/auth-form';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
          <Zap className="w-6 h-6 fill-current" />
        </div>
        <div>
          <span className="text-2xl font-bold text-white tracking-tight">SubSync</span>
          <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-widest">Subscription Manager</span>
        </div>
      </div>

      {/* Auth Card */}
      <AuthForm />
    </div>
  );
}
