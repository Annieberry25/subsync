import type { User } from '@supabase/supabase-js';
import type { RememberedAccount } from '@/lib/auth/remembered-accounts';

/**
 * The OAuth provider that authenticated this session, if any.
 *
 * Returns undefined for email/password and one-time-code sessions, and the caller
 * is expected to leave the stored provider untouched in that case rather than
 * overwrite it. Supabase reports both as `email`, so the two cannot be told apart
 * from the session — and both can be signed into with a code, so distinguishing
 * them is not worth guessing at.
 */
export function getAuthProvider(user: User | null | undefined): RememberedAccount['provider'] {
  if (!user) return undefined;

  // app_metadata.providers is populated once an account links a second identity,
  // in which case `provider` alone understates how the account can be reached.
  const meta = user.app_metadata || {};
  const providers: string[] = Array.isArray(meta.providers)
    ? meta.providers
    : meta.provider
      ? [meta.provider]
      : [];

  const userIdentities = (user.identities || []).map((identity) => identity.provider);
  const all = [...providers, ...userIdentities];

  if (all.includes('google')) return 'google';
  if (all.includes('apple')) return 'apple';
  return undefined;
}