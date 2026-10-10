import type { Factor, User } from '@supabase/supabase-js';

/**
 * Name shown inside the authenticator app next to the account.
 *
 * Supabase passes this to GoTrue as the factor's friendly name and it becomes
 * the `issuer`/label the app stores, so it must not contain a colon.
 */
export const MFA_FACTOR_FRIENDLY_NAME = 'Authenticator app';

/**
 * Whether a session that has a *verified* second factor is being held at `aal1`.
 *
 * A password (or OAuth/one-time-code) sign-in mints an `aal1` token even for
 * accounts that have enrolled TOTP: GoTrue only raises the token to `aal2` once
 * the authenticator code has been verified. So the presence of a verified factor
 * is what makes an `aal1` session "incomplete", and the middleware uses this to
 * wall off protected routes until the challenge is done.
 */
export function hasVerifiedMfaFactor(
  user: Pick<User, 'factors'> | null | undefined
): boolean {
  return (user?.factors ?? []).some((factor) => factor.status === 'verified');
}

/** The account's verified authenticator-app factor, if it has one. */
export function findVerifiedTotpFactor(
  factors: Factor[] | null | undefined
): Factor | null {
  return (factors ?? []).find(
    (factor) => factor.status === 'verified' && factor.factor_type === 'totp'
  ) ?? null;
}

/**
 * Turns the SVG string returned by `mfa.enroll()` into something an `<img>` can
 * render. Older SDK/server combinations return an already-formed data URI, so
 * that case is passed through untouched.
 */
export function totpQrCodeSrc(qrCode: string): string {
  return qrCode.startsWith('data:')
    ? qrCode
    : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
}
