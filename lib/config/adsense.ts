/**
 * Google AdSense configuration for SubHalt.
 *
 * ## Publisher ID
 *
 * `ca-pub-4851652738657758` is committed as a fallback rather than left to
 * `NEXT_PUBLIC_ADSENSE_CLIENT`. AdSense's site verification reads the raw HTML
 * of your pages looking for the loader script, so the ID has to be present in
 * production HTML. Env vars are inlined at build time and `.env*` is gitignored,
 * so an unset variable meant the script never reached the deployed document and
 * verification could not succeed. The env var still overrides the fallback, so
 * the ID can be changed without a code edit if the account ever moves.
 *
 * ## What is and is not enabled here
 *
 * Adding the loader script makes the AdSense library available site-wide. It does
 * **not** turn on auto ads: that is a dashboard-side setting, and the loader
 * only starts placing units once something pushes to `window.adsbygoogle`.
 * Nothing does until an ad slot is configured, so the app renders no ad and no
 * placeholder until then.
 *
 * Required before any ad actually renders:
 *   NEXT_PUBLIC_ADSENSE_AD_SLOT   an existing responsive ad unit slot id, e.g.
 *                                 "1234567890"
 */

const FALLBACK_ADSENSE_CLIENT = 'ca-pub-4851652738657758';

export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || FALLBACK_ADSENSE_CLIENT;

export const ADSENSE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_AD_SLOT?.trim() || '';

/**
 * The AdSense loader, as a single definition shared by the root layout's head tag
 * and AdBanner's dynamic injection. Duplicating the URL let the two disagree, and
 * a second copy of adsbygoogle.js resets AdSense's own state.
 */
export const ADSENSE_LOADER_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

/**
 * True only once a slot exists. The client id alone is not enough: without a
 * slot there is no unit to render, and the banner must stay absent.
 */
export const ADSENSE_ENABLED = ADSENSE_CLIENT.length > 0 && ADSENSE_AD_SLOT.length > 0;