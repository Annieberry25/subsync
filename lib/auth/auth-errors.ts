/**
 * Friendly, actionable copy for Supabase Auth (auth-js) failures.
 *
 * auth-js collapses every HTTP 5xx into an AuthRetryableFetchError whose
 * message is JSON.stringify(new Response()) — the literal string "{}" — so the
 * real GoTrue body (e.g. "Error sending confirmation email") never surfaces in
 * the UI. This mapper turns that and the known auth error codes into
 * human-readable messages.
 */

const STUB_MESSAGES = new Set(['{}', '[object Object]', '']);

interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const authError = error as AuthErrorLike;
  const message = typeof authError.message === 'string' ? authError.message : '';
  const code = authError.code;
  const status = authError.status;

  if (code === 'otp_disabled') {
    return "There's no SubHalt account for this email. Check the address or sign up first.";
  }

  if (code === 'over_email_send_rate_limit') {
    return 'Too many codes were sent to this address recently. Wait a few minutes and try again.';
  }

  const isServerFailure =
    code === 'unexpected_failure' ||
    (typeof status === 'number' && status >= 500) ||
    STUB_MESSAGES.has(message);

  if (isServerFailure) return fallback;

  return message ? message : fallback;
}