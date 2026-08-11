export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
];

// Fallback rates relative to base currency USD (1.0 USD)
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  NGN: 1600.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
};

const CACHE_KEY = 'subsync_exchange_rates';
const CACHE_TIME_KEY = 'subsync_exchange_rates_time';
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - Number(cachedTime) < ONE_HOUR_MS) {
        const parsed = JSON.parse(cached);
        return { ...DEFAULT_EXCHANGE_RATES, ...parsed };
      }
    } catch {
      // Fall through on cache error
    }
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates && typeof data.rates === 'object') {
        const mergedRates = { ...DEFAULT_EXCHANGE_RATES, ...data.rates };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(mergedRates));
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
          } catch {
            // Ignore storage errors
          }
        }
        return mergedRates;
      }
    }
  } catch {
    // Fail safely and return default exchange rates
  }

  return DEFAULT_EXCHANGE_RATES;
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  if (!amount || isNaN(amount)) return 0;

  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();

  if (from === to) return amount;

  const fromRate = rates[from] || DEFAULT_EXCHANGE_RATES[from] || 1.0;
  const toRate = rates[to] || DEFAULT_EXCHANGE_RATES[to] || 1.0;

  // Convert from source currency to USD base, then from USD to target currency
  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

export function formatCurrencyAmount(amount: number, currency = 'USD'): string {
  const code = (currency || 'USD').toUpperCase();
  const num = isNaN(amount) ? 0 : amount;

  if (code === 'NGN') {
    const formattedNum = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return `₦${formattedNum}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${code} ${num.toFixed(2)}`;
  }
}
