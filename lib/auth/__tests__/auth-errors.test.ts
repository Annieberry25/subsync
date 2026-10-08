import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from '@/lib/auth/auth-errors';

describe('getAuthErrorMessage', () => {
  it('maps otp_disabled to the no-account message', () => {
    const err = { status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' };
    expect(getAuthErrorMessage(err, 'fallback')).toBe(
      "There's no SubHalt account for this email — check the address or sign up first.",
    );
  });

  it('maps over_email_send_rate_limit to a retry message', () => {
    const err = { status: 429, code: 'over_email_send_rate_limit', message: 'over_email_send_rate_limit' };
    expect(getAuthErrorMessage(err, 'fallback')).toBe(
      'Too many codes were sent to this address recently. Wait a few minutes and try again.',
    );
  });

  it('treats the auth-js "{}" 5xx stub as a server failure and uses the fallback', () => {
    // auth-js sets message to JSON.stringify(new Response()) === "{}" for 5xx.
    const err = { status: 500, message: '{}' };
    expect(getAuthErrorMessage(err, 'sender not configured')).toBe('sender not configured');
  });

  it('treats an unexpected_failure code as a server failure and uses the fallback', () => {
    const err = { status: 500, code: 'unexpected_failure', message: 'Error sending confirmation email' };
    expect(getAuthErrorMessage(err, 'sender not configured')).toBe('sender not configured');
  });

  it('passes through a legible auth error message', () => {
    const err = { status: 400, code: 'otp_expired', message: 'The code has expired.' };
    expect(getAuthErrorMessage(err, 'fallback')).toBe('The code has expired.');
  });

  it('uses the fallback for null, undefined, and non-object errors', () => {
    expect(getAuthErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getAuthErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getAuthErrorMessage('boom', 'fallback')).toBe('fallback');
  });
});