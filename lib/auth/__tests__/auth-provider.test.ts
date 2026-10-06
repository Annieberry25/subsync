import { getAuthProvider } from '@/lib/auth/auth-provider';
import type { User } from '@supabase/supabase-js';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    ...overrides,
  } as unknown as User;
}

describe('getAuthProvider', () => {
  it('detects a Google session from app_metadata.provider', () => {
    const user = makeUser({ app_metadata: { provider: 'google' } });
    expect(getAuthProvider(user)).toBe('google');
  });

  it('detects Google from the identities list', () => {
    // app_metadata.provider records the account's original provider, which is
    // not the one that signed in after linking a second identity.
    const user = makeUser({
      app_metadata: { provider: 'email' },
      identities: [{ provider: 'google' }],
    });
    expect(getAuthProvider(user)).toBe('google');
  });

  it('detects Apple the same way', () => {
    expect(getAuthProvider(makeUser({ app_metadata: { provider: 'apple' } }))).toBe('apple');
    expect(
      getAuthProvider(makeUser({ app_metadata: { providers: ['email', 'apple'] } }))
    ).toBe('apple');
  });

  it('returns undefined for password and code sessions', () => {
    // Both report 'email', and both can be signed into with a code, so the
    // caller leaves the stored provider alone rather than guessing.
    expect(getAuthProvider(makeUser({ app_metadata: { provider: 'email' } }))).toBeUndefined();
    expect(getAuthProvider(makeUser({}))).toBeUndefined();
  });

  it('returns undefined with no user rather than throwing', () => {
    expect(getAuthProvider(null)).toBeUndefined();
    expect(getAuthProvider(undefined)).toBeUndefined();
  });
});