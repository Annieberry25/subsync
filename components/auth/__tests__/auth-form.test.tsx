import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import AuthForm from '@/components/auth/auth-form';

const mocks = vi.hoisted(() => {
  const router = { push: vi.fn(), refresh: vi.fn() };
  const loginFetch = vi.fn();
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
    loginFetch,
    signInWithPassword,
    signUp,
    signInWithOtp,
    verifyOtp,
    updateUser,
    resend,
    signInWithOAuth,
    resetPasswordForEmail,
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
  mocks.loginFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, user: { email: 'user@example.com', user_metadata: {} } }),
  });
  vi.stubGlobal('fetch', mocks.loginFetch);
  mocks.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
  mocks.signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: 'https://example.supabase.co/auth/v1/authorize' },
    error: null,
  });
});

describe('AuthForm', () => {
  it('renders the login flow by default', () => {
    render(<AuthForm />);

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  /**
   * Apple is disabled on the Supabase project. `signInWithOAuth` against a
   * disabled provider cannot return a session, so the button was a dead control
   * that made Google look broken too — both buttons sat above the divider and
   * neither could be told apart from a working one.
   */
  it('does not offer providers that are disabled on the Supabase project', () => {
    render(<AuthForm />);

    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).not.toBeInTheDocument();
  });

  /**
   * The redirectTo must be the origin the flow started on: the PKCE code
   * verifier is a cookie on that host, so a redirectTo built from
   * NEXT_PUBLIC_SITE_URL delivered the callback somewhere it did not exist and
   * `exchangeCodeForSession` failed.
   */
  it('starts Google sign-in against the live browser origin', async () => {
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
    );
  });

  it('surfaces an actionable message when the provider is disabled', async () => {
    const user = userEvent.setup();
    mocks.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: null },
      error: new Error('Provider is not enabled'),
    });

    render(<AuthForm />);
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Google sign-in is not enabled for this project/)
      ).toBeInTheDocument()
    );
  });

  /**
   * Regression: both `step` and `rememberedAccounts` used to be seeded by
   * getRememberedAccounts() in a useState initializer. That reads localStorage,
   * so it runs in the browser render but returns [] on the server — the server
   * emitted the email step while the client emitted the chooser, a hydration
   * mismatch on every /login visit for anyone who had signed in before. Seeding
   * with the SSR-safe value and promoting in an effect fixes it.
   *
   * renderToStaticMarkup does not run effects, which is exactly the point: it
   * shows what the server emits. It must not depend on browser-only storage.
   * (`render` cannot assert this — testing-library's act() flushes effects
   * before it returns, so the chooser is already up by the first assertion.)
   */
  it('renders the email step server-side even when accounts are saved', () => {
    window.localStorage.setItem(
      'subhalt_remembered_accounts',
      JSON.stringify([
        { email: 'user@example.com', displayName: 'User', lastUsed: 1 },
      ])
    );

    const html = renderToStaticMarkup(<AuthForm />);

    expect(html).toContain('Email Address');
    expect(html).toContain('Continue with Google');
    expect(html).not.toContain('Choose an account to continue');
    expect(html).not.toContain('user@example.com');
  });

  it('promotes to the account chooser after mount when accounts are saved', async () => {
    window.localStorage.setItem(
      'subhalt_remembered_accounts',
      JSON.stringify([
        { email: 'user@example.com', displayName: 'User', lastUsed: 1 },
      ])
    );

    render(<AuthForm />);

    await waitFor(() =>
      expect(screen.getByText('Choose an account to continue')).toBeInTheDocument()
    );
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  /**
   * Regression: the chooser only offered password/one-time-code accounts plus a
   * link to the email form, so after signing out of a Google account the
   * "Continue with Google" button was a tap out of sight and read as broken
   * social sign-in.
   */
  it('keeps Google sign-in reachable from the account chooser', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'subhalt_remembered_accounts',
      JSON.stringify([
        { email: 'user@example.com', displayName: 'User', lastUsed: 1 },
      ])
    );

    render(<AuthForm />);
    await waitFor(() => screen.getByText('Choose an account to continue'));

    const googleButton = screen.getByRole('button', { name: 'Continue with Google' });
    await user.click(googleButton);

    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
    );
  });

/**
 * Regression: selecting a remembered account always dropped into the password
 * step, regardless of how that account authenticates. A Google account has no
 * password, so the form could only ever fail, and the one-time code it falls back
 * to lands in an inbox that account may never open. It now returns through Google,
 * the provider that actually created it.
 */
it('returns a Google account through Google instead of a password or code form', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'subhalt_remembered_accounts',
      JSON.stringify([
        { email: 'google@example.com', displayName: 'Google User', lastUsed: 1, provider: 'google' },
      ])
    );
    mocks.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://example.supabase.co/auth/v1/authorize' },
      error: null,
    });

    render(<AuthForm />);
    await waitFor(() => screen.getByText('Choose an account to continue'));

    await user.click(screen.getByText('google@example.com'));

    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          options: expect.objectContaining({ queryParams: { prompt: 'select_account' } }),
        })
      )
    );
    // Neither form is shown: no code requested, no password prompt.
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Enter your password' })).not.toBeInTheDocument();
    expect(screen.queryByText('6-digit verification code')).not.toBeInTheDocument();
  });

  it('still shows the password form for a password account', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'subhalt_remembered_accounts',
      JSON.stringify([
        { email: 'pw@example.com', displayName: 'PW User', lastUsed: 1, provider: 'password' },
      ])
    );

    render(<AuthForm />);
    await waitFor(() => screen.getByText('Choose an account to continue'));

    await user.click(screen.getByText('pw@example.com'));

    expect(screen.getByRole('heading', { name: 'Enter your password' })).toBeInTheDocument();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  /**
   * Accounts saved before the provider field existed have none. The password form
   * is the historical behaviour and the safe default here: the user can still
   * reach the code or Google from that step, whereas guessing "Google" would send
   * a password account into an OAuth round trip it never asked for.
   */
  it('falls back to the password form for a legacy account with no stored provider', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'subhalt_remembered_accounts',
      JSON.stringify([{ email: 'legacy@example.com', displayName: 'Legacy', lastUsed: 1 }])
    );

    render(<AuthForm />);
    await waitFor(() => screen.getByText('Choose an account to continue'));

    await user.click(screen.getByText('legacy@example.com'));

    expect(screen.getByRole('heading', { name: 'Enter your password' })).toBeInTheDocument();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('requests the code without creating an account for an unknown address', async () => {
    const user = userEvent.setup();
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });

    render(<AuthForm />);
    await user.type(screen.getByRole('textbox'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: /one-time code|code/i }));

    await waitFor(() =>
      expect(mocks.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          options: expect.objectContaining({ shouldCreateUser: false }),
        })
      )
    );
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

  it('surfaces an error handed back by the OAuth callback', () => {
    render(<AuthForm initialError="Sign-in could not be completed. Please try again." />);

    expect(
      screen.getByText('Sign-in could not be completed. Please try again.')
    ).toBeInTheDocument();
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
      expect(mocks.loginFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user@example.com', password: 'secret123' }),
        })
      )
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