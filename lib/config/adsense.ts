/**
 * Google AdSense configuration for SubHalt.
 *
 * Ads are only rendered on the free plan and only when the AdSense publisher
 * ID is configured. Everything is gated behind build-time env vars so the app
 * shows no placeholder or simulated ad until real AdSense credentials exist.
 *
 * Required to enable real ads:
 *   NEXT_PUBLIC_ADSENSE_CLIENT      e.g. "ca-pub-1234567890123456"
 *   NEXT_PUBLIC_ADSENSE_AD_SLOT     e.g. "1234567890" (an existing responsive
 *                                  ad unit slot on the AdSense account)
 */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || '';
export const ADSENSE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_AD_SLOT?.trim() || '';

export const ADSENSE_ENABLED = ADSENSE_CLIENT.length > 0 && ADSENSE_AD_SLOT.length > 0;