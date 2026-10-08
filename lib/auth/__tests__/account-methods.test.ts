import { getAccountAuthMethods } from '@/lib/auth/account-methods';

describe('getAccountAuthMethods', () => {
  it('reports a pure email/password account', () => {
    expect(getAccountAuthMethods({ app_metadata: { provider: 'email' } })).toEqual(['email']);
  });

  it('reports a Google-only account', () => {
    expect(getAccountAuthMethods({ app_metadata: { provider: 'google' } })).toEqual(['google']);
  });

  it('reports both methods when a second identity is linked', () => {
    expect(
      getAccountAuthMethods({ app_metadata: { provider: 'email', providers: ['email', 'google'] } })
    ).toEqual(['email', 'google']);
  });

  it('reports methods from the providers list when provider differs', () => {
    expect(
      getAccountAuthMethods({ app_metadata: { provider: 'email', providers: ['google', 'email', 'apple'] } })
    ).toEqual(['email', 'google', 'apple']);
  });

  it('returns no methods for an unknown account shape', () => {
    expect(getAccountAuthMethods({})).toEqual([]);
    expect(getAccountAuthMethods({ app_metadata: null })).toEqual([]);
  });

  it('returns no methods rather than throwing without a user', () => {
    expect(getAccountAuthMethods(null)).toEqual([]);
    expect(getAccountAuthMethods(undefined)).toEqual([]);
  });
});