import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateAccountDeleteCode,
  verifyAccountDeleteCode,
  isAccountDeleteCodeConfigured,
  getAccountDeleteSigningKey,
} from '@/lib/services/account-delete-code';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('account delete code', () => {
  it('uses ACCOUNT_DELETE_SIGNING_KEY when present', () => {
    vi.stubEnv('ACCOUNT_DELETE_SIGNING_KEY', 'k-delete');
    vi.stubEnv('SUPABASE_WEBHOOK_SECRET', 'k-webhook');
    expect(getAccountDeleteSigningKey()).toBe('k-delete');
    expect(isAccountDeleteCodeConfigured()).toBe(true);
  });

  it('falls back to the webhook/cron secrets', () => {
    vi.stubEnv('ACCOUNT_DELETE_SIGNING_KEY', '');
    vi.stubEnv('SUPABASE_WEBHOOK_SECRET', 'k-webhook');
    expect(getAccountDeleteSigningKey()).toBe('k-webhook');
  });

  it('is unconfigured when no secret exists', () => {
    vi.stubEnv('ACCOUNT_DELETE_SIGNING_KEY', '');
    vi.stubEnv('SUPABASE_WEBHOOK_SECRET', '');
    vi.stubEnv('CRON_SECRET', '');
    expect(isAccountDeleteCodeConfigured()).toBe(false);
  });

  it('verifies its own code and rejects a wrong one', () => {
    vi.stubEnv('ACCOUNT_DELETE_SIGNING_KEY', 'k-delete');
    const now = Date.now();
    const code = generateAccountDeleteCode('user-123', now);

    expect(code).toMatch(/^\d{6}$/);
    expect(verifyAccountDeleteCode('user-123', code, now)).toBe(true);
    expect(verifyAccountDeleteCode('user-123', '000000', now)).toBe(false);
  });

  it('accepts a code from one adjacent time window (clock skew)', () => {
    vi.stubEnv('ACCOUNT_DELETE_SIGNING_KEY', 'k-delete');
    const now = Date.now();
    const earlierCode = generateAccountDeleteCode('user-123', now - 30_000);

    expect(verifyAccountDeleteCode('user-123', earlierCode, now)).toBe(true);
  });

  it('rejects a code minted for a different user', () => {
    vi.stubEnv('ACCOUNT_DELETE_SIGNING_KEY', 'k-delete');
    const now = Date.now();
    const code = generateAccountDeleteCode('user-456', now);

    expect(verifyAccountDeleteCode('user-123', code, now)).toBe(false);
  });
});