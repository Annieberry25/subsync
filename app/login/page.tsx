import AuthForm from '@/components/auth/auth-form';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shrink-0">
          <Zap className="w-6 h-6 fill-current" />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">SubSync</span>
      </div>

      {/* Auth Card */}
      <AuthForm />
    </div>
  );
}
