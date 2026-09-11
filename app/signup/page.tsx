import type { Metadata } from 'next';
import AuthForm from '@/components/auth/auth-form';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Sign up for SubHalt to track and optimize your recurring subscriptions.',
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  return (
    <div className="w-full min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4 py-8 animate-page-transition">
      <AuthForm initialMode="signup" />
    </div>
  );
}
