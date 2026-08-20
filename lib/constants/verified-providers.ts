import type { VerifiedProvider } from '@/lib/types/bills.types';

export const VERIFIED_PROVIDERS: VerifiedProvider[] = [
  // --- NIGERIA ELECTRICITY DISCOs ---
  {
    name: 'Ikeja Electric (IKEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Lagos',
    officialWebsite: 'https://www.ikejaelectric.com',
    officialPaymentUrl: 'https://www.ikejaelectric.com/pay',
    verificationStatus: 'verified',
    supportedRegions: ['Lagos', 'Ikeja', 'Ikorodu', 'Oshodi', 'Abule Egba', 'Akowonjo'],
  },
  {
    name: 'Eko Electricity (EKEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Lagos',
    officialWebsite: 'https://ekedp.com',
    officialPaymentUrl: 'https://ekedp.com/pay-bills',
    verificationStatus: 'verified',
    supportedRegions: ['Lagos', 'Island', 'Lekki', 'Victoria Island', 'Festac', 'Ijora'],
  },
  {
    name: 'Ibadan Electricity (IBEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Oyo',
    officialWebsite: 'https://www.ibedc.com',
    officialPaymentUrl: 'https://www.ibedc.com/pay',
    verificationStatus: 'verified',
    supportedRegions: ['Oyo', 'Ogun', 'Osun', 'Kwara', 'Ibadan'],
  },
  {
    name: 'Abuja Electricity (AEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Abuja',
    officialWebsite: 'https://www.aborigelectricity.com',
    officialPaymentUrl: 'https://www.aborigelectricity.com/pay',
    verificationStatus: 'verified',
    supportedRegions: ['FCT', 'Abuja', 'Nasarawa', 'Kogi', 'Niger'],
  },
  {
    name: 'Port Harcourt Electricity (PHED)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Rivers',
    officialWebsite: 'https://phed.com.ng',
    officialPaymentUrl: 'https://phed.com.ng/pay',
    verificationStatus: 'verified',
    supportedRegions: ['Rivers', 'Bayelsa', 'Cross River', 'Akwa Ibom', 'Port Harcourt'],
  },
  {
    name: 'Enugu Electricity (EEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Enugu',
    officialWebsite: 'https://enugudisco.com',
    officialPaymentUrl: 'https://enugudisco.com/pay',
    verificationStatus: 'verified',
    supportedRegions: ['Enugu', 'Anambra', 'Abia', 'Imo', 'Ebonyi'],
  },
  {
    name: 'Kano Electricity (KEDCO)',
    category: 'Electricity',
    country: 'Nigeria',
    region: 'Kano',
    officialWebsite: 'https://kedco.ng',
    officialPaymentUrl: 'https://kedco.ng/pay',
    verificationStatus: 'verified',
    supportedRegions: ['Kano', 'Katsina', 'Jigawa'],
  },

  // --- NIGERIA TELCO / INTERNET ---
  {
    name: 'MTN Nigeria',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    officialWebsite: 'https://www.mtn.ng',
    officialPaymentUrl: 'https://mymtn.com.ng',
    verificationStatus: 'verified',
  },
  {
    name: 'Airtel Nigeria',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    officialWebsite: 'https://www.airtel.com.ng',
    officialPaymentUrl: 'https://www.airtel.com.ng/recharge',
    verificationStatus: 'verified',
  },
  {
    name: 'Glo Nigeria',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    officialWebsite: 'https://www.gloworld.com',
    officialPaymentUrl: 'https://www.gloworld.com/ng/personal/recharge/',
    verificationStatus: 'verified',
  },
  {
    name: '9mobile',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    officialWebsite: 'https://9mobile.com.ng',
    officialPaymentUrl: 'https://9mobile.com.ng/recharge/',
    verificationStatus: 'verified',
  },
  {
    name: 'Spectranet 4G LTE',
    category: 'Internet',
    country: 'Nigeria',
    region: 'Lagos',
    officialWebsite: 'https://www.spectranet.com.ng',
    officialPaymentUrl: 'https://selfcare.spectranet.com.ng',
    verificationStatus: 'verified',
  },
  {
    name: 'Starlink',
    category: 'Internet',
    country: 'Global',
    officialWebsite: 'https://www.starlink.com',
    officialPaymentUrl: 'https://auth.starlink.com/',
    verificationStatus: 'verified',
  },
  {
    name: 'Swift Networks',
    category: 'Internet',
    country: 'Nigeria',
    region: 'Lagos',
    officialWebsite: 'https://www.swiftng.com',
    officialPaymentUrl: 'https://www.swiftng.com/sub/onlinepay.aspx',
    verificationStatus: 'verified',
  },
  {
    name: 'FiberOne Broadband',
    category: 'Internet',
    country: 'Nigeria',
    officialWebsite: 'https://www.fob.ng',
    officialPaymentUrl: 'https://selfcare.fob.ng',
    verificationStatus: 'verified',
  },

  // --- TV & STREAMING ---
  {
    name: 'MultiChoice DSTV',
    category: 'TV / Streaming',
    country: 'Nigeria',
    officialWebsite: 'https://www.dstv.com',
    officialPaymentUrl: 'https://www.dstv.com/en-ng/pay',
    verificationStatus: 'verified',
  },
  {
    name: 'GOtv Nigeria',
    category: 'TV / Streaming',
    country: 'Nigeria',
    officialWebsite: 'https://www.gotvafrica.com',
    officialPaymentUrl: 'https://www.gotvafrica.com/en-ng/pay',
    verificationStatus: 'verified',
  },
  {
    name: 'StarTimes Nigeria',
    category: 'TV / Streaming',
    country: 'Nigeria',
    officialWebsite: 'https://www.startimes.com.ng',
    officialPaymentUrl: 'https://www.startimes.com.ng/pay',
    verificationStatus: 'verified',
  },
  {
    name: 'Netflix',
    category: 'TV / Streaming',
    country: 'Global',
    officialWebsite: 'https://www.netflix.com',
    officialPaymentUrl: 'https://www.netflix.com/youraccount',
    verificationStatus: 'verified',
  },
  {
    name: 'Spotify',
    category: 'TV / Streaming',
    country: 'Global',
    officialWebsite: 'https://www.spotify.com',
    officialPaymentUrl: 'https://www.spotify.com/account/overview/',
    verificationStatus: 'verified',
  },

  // --- WATER & LOCAL UTILITIES ---
  {
    name: 'Lagos Water Corporation (LWC)',
    category: 'Utilities',
    country: 'Nigeria',
    region: 'Lagos',
    officialWebsite: 'https://lagoswater.org',
    officialPaymentUrl: 'https://lagoswater.org/pay',
    verificationStatus: 'verified',
  },

  // --- SOFTWARE & DIGITAL SERVICES ---
  {
    name: 'Amazon Web Services (AWS)',
    category: 'Software / Digital Services',
    country: 'Global',
    officialWebsite: 'https://aws.amazon.com',
    officialPaymentUrl: 'https://console.aws.amazon.com/billing/home',
    verificationStatus: 'verified',
  },
  {
    name: 'Google Cloud Platform',
    category: 'Software / Digital Services',
    country: 'Global',
    officialWebsite: 'https://cloud.google.com',
    officialPaymentUrl: 'https://console.cloud.google.com/billing',
    verificationStatus: 'verified',
  },
  {
    name: 'OpenAI ChatGPT',
    category: 'Software / Digital Services',
    country: 'Global',
    officialWebsite: 'https://openai.com',
    officialPaymentUrl: 'https://chatgpt.com/#settings/Subscription',
    verificationStatus: 'verified',
  },
  {
    name: 'GitHub',
    category: 'Software / Digital Services',
    country: 'Global',
    officialWebsite: 'https://github.com',
    officialPaymentUrl: 'https://github.com/settings/billing',
    verificationStatus: 'verified',
  },
  {
    name: 'Microsoft 365',
    category: 'Software / Digital Services',
    country: 'Global',
    officialWebsite: 'https://www.microsoft.com',
    officialPaymentUrl: 'https://account.microsoft.com/services',
    verificationStatus: 'verified',
  },
  {
    name: 'Adobe Creative Cloud',
    category: 'Software / Digital Services',
    country: 'Global',
    officialWebsite: 'https://www.adobe.com',
    officialPaymentUrl: 'https://account.adobe.com/plans',
    verificationStatus: 'verified',
  },
];

