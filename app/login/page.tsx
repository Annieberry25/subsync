import type { Metadata } from 'next';
import AuthForm from '@/components/auth/auth-form';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to SubHalt to manage your subscriptions and bills.',
  alternates: { canonical: '/login' },
};

export default function LoginPage() {
  return (
    <div className="w-full min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4 py-8 animate-page-transition">
      <AuthForm initialMode="login" />
    </div>
  );
}
