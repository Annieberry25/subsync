'use client';

import { LoginFlow } from './login-flow';
import { SignupFlow } from './signup-flow';

interface AuthFormProps {
  initialMode?: 'login' | 'signup';
}

export default function AuthForm({ initialMode = 'login' }: AuthFormProps) {
  return (
    <div className="w-full max-w-[460px] mx-auto p-6 sm:p-9 rounded-2xl bg-[#0D0F0F]/70 border border-[#1A1D1D] backdrop-blur-md shadow-2xl">
      <div className="w-full max-w-[360px] sm:max-w-[370px] mx-auto">
        {initialMode === 'login' ? <LoginFlow /> : <SignupFlow />}
      </div>
    </div>
  );
}
