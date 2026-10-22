import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadFlags() {
  vi.resetModules();
  return import('@/lib/config/feature-flags');
}

describe('feature flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('keeps unfinished features admin-only by default', async () => {
    const { isFeatureAvailable } = await loadFlags();

    expect(isFeatureAvailable('billsPayments', false)).toBe(false);
    expect(isFeatureAvailable('billsPayments', true)).toBe(true);
    expect(isFeatureAvailable('gmailConnect', false)).toBe(false);
    expect(isFeatureAvailable('gmailConnect', true)).toBe(true);
    expect(isFeatureAvailable('emailForwarding', false)).toBe(false);
    expect(isFeatureAvailable('emailForwarding', true)).toBe(true);
  });

  it('releases a feature to everyone when its admin-only flag is turned off', async () => {
    vi.stubEnv('NEXT_PUBLIC_GMAIL_CONNECT_ADMIN_ONLY', 'false');
    const { isFeatureAvailable } = await loadFlags();

    expect(isFeatureAvailable('gmailConnect', false)).toBe(true);
    // Releasing one feature does not release the others.
    expect(isFeatureAvailable('billsPayments', false)).toBe(false);
    expect(isFeatureAvailable('emailForwarding', false)).toBe(false);
  });

  it('releases Bills & Payments without touching the other flags', async () => {
    vi.stubEnv('NEXT_PUBLIC_BILL_PAYMENT_ADMIN_ONLY', 'false');
    const { isFeatureAvailable } = await loadFlags();

    expect(isFeatureAvailable('billsPayments', false)).toBe(true);
    expect(isFeatureAvailable('gmailConnect', false)).toBe(false);
  });

  it('hides a disabled feature even from admins', async () => {
    vi.stubEnv('NEXT_PUBLIC_EMAIL_FORWARDING_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_BILL_PAYMENT_ENABLED', 'false');
    const { isFeatureAvailable } = await loadFlags();

    expect(isFeatureAvailable('emailForwarding', true)).toBe(false);
    expect(isFeatureAvailable('billsPayments', true)).toBe(false);
  });
});
