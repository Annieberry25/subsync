import { describe, it, expect } from 'vitest';
import { createGmailState, gmailStateMatches } from '@/lib/services/gmail-service';

describe('Gmail OAuth state binding', () => {
  it('mints a nonce.userId pair bound to the given user', () => {
    const state = createGmailState('user-abc');
    expect(gmailStateMatches(state, 'user-abc')).toBe(true);
    expect(gmailStateMatches(state, 'user-other')).toBe(false);
  });

  it('rejects a state that is not a nonce.userId pair', () => {
    expect(gmailStateMatches('no-separator-at-all', 'user-abc')).toBe(false);
    expect(gmailStateMatches('', 'user-abc')).toBe(false);
  });

  it('is unique across calls', () => {
    expect(createGmailState('user-abc')).not.toBe(createGmailState('user-abc'));
  });
});