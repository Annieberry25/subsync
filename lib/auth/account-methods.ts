export type AccountAuthMethod = 'email' | 'google' | 'apple';

/**
 * The sign-in methods an account supports, derived from its GoTrue auth record.
 *
 * Supabase records a pure email/password account as `app_metadata.provider:
 * "email"` and an OAuth account as `"google"`/`"apple"`; once a second identity
 * is linked, `app_metadata.providers` lists every method. The remembered-account
 * list stores how an account was *last* authenticated, which can go stale or
 * simply be wrong (a Google account saved before a password was linked, etc.),
 * so the login flow asks the server for the real methods instead of trusting
 * localStorage. `identities` is not used: this project's GoTrue returns an empty
 * identities array even for OAuth accounts.
 */
export function getAccountAuthMethods(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined
): AccountAuthMethod[] {
  if (!user) return [];
  const meta = user.app_metadata || {};
  const provider = typeof meta.provider === 'string' ? meta.provider : undefined;
  const providers = Array.isArray(meta.providers)
    ? meta.providers.filter((p): p is string => typeof p === 'string')
    : [];

  const all = new Set<string>();
  [provider, ...providers].forEach((p) => p && all.add(p));

  const methods: AccountAuthMethod[] = [];
  if (all.has('email')) methods.push('email');
  if (all.has('google')) methods.push('google');
  if (all.has('apple')) methods.push('apple');
  return methods;
}