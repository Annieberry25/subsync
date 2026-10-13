import { describe, it, expect, vi, afterEach } from 'vitest';

import { syncPushSubscription } from '@/lib/push/client';

function installServiceWorker(subscription: unknown): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => ({
        pushManager: { getSubscription: async () => subscription },
      })),
    },
  });
  // The guard checks `'PushManager' in window`, so the constructor just has to exist.
  (window as unknown as { PushManager: unknown }).PushManager = function PushManager() {};
}

function removeServiceWorker() {
  delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  delete (window as unknown as { PushManager?: unknown }).PushManager;
}

describe('syncPushSubscription', () => {
  afterEach(() => {
    removeServiceWorker();
    vi.unstubAllGlobals();
  });

  it('does nothing when there is no browser subscription', async () => {
    installServiceWorker(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncPushSubscription()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-POSTs an existing subscription so a missing server row self-heals', async () => {
    installServiceWorker({
      toJSON: () => ({
        endpoint: 'https://push.example.com/abc',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncPushSubscription()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/push/subscribe');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });
  });

  it('reports failure when the server rejects the subscription', async () => {
    installServiceWorker({
      toJSON: () => ({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p', auth: 'a' } }),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(syncPushSubscription()).resolves.toBe(false);
  });

  it('bails out when the subscription has no keys', async () => {
    installServiceWorker({ toJSON: () => ({ endpoint: 'https://push.example.com/abc' }) });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncPushSubscription()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
