import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  convertAmount,
  formatCurrencyAmount,
  fetchExchangeRates,
  DEFAULT_EXCHANGE_RATES,
  SUPPORTED_CURRENCIES,
} from '@/lib/services/currency-service';

describe('convertAmount', () => {
  it('returns the amount unchanged for the same currency', () => {
    expect(convertAmount(100, 'USD', 'USD')).toBe(100);
  });

  it('converts USD to NGN using default rates', () => {
    expect(convertAmount(10, 'USD', 'NGN')).toBeCloseTo(10 * 1600);
  });

  it('converts NGN back to USD', () => {
    expect(convertAmount(1600, 'NGN', 'USD')).toBeCloseTo(1);
  });

  it('returns 0 for a falsy or NaN amount', () => {
    expect(convertAmount(0, 'USD', 'NGN')).toBe(0);
    expect(convertAmount(NaN, 'USD', 'NGN')).toBe(0);
  });

  it('uses provided rates', () => {
    expect(convertAmount(10, 'USD', 'EUR', { EUR: 0.5 })).toBe(5);
  });
});

describe('formatCurrencyAmount', () => {
  it('formats USD', () => {
    expect(formatCurrencyAmount(12.5, 'USD')).toBe('$12.50');
  });

  it('formats NGN with the naira symbol', () => {
    expect(formatCurrencyAmount(1500, 'NGN')).toBe('₦1,500.00');
  });

  it('handles invalid codes gracefully', () => {
    const out = formatCurrencyAmount(10, 'ZZZ');
    expect(out).toContain('10.00');
  });
});

describe('SUPPORTED_CURRENCIES / DEFAULT_EXCHANGE_RATES', () => {
  it('exposes a non-empty list of currencies including NGN', () => {
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(0);
    expect(SUPPORTED_CURRENCIES.map((c) => c.code)).toContain('NGN');
  });

  it('has a default rate for USD', () => {
    expect(DEFAULT_EXCHANGE_RATES.USD).toBe(1);
  });
});

describe('fetchExchangeRates', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns default rates when the network fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const rates = await fetchExchangeRates();
    expect(rates).toEqual(DEFAULT_EXCHANGE_RATES);
  });

  it('merges fetched rates with defaults on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { NGN: 1500, EUR: 0.9 } }),
    });
    const rates = await fetchExchangeRates();
    expect(rates.NGN).toBe(1500);
    expect(rates.EUR).toBe(0.9);
    expect(rates.USD).toBe(1);
  });

  it('uses cached rates when a fresh cache exists', async () => {
    window.localStorage.setItem('subsync_exchange_rates', JSON.stringify({ NGN: 1555 }));
    window.localStorage.setItem('subsync_exchange_rates_time', String(Date.now()));
    const rates = await fetchExchangeRates();
    expect(rates.NGN).toBe(1555);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
