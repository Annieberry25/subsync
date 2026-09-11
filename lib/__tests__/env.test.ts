import { describe, it, expect, beforeEach, vi } from 'vitest';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

function setValidEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
}

describe('env', () => {
  it('exports a valid env object when vars are present', async () => {
    setValidEnv();
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('test-key');
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
    await expect(import('@/lib/env')).rejects.toThrow(/Invalid environment variables/);
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
    await expect(import('@/lib/env')).rejects.toThrow(/must be a valid URL/);
  });

  it('throws when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    await expect(import('@/lib/env')).rejects.toThrow(/Invalid environment variables/);
  });
});
