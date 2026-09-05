export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  currency: string;
  categories: string[];
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    categories: [
      'Electricity',
      'TV',
      'Internet',
      'Airtime / Mobile Data',
      'Water',
      'Education',
      'Government',
      'Other',
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
    categories: [
      'Electricity & Gas',
      'Water',
      'Internet',
      'TV',
      'Mobile',
      'Council & Government',
      'Other',
    ],
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    categories: [
      'Electricity & Utilities',
      'Internet',
      'Mobile',
      'TV & Streaming',
      'Water',
      'Software & Digital Services',
      'Other',
    ],
  },
  {
    code: 'GLOBAL',
    name: 'Global',
    flag: '🌐',
    currency: 'USD',
    categories: [
      'Software / Digital Services',
      'TV / Streaming',
      'Internet',
      'Utilities',
      'Other',
    ],
  },
];

export function getCountryConfig(countryName: string): CountryConfig | null {
  if (!countryName) return null;
  const norm = countryName.toLowerCase().trim();
  return (
    SUPPORTED_COUNTRIES.find(
      (c) => c.name.toLowerCase() === norm || c.code.toLowerCase() === norm
    ) || null
  );
}

export function getCountryCategories(countryName: string): string[] {
  const config = getCountryConfig(countryName);
  if (config) return config.categories;
  return [
    'Electricity',
    'TV',
    'Internet',
    'Airtime / Mobile Data',
    'Utilities',
    'Software / Digital Services',
    'Other',
  ];
}
