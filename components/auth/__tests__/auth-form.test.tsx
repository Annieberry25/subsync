import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import AuthForm from '@/components/auth/auth-form';

const mocks = vi.hoisted(() => {
  const router = { push: vi.fn(), refresh: vi.fn() };
  const signInWithPassword = vi.fn();
  const signUp = vi.fn();
  const signInWithOtp = vi.fn();
  const verifyOtp = vi.fn();
  const updateUser = vi.fn();
  const resend = vi.fn();
  const signInWithOAuth = vi.fn();
  const resetPasswordForEmail = vi.fn();
  return {
    router,
    signInWithPassword,
    signUp,
    auth: { signInWithPassword, signUp, signInWithOtp, verifyOtp, updateUser, resend, signInWithOAuth, resetPasswordForEmail },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: mocks.auth }),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { email: 'user@example.com', user_metadata: {} } },
    error: null,
  });
  mocks.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
});

describe('AuthForm', () => {
  it('renders the login flow by default', () => {
    render(<AuthForm />);

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('renders the signup flow when initialMode is signup', () => {
    render(<AuthForm initialMode="signup" />);

    expect(screen.getByRole('heading', { name: 'Create your SubHalt account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('shows a validation error when submitting an empty email in login mode', () => {
    const { container } = render(<AuthForm />);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('signs in with the entered email and password', async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthForm />);

    await user.type(screen.getByRole('textbox'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Enter your password' })).toBeInTheDocument();

    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    await user.type(passwordInput, 'secret123');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' })
    );
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith('/'));
  });

  it('creates an account with the entered email and password in signup mode', async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthForm initialMode="signup" />);

    await user.type(screen.getByRole('textbox'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Create a password' })).toBeInTheDocument();

    const passwordInputs = container.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'p4ssword');
    await user.type(passwordInputs[1], 'p4ssword');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(mocks.signUp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', password: 'p4ssword' })
      )
    );
  });
});