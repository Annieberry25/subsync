import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';
import { isFeatureEnabledForUser } from '@/lib/auth/feature-access';

function clientWithAdmin(isAdmin: boolean) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { is_admin: isAdmin }, error: null })),
        })),
      })),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe('isFeatureEnabledForUser', () => {
  it('allows an admin while a feature is admin-only', async () => {
    const supabase = clientWithAdmin(true);

    await expect(
      isFeatureEnabledForUser(supabase, 'admin-id', 'billsPayments')
    ).resolves.toBe(true);
  });

  it('refuses a non-admin while a feature is admin-only', async () => {
    const supabase = clientWithAdmin(false);

    await expect(
      isFeatureEnabledForUser(supabase, 'user-id', 'billsPayments')
    ).resolves.toBe(false);
  });

  it('refuses a non-admin while Gmail Connect awaits Google verification', async () => {
    const supabase = clientWithAdmin(false);

    await expect(
      isFeatureEnabledForUser(supabase, 'user-id', 'gmailConnect')
    ).resolves.toBe(false);
  });

  it('allows the admin testing account to use Gmail Connect', async () => {
    const supabase = clientWithAdmin(true);

    await expect(
      isFeatureEnabledForUser(supabase, 'admin-id', 'gmailConnect')
    ).resolves.toBe(true);
  });

  it('refuses a missing user without reading the profiles row', async () => {
    const supabase = clientWithAdmin(true);

    await expect(isFeatureEnabledForUser(supabase, undefined, 'gmailConnect')).resolves.toBe(
      false
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
