import AuthForm from '@/components/auth/auth-form';

export default function SignupPage() {
  return (
    <div className="w-full min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4 py-8 animate-page-transition">
      <AuthForm initialMode="signup" />
    </div>
  );
}
