/* eslint-disable no-restricted-globals */

/**
 * SubHalt push service worker.
 *
 * Kept as a standalone file in /public rather than generated through the app
 * router: the browser fetches it by exact URL at the origin root, so it has to be
 * served from `/sw.js` on every deployment without a build step. Nothing here may
 * import from the app.
 *
 * ## Why it exists
 *
 * Push is what replaces the 10-day renewal email, so that the Resend free tier is
 * spent on mail the user actually asked for instead of on an "upcoming in 10
 * days" nudge for every subscription they hold.
 */

self.addEventListener('install', () => {
  // Take over as soon as it is installed so a first notification does not have
  // to wait for every tab of the old version to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Notification click.
 *
 * Focuses an existing tab on the target URL if one is open, otherwise opens a new
 * one. Without the focus branch, every tap opened a duplicate tab, which is how
 * notification UIs end up with six copies of the same app.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin
  );

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl.href && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl.href);
    })
  );
});

/**
 * Actual delivery.
 *
 * `showNotification` is called explicitly rather than letting the browser render
 * the default, because the icon set differs between the branded payload and the
 * generic fallback and the default one is the unbranded square.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push with an unparseable body is not worth surfacing as a broken
    // notification; fall back to a generic one so the tap target still works.
    payload = {};
  }

  const title = payload.title || 'SubHalt';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Collapses repeats for the same logical event (e.g. the weekly recap) rather
    // than stacking one notification per subscription that renewed.
    tag: payload.tag || 'subhalt',
    data: { url: payload.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});