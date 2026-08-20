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
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr.', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal' },
];

// Fallback rates relative to base currency USD (1.0 USD)
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  NGN: 1600.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  KES: 129.5,
  GHS: 15.6,
  ZAR: 18.2,
  INR: 83.9,
  JPY: 147.2,
  CHF: 0.86,
  BRL: 5.48,
  CNY: 7.14,
  AED: 3.67,
  SGD: 1.31,
  EGP: 48.6,
  ZMW: 26.1,
  RWF: 1340.0,
  TZS: 2710.0,
  UGX: 3710.0,
  XOF: 600.0,
  XAF: 600.0,
  NZD: 1.65,
  SEK: 10.4,
  NOK: 10.6,
  DKK: 6.86,
  PLN: 3.92,
  TRY: 33.7,
  SAR: 3.75,
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
