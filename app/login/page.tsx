import AuthForm from '@/components/auth/auth-form';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-[#000000] border border-[#1A1D1D] flex items-center justify-center text-[#14B8A6] shrink-0">
          <Zap className="w-6 h-6 fill-current text-[#14B8A6]" />
        </div>
        <span className="text-2xl font-bold text-[#14B8A6] tracking-tight">SubSync</span>
      </div>

      {/* Auth Card */}
      <AuthForm />
    </div>
  );
}