/**
 * Searches for a verified provider by name or query string.
 * Strictly returns verified details only.
 */
export function getVerifiedProvider(providerName: string): VerifiedProvider | null {
  if (!providerName || !providerName.trim()) return null;
  const norm = providerName.toLowerCase().trim();

  // 1. Exact match
  const exact = VERIFIED_PROVIDERS.find(
    (p) => p.name.toLowerCase() === norm || p.name.toLowerCase().includes(norm)
  );
  if (exact) return exact;

  // 2. Keyword match
  for (const p of VERIFIED_PROVIDERS) {
    const pNameNorm = p.name.toLowerCase();
    if (pNameNorm.includes(norm) || norm.includes(pNameNorm)) {
      return p;
    }
  }

  return null;
}

/**
 * Filter verified providers for autosuggestion / dropdowns.
 */
export function searchVerifiedProviders(query: string, category?: string): VerifiedProvider[] {
  const normQuery = (query || '').toLowerCase().trim();
  let list = VERIFIED_PROVIDERS;

  if (category && category !== 'All' && category !== 'Other') {
    list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  if (!normQuery) return list.slice(0, 10);

  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(normQuery) ||
      p.category.toLowerCase().includes(normQuery) ||
      (p.region && p.region.toLowerCase().includes(normQuery))
  );
}
