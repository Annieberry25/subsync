import { describe, expect, it } from 'vitest';
import {
  gmailStatusFromRow,
  isGmailTokenError,
  partitionNewDiscoveries,
  type GmailConnectionRow,
} from '@/lib/services/gmail-service';
import type { DiscoveredSubscription } from '@/lib/types/gmail.types';

function found(providerName: string): DiscoveredSubscription {
  return {
    id: providerName,
    providerName,
    amount: 10,
    currency: 'USD',
    category: 'Entertainment',
    billingCycle: 'monthly',
    from: 'billing@example.com',
    subject: 'Your receipt',
    date: '2026-10-01',
  };
}

describe('partitionNewDiscoveries', () => {
  it('keeps only what the user does not already track', () => {
    const result = partitionNewDiscoveries(
      [found('Netflix'), found('Spotify'), found('Canva')],
      ['Netflix', 'Spotify']
    );
    expect(result.discovered.map((d) => d.providerName)).toEqual(['Canva']);
    expect(result.alreadyKnown).toBe(2);
  });

  it('matches names case- and whitespace-insensitively', () => {
    const result = partitionNewDiscoveries([found('Netflix')], ['  netflix ']);
    expect(result.discovered).toHaveLength(0);
    expect(result.alreadyKnown).toBe(1);
  });

  it('passes everything through when nothing is known yet', () => {
    const result = partitionNewDiscoveries([found('Netflix')], []);
    expect(result.discovered).toHaveLength(1);
    expect(result.alreadyKnown).toBe(0);
  });

  it('does not treat a re-scan as new work', () => {
    const scan = [found('Netflix'), found('Spotify')];
    // First scan imports both; the next scan of the same inbox must find nothing.
    const first = partitionNewDiscoveries(scan, []);
    const second = partitionNewDiscoveries(
      scan,
      first.discovered.map((d) => d.providerName)
    );
    expect(second.discovered).toHaveLength(0);
    expect(second.alreadyKnown).toBe(2);
  });
});

function row(overrides: Partial<GmailConnectionRow>): GmailConnectionRow {
  return {
    user_id: 'user-1',
    email: 'user@example.com',
    credentials: {},
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    status: 'connected',
    last_scan_at: null,
    last_scan_status: null,
    last_scan_count: null,
    connected_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as GmailConnectionRow;
}

describe('gmailStatusFromRow', () => {
  it('reports a live connection with its scan metadata', () => {
    const status = gmailStatusFromRow(
      row({ last_scan_at: '2026-10-18T06:39:43.793Z', last_scan_count: 2 })
    );
    expect(status).toEqual({
      connected: true,
      email: 'user@example.com',
      lastScanAt: '2026-10-18T06:39:43.793Z',
      lastScanCount: 2,
    });
  });

  it('reports no connection when there is no row', () => {
    expect(gmailStatusFromRow(null)).toEqual({ connected: false });
  });

  it('asks for a reconnection when the stored grant is dead', () => {
    expect(gmailStatusFromRow(row({ status: 'error' }))).toEqual({
      connected: false,
      needsReconnect: true,
    });
  });

  it('asks for a reconnection when the grant was revoked', () => {
    expect(gmailStatusFromRow(row({ status: 'revoked' }))).toEqual({
      connected: false,
      needsReconnect: true,
    });
  });
});

describe('isGmailTokenError', () => {
  it('recognises the expired-refresh-token wording Google returns', () => {
    expect(isGmailTokenError(new Error('invalid_grant'))).toBe(true);
    expect(isGmailTokenError(new Error('Token has been expired or revoked.'))).toBe(true);
    expect(isGmailTokenError(new Error('invalid_token'))).toBe(true);
  });

  it('recognises an unauthorized response from the Gmail API', () => {
    expect(isGmailTokenError({ response: { status: 401 } })).toBe(true);
  });

  it('does not mistake a transient failure for a dead grant', () => {
    // A quota 403 or a network blip must not push the user through OAuth again.
    expect(isGmailTokenError({ response: { status: 403 } })).toBe(false);
    expect(isGmailTokenError(new Error('Quota exceeded for gmail.users.messages.list'))).toBe(false);
    expect(isGmailTokenError(new Error('getaddrinfo ENOTFOUND gmail.googleapis.com'))).toBe(false);
    expect(isGmailTokenError(undefined)).toBe(false);
  });
});