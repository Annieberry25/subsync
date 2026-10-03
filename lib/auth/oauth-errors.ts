/**
 * Turns a `signInWithOAuth` failure into something a person can act on.
 *
 * The raw messages are developer-facing ("Provider is not enabled", "invalid
 * request"), and the most common failure never reaches this function at all:
 * when `redirectTo` is not in the Supabase Redirect URLs allow-list, GoTrue
 * discards it and redirects to the project Site URL instead, so the browser
 * silently lands off-app. That case is handled in `/auth/callback`, which maps
 * Supabase's own `error`/`error_description` back to a message.
 */

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
};

export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * @param provider Supabase provider id, used only for the label.
 * @param err Whatever `signInWithOAuth` threw or returned.
 */
export function describeOAuthError(err: unknown, provider: string): string {
  const label = getProviderLabel(provider);
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  if (/not enabled|unsupported provider|provider is not/i.test(message)) {
    return `${label} sign-in is not enabled for this project. Enable it under Authentication > Providers in the Supabase dashboard.`;
  }

  if (/flow_state|invalid flow state|code_verifier/i.test(message)) {
    return `${label} sign-in could not be verified. Please try again — if it keeps failing, cookies may be blocked for this site.`;
  }

  if (message) return `${label} sign-in failed: ${message}`;

  return `${label} sign-in failed. Please try again.`;
}
