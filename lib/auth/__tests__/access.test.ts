import { describe, it, expect, vi } from 'vitest';
import { getAuthUser, resolveServerPlanTier } from '@/lib/auth/access';

type MaybeError = { error: { message: string } | null };

function mockSupabase(profile: unknown, withError = false) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve(
              withError
                ? ({ data: null, error: { message: 'boom' } } as MaybeError)
                : { data: profile ?? null, error: null }
            )
          ),
        })),
      })),
    })),
  } as never;
}

describe('getAuthUser', () => {
  it('returns the user when no MFA factor is enrolled', async () => {
    const user = { id: 'u1', factors: [] };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
      },
    } as never;

    await expect(getAuthUser(client)).resolves.toEqual(user);
  });

  it('rejects an aal1 session when the user has a verified MFA factor', async () => {
    const user = { id: 'u1', factors: [{ id: 'f1', status: 'verified' }] };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: 'aal1', nextLevel: 'aal2' },
            error: null,
          })),
        },
      },
    } as never;

    await expect(getAuthUser(client)).resolves.toBeNull();
  });

  it('allows an aal2 session when the user has a verified MFA factor', async () => {
    const user = { id: 'u1', factors: [{ id: 'f1', status: 'verified' }] };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: 'aal2', nextLevel: 'aal2' },
            error: null,
          })),
        },
      },
    } as never;

    await expect(getAuthUser(client)).resolves.toEqual(user);
  });
});

describe('resolveServerPlanTier', () => {
  it("resolves 'free' when the profile row is missing", async () => {
    const result = await resolveServerPlanTier(mockSupabase(null), 'u1');
    expect(result).toEqual({ tier: 'free', isAdmin: false });
  });

  it("resolves 'free' when the query errors", async () => {
    const result = await resolveServerPlanTier(mockSupabase(null, true), 'u1');
    expect(result).toEqual({ tier: 'free', isAdmin: false });
  });

  it("resolves 'free' for a free profile", async () => {
    const result = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'free', plan_expires_at: null, is_admin: false }),
      'u1'
    );
    expect(result).toEqual({ tier: 'free', isAdmin: false });
  });

  it("resolves 'plus' only from the profiles row (never metadata)", async () => {
    const result = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'plus', plan_expires_at: '2099-01-01T00:00:00Z', is_admin: false }),
      'u1'
    );
    expect(result).toEqual({ tier: 'plus', isAdmin: false });
  });

  it("maps 'premium' and 'pro' rows to the premium token", async () => {
    const premium = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'premium', plan_expires_at: '2099-01-01T00:00:00Z', is_admin: false }),
      'u1'
    );
    const pro = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'pro', plan_expires_at: '2099-01-01T00:00:00Z', is_admin: false }),
      'u1'
    );
    expect(premium.tier).toBe('premium');
    expect(pro.tier).toBe('premium');
  });

  it("resolves 'free' once plan_expires_at has passed", async () => {
    const result = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'plus', plan_expires_at: '2020-01-01T00:00:00Z', is_admin: false }),
      'u1'
    );
    expect(result).toEqual({ tier: 'free', isAdmin: false });
  });

  it('honors a NULL expiry like before (indefinite paid tier)', async () => {
    const result = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'plus', plan_expires_at: null, is_admin: false }),
      'u1'
    );
    expect(result).toEqual({ tier: 'plus', isAdmin: false });
  });

  it('treats an admin as premium regardless of plan or expiry', async () => {
    const result = await resolveServerPlanTier(
      mockSupabase({ plan_tier: 'free', plan_expires_at: '2020-01-01T00:00:00Z', is_admin: true }),
      'u1'
    );
    expect(result).toEqual({ tier: 'premium', isAdmin: true });
  });
});
