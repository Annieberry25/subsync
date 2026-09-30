import type { MetadataRoute } from 'next';

/**
 * Installs SubHalt to a phone home screen.
 *
 * `start_url` is `/` rather than the More sheet or any deep link, and
 * `display: "standalone"` launches the app shell with the dock intact. The
 * dock is the whole point of the mobile layout, so anything that relaunched
 * the app on a full-page route would land somewhere the dock does not exist.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SubHalt - Subscription Manager',
    short_name: 'SubHalt',
    description: 'Track, manage, and optimize all your recurring subscriptions seamlessly.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['finance', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Maskable as well as `any`: these are full-bleed opaque squares, so
        // the circular and squircle crops Android applies keep the plate
        // edge-to-edge. Only the glyph is inset, and it stays within the
        // 80% safe zone.
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
