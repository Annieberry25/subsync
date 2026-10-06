'use client';

/**
 * Browser half of Web Push.
 *
 * Deliberately has no access to the VAPID private key — only the public key, which
 * the server hands out. The subscribe call goes through an API route so the row
 * lands under the signed-in user rather than an anonymous one.
 *
 * ## Permission is requested from a user gesture, never on load
 *
 * `Notification.requestPermission()` called on page load resolves to `denied`
 * without ever showing a prompt on some browsers, and Chrome treats repeated
 * programmatic requests as a signal to block the origin permanently. So nothing
 * here runs on mount; `enablePushNotifications` is only ever called from a click.
 */

const SERVICE_WORKER_PATH = '/sw.js';
const SUBSCRIBE_ENDPOINT = '/api/push/subscribe';

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as PushPermissionState;
}

/** True when the browser supports Web Push at all. */
export function isPushSupported(): boolean {
  return getPushPermissionState() !== 'unsupported';
}

/**
 * Whether this device has a subscription the server knows about.
 *
 * Permission alone is not the answer: the browser can be granted permission
 * while the row was never written (the POST failed, the VAPID key was missing,
 * the session had expired). A switch driven by `Notification.permission` would
 * then read ON for a device that will never receive anything, so the UI checks
 * for the subscription itself.
 */
export async function hasPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Decodes a base64url VAPID key into bytes for `applicationServerKey`.
 *
 * Backed by a fresh `ArrayBuffer` rather than a `Uint8Array` view so the result
 * satisfies `BufferSource`: the DOM lib types reject a view whose buffer might be
 * a `SharedArrayBuffer`, and a plain Uint8Array cannot promise it is not.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { publicKey?: string | null };
    return body.publicKey ?? null;
  } catch {
    return null;
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
  } catch {
    // A worker that fails to register means push is unavailable on this device.
    // Swallowed so callers can report "not available" rather than crash.
    return null;
  }
}

/**
 * Asks for permission, subscribes, and stores the endpoint server-side.
 *
 * Returns the resulting *permission* state rather than throwing, because every
 * failure here is a normal outcome on some browser or device. Permission is not
 * the same as being subscribed, though: a missing VAPID key or a rejected POST
 * leaves the user granted with no row on the server. Callers that display an on/off
 * state must therefore read `hasPushSubscription()`, and treat "granted but not
 * subscribed" as a failure worth reporting.
 */
export async function enablePushNotifications(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported';

  // Must be called from a user gesture to get a real prompt.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission as PushPermissionState;

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return 'granted';

  const registration = await registerServiceWorker();
  if (!registration) return 'granted';

  try {
    const existing = await registration.pushManager.getSubscription();
    // An existing subscription may predate the current VAPID key, which the
    // browser treats as valid but the push service will reject. Re-subscribing
    // when the key differs avoids a silently dead subscription.
    const currentKey = existing?.options.applicationServerKey;
    const currentKeyB64 = currentKey
      ? window.btoa(String.fromCharCode(...new Uint8Array(currentKey)))
      : null;

    const subscription =
      existing && (!currentKeyB64 || currentKeyB64 === publicKey)
        ? existing
        : await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return 'granted';
    }

    const res = await fetch(SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      }),
    });

    if (res.ok) return 'granted';

    // The server never recorded it. Leaving the browser subscribed would keep a
    // subscription alive that nothing will ever push to, and would make
    // `hasPushSubscription` report ON while the cron sees no endpoint.
    await subscription.unsubscribe().catch(() => undefined);
    return 'granted';
  } catch {
    return 'granted';
  }
}

/** Removes this device's subscription. Safe to call when already unsubscribed. */
export async function disablePushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;

    await fetch(SUBSCRIBE_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}