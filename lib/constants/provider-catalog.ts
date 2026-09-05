import type { VerifiedProvider } from '@/lib/types/bills.types';

export interface ExtendedVerifiedProvider extends VerifiedProvider {
  isSubscriptionOnly?: boolean;
}

export const PROVIDER_CATALOG: ExtendedVerifiedProvider[] = [
  // ==========================================
  // NIGERIA 🇳🇬
  // ==========================================
  // Electricity DISCOs
  {
    id: 'ikedc',
    name: 'Ikeja Electric (IKEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    domain: 'ikejaelectric.com',
    description: 'Prepaid & Postpaid electricity tokens for Ikeja, Lagos zone.',
    officialWebsite: 'https://www.ikejaelectric.com',
    officialPaymentUrl: 'https://www.ikejaelectric.com/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    cancellationUrl: 'https://www.ikejaelectric.com/customer-service',
    cancellationSteps: [
      'Contact Ikeja Electric customer care or visit nearest undertaking office.',
      'Request disconnection or meter account closure.',
      'Settle outstanding arrears if postpaid.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'ekedc',
    name: 'Eko Electricity (EKEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    domain: 'ekedp.com',
    description: 'Electricity bill payments for Lagos Island, Lekki & Festac.',
    officialWebsite: 'https://ekedp.com',
    officialPaymentUrl: 'https://ekedp.com/pay-bills',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    cancellationUrl: 'https://ekedp.com/contact-us',
    cancellationSteps: [
      'Contact EKEDC customer service hotline.',
      'Submit written disconnection request with meter details.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'ibedc',
    name: 'Ibadan Electricity (IBEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    domain: 'ibedc.com',
    description: 'Electricity tokens for Oyo, Ogun, Osun and Kwara states.',
    officialWebsite: 'https://www.ibedc.com',
    officialPaymentUrl: 'https://www.ibedc.com/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'aedc',
    name: 'Abuja Electricity (AEDC)',
    category: 'Electricity',
    country: 'Nigeria',
    domain: 'aborigelectricity.com',
    description: 'Electricity bill payment for FCT Abuja, Nasarawa & Kogi.',
    officialWebsite: 'https://www.aborigelectricity.com',
    officialPaymentUrl: 'https://www.aborigelectricity.com/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'phed',
    name: 'Port Harcourt Electricity (PHED)',
    category: 'Electricity',
    country: 'Nigeria',
    domain: 'phed.com.ng',
    description: 'Electricity token top-up for Rivers, Bayelsa & Akwa Ibom.',
    officialWebsite: 'https://phed.com.ng',
    officialPaymentUrl: 'https://phed.com.ng/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    status: 'active',
    verificationStatus: 'verified',
  },

  // TV / Cable Nigeria
  {
    id: 'dstv',
    name: 'MultiChoice DStv',
    category: 'TV',
    country: 'Nigeria',
    domain: 'dstv.com',
    description: 'DStv satellite TV subscription renewal and package upgrade.',
    officialWebsite: 'https://www.dstv.com',
    officialPaymentUrl: 'https://www.dstv.com/en-ng/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.dstv.com/en-ng/self-service',
    cancellationSteps: [
      'Sign in to your MyDStv portal or app.',
      'Go to My Subscriptions and toggle auto-renewal OFF.',
      'Confirm downgrade or cancellation before next billing date.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'gotv',
    name: 'GOtv Nigeria',
    category: 'TV',
    country: 'Nigeria',
    domain: 'gotvafrica.com',
    description: 'GOtv digital decoder subscription packages.',
    officialWebsite: 'https://www.gotvafrica.com',
    officialPaymentUrl: 'https://www.gotvafrica.com/en-ng/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.gotvafrica.com/en-ng/pay',
    cancellationSteps: [
      'Log into GOtv Self Service.',
      'Select Manage Subscription and cancel auto-billing.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'startimes',
    name: 'StarTimes Nigeria',
    category: 'TV',
    country: 'Nigeria',
    domain: 'startimes.com.ng',
    description: 'StarTimes pay TV recharge and smartcard renewal.',
    officialWebsite: 'https://www.startimes.com.ng',
    officialPaymentUrl: 'https://www.startimes.com.ng/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    status: 'active',
    verificationStatus: 'verified',
  },

  // Internet & Telco Nigeria
  {
    id: 'mtn',
    name: 'MTN Nigeria',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    domain: 'mtn.ng',
    description: 'MTN airtime top-up, data bundles and Broadband Wi-Fi.',
    officialWebsite: 'https://www.mtn.ng',
    officialPaymentUrl: 'https://mymtn.com.ng',
    supportedPaymentFlow: 'topup',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://mymtn.com.ng',
    cancellationSteps: [
      'Open myMTN App or website.',
      'Go to Subscriptions / Active Bundles.',
      'Turn off Auto-Renewal on data or voice bundle.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'airtel',
    name: 'Airtel Nigeria',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    domain: 'airtel.com.ng',
    description: 'Airtel recharge, data plans and home broadband.',
    officialWebsite: 'https://www.airtel.com.ng',
    officialPaymentUrl: 'https://www.airtel.com.ng/recharge',
    supportedPaymentFlow: 'topup',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.airtel.com.ng/recharge',
    cancellationSteps: [
      'Dial *312# or open MyAirtel App.',
      'Navigate to Auto-Renewal settings and opt out.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'glo',
    name: 'Glo Nigeria',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    domain: 'gloworld.com',
    description: 'Glo mobile airtime and data plan recharge.',
    officialWebsite: 'https://www.gloworld.com',
    officialPaymentUrl: 'https://www.gloworld.com/ng/personal/recharge/',
    supportedPaymentFlow: 'topup',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: '9mobile',
    name: '9mobile',
    category: 'Airtime / Mobile Data',
    country: 'Nigeria',
    domain: '9mobile.com.ng',
    description: '9mobile voice airtime and data bundle top-up.',
    officialWebsite: 'https://9mobile.com.ng',
    officialPaymentUrl: 'https://9mobile.com.ng/recharge/',
    supportedPaymentFlow: 'topup',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'spectranet',
    name: 'Spectranet 4G LTE',
    category: 'Internet',
    country: 'Nigeria',
    domain: 'spectranet.com.ng',
    description: 'Spectranet home & office high-speed 4G LTE internet.',
    officialWebsite: 'https://www.spectranet.com.ng',
    officialPaymentUrl: 'https://selfcare.spectranet.com.ng',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://selfcare.spectranet.com.ng',
    cancellationSteps: [
      'Sign in to Spectranet Selfcare Portal.',
      'Navigate to Account Settings -> Payment Preferences.',
      'Disable automatic recurring card charge.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'starlink',
    name: 'Starlink',
    category: 'Internet',
    country: 'Nigeria',
    domain: 'starlink.com',
    description: 'Starlink Satellite Internet Service billing.',
    officialWebsite: 'https://www.starlink.com',
    officialPaymentUrl: 'https://auth.starlink.com/',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'swift',
    name: 'Swift Networks',
    category: 'Internet',
    country: 'Nigeria',
    domain: 'swiftng.com',
    description: 'Swift broadband 4G LTE internet service.',
    officialWebsite: 'https://www.swiftng.com',
    officialPaymentUrl: 'https://www.swiftng.com/sub/onlinepay.aspx',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'fiberone',
    name: 'FiberOne Broadband',
    category: 'Internet',
    country: 'Nigeria',
    domain: 'fob.ng',
    description: 'FiberOne FTTH fiber internet bill renewal.',
    officialWebsite: 'https://www.fob.ng',
    officialPaymentUrl: 'https://selfcare.fob.ng',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'lwc',
    name: 'Lagos Water Corporation (LWC)',
    category: 'Water',
    country: 'Nigeria',
    domain: 'lagoswater.org',
    description: 'Municipal water bill payments for Lagos state residents.',
    officialWebsite: 'https://lagoswater.org',
    officialPaymentUrl: 'https://lagoswater.org/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'manual',
    status: 'active',
    verificationStatus: 'verified',
  },

  // ==========================================
  // UNITED KINGDOM 🇬🇧
  // ==========================================
  {
    id: 'british_gas',
    name: 'British Gas',
    category: 'Electricity & Gas',
    country: 'United Kingdom',
    domain: 'britishgas.co.uk',
    description: 'UK gas and electricity bill payment and meter top-ups.',
    officialWebsite: 'https://www.britishgas.co.uk',
    officialPaymentUrl: 'https://www.britishgas.co.uk/identity/login',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.britishgas.co.uk/help-and-support/moving-home',
    cancellationSteps: [
      'Log in to British Gas online account.',
      'Go to Moving Home / Change of Tenancy.',
      'Submit final meter readings and close account.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'octopus_energy',
    name: 'Octopus Energy',
    category: 'Electricity & Gas',
    country: 'United Kingdom',
    domain: 'octopus.energy',
    description: 'Green energy & electricity account management.',
    officialWebsite: 'https://octopus.energy',
    officialPaymentUrl: 'https://octopus.energy/dashboard/pay/',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://octopus.energy/dashboard/new/accounts/switch-out/',
    cancellationSteps: [
      'Log into your Octopus Energy account dashboard.',
      'Initiate account switch or cancel Direct Debit.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'thames_water',
    name: 'Thames Water',
    category: 'Water',
    country: 'United Kingdom',
    domain: 'thameswater.co.uk',
    description: 'Water & wastewater bill payments in Greater London & Thames Valley.',
    officialWebsite: 'https://www.thameswater.co.uk',
    officialPaymentUrl: 'https://www.thameswater.co.uk/pay-my-bill',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.thameswater.co.uk/help/moving-home',
    cancellationSteps: [
      'Log in to Thames Water account portal.',
      'Select Moving Home to notify Thames Water of account closure.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'sky_uk',
    name: 'Sky UK Broadband & TV',
    category: 'TV',
    country: 'United Kingdom',
    domain: 'sky.com',
    description: 'Sky Broadband, Sky TV & Glass subscription billing.',
    officialWebsite: 'https://www.sky.com',
    officialPaymentUrl: 'https://www.sky.com/myaccount/bill',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.sky.com/help/articles/cancel-sky-tv',
    cancellationSteps: [
      'Sign in to My Sky Account.',
      'Go to Product Subscriptions.',
      'Request package cancellation (30 days notice required).',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'ee_uk',
    name: 'EE Mobile & Broadband',
    category: 'Mobile',
    country: 'United Kingdom',
    domain: 'ee.co.uk',
    description: 'EE mobile network & home broadband bill payment.',
    officialWebsite: 'https://ee.co.uk',
    officialPaymentUrl: 'https://ee.co.uk/my-ee/pay-bill',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'tv_licensing',
    name: 'UK TV Licensing',
    category: 'Council & Government',
    country: 'United Kingdom',
    domain: 'tvlicensing.co.uk',
    description: 'Official UK Television License annual/monthly payment.',
    officialWebsite: 'https://www.tvlicensing.co.uk',
    officialPaymentUrl: 'https://www.tvlicensing.co.uk/pay',
    supportedPaymentFlow: 'redirect',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.tvlicensing.co.uk/cs/cancelled-licence/index.app',
    cancellationSteps: [
      'Go to TV Licensing Cancellation Form.',
      'Declare that you no longer watch live TV or BBC iPlayer.',
      'Submit request for license refund/cancellation.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },

  // ==========================================
  // UNITED STATES 🇺🇸
  // ==========================================
  {
    id: 'pge',
    name: 'PG&E (Pacific Gas & Electric)',
    category: 'Electricity & Utilities',
    country: 'United States',
    domain: 'pge.com',
    description: 'Electric & gas utility bill payment for Northern California.',
    officialWebsite: 'https://www.pge.com',
    officialPaymentUrl: 'https://www.pge.com/en/myaccount/pay-bill.html',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.pge.com/en/myaccount/services/start-stop-service.html',
    cancellationSteps: [
      'Log into PG&E My Account.',
      'Navigate to Service Requests -> Stop Service.',
      'Set stop date and final billing address.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'coned',
    name: 'Con Edison',
    category: 'Electricity & Utilities',
    country: 'United States',
    domain: 'coned.com',
    description: 'New York City & Westchester energy utility payment portal.',
    officialWebsite: 'https://www.coned.com',
    officialPaymentUrl: 'https://www.coned.com/en/accounts-billing/payment-options',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'xfinity',
    name: 'Comcast Xfinity',
    category: 'Internet',
    country: 'United States',
    domain: 'xfinity.com',
    description: 'Xfinity high-speed internet, cable TV & mobile billing.',
    officialWebsite: 'https://www.xfinity.com',
    officialPaymentUrl: 'https://www.xfinity.com/bill-pay',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.xfinity.com/support/articles/cancel-my-account',
    cancellationSteps: [
      'Log in to Xfinity Account.',
      'Chat with Xfinity Assistant or request a cancellation callback.',
    ],
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'att',
    name: 'AT&T Wireless & Fiber',
    category: 'Mobile',
    country: 'United States',
    domain: 'att.com',
    description: 'AT&T wireless mobile plans and fiber internet bill.',
    officialWebsite: 'https://www.att.com',
    officialPaymentUrl: 'https://www.att.com/myatt/paybill',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'verizon',
    name: 'Verizon Fios / Wireless',
    category: 'Mobile',
    country: 'United States',
    domain: 'verizon.com',
    description: 'Verizon mobile & Fios home internet monthly billing.',
    officialWebsite: 'https://www.verizon.com',
    officialPaymentUrl: 'https://www.verizon.com/paymybill',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    status: 'active',
    verificationStatus: 'verified',
  },

  // ==========================================
  // PURE SUBSCRIPTION PROVIDERS (Exclusively for Subscriptions)
  // ==========================================
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'Streaming',
    country: 'Global',
    domain: 'netflix.com',
    description: 'Global video streaming membership plan.',
    officialWebsite: 'https://www.netflix.com',
    officialPaymentUrl: 'https://www.netflix.com/youraccount',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.netflix.com/youraccount',
    cancellationSteps: [
      'Open Netflix Account page (netflix.com/youraccount).',
      'Click the "Cancel Membership" button under Membership & Billing.',
      'Click "Finish Cancellation" to confirm.',
    ],
    isSubscriptionOnly: true,
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Streaming',
    country: 'Global',
    domain: 'spotify.com',
    description: 'Spotify Premium music & podcast streaming plan.',
    officialWebsite: 'https://www.spotify.com',
    officialPaymentUrl: 'https://www.spotify.com/account/overview/',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://www.spotify.com/account/change-plan/',
    cancellationSteps: [
      'Log into spotify.com/account.',
      'Under Your Plan, click "Change Plan".',
      'Scroll to Cancel Spotify and click "Cancel Premium".',
      'Confirm cancellation.',
    ],
    isSubscriptionOnly: true,
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'aws',
    name: 'Amazon Web Services (AWS)',
    category: 'Software',
    country: 'Global',
    domain: 'aws.amazon.com',
    description: 'Cloud hosting, S3 storage & infrastructure billing.',
    officialWebsite: 'https://aws.amazon.com',
    officialPaymentUrl: 'https://console.aws.amazon.com/billing/home',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://console.aws.amazon.com/billing/home#/account',
    cancellationSteps: [
      'Log into AWS Billing & Cost Management Console.',
      'Scroll to the bottom of the Account Settings page.',
      'Check all agreement boxes and click "Close Account".',
    ],
    isSubscriptionOnly: true,
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT Plus',
    category: 'Software',
    country: 'Global',
    domain: 'openai.com',
    description: 'ChatGPT Plus & Team Subscription.',
    officialWebsite: 'https://openai.com',
    officialPaymentUrl: 'https://chatgpt.com/#settings/Subscription',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://chatgpt.com/#settings/Subscription',
    cancellationSteps: [
      'Open ChatGPT and click your Profile Picture -> Settings.',
      'Select Subscription.',
      'Click "Manage my subscription" and choose "Cancel Plan".',
    ],
    isSubscriptionOnly: true,
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'github',
    name: 'GitHub Pro / Copilot',
    category: 'Software',
    country: 'Global',
    domain: 'github.com',
    description: 'Developer cloud repositories and AI pair programmer.',
    officialWebsite: 'https://github.com',
    officialPaymentUrl: 'https://github.com/settings/billing',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://github.com/settings/billing',
    cancellationSteps: [
      'Go to GitHub Settings -> Billing and plans.',
      'Beside your plan, click "Edit" -> "Downgrade to Free".',
      'Follow instructions to confirm downgrade.',
    ],
    isSubscriptionOnly: true,
    status: 'active',
    verificationStatus: 'verified',
  },
  {
    id: 'adobe',
    name: 'Adobe Creative Cloud',
    category: 'Software',
    country: 'Global',
    domain: 'adobe.com',
    description: 'Adobe Creative Cloud design apps membership.',
    officialWebsite: 'https://www.adobe.com',
    officialPaymentUrl: 'https://account.adobe.com/plans',
    supportedPaymentFlow: 'account_portal',
    cancellationCapability: 'assisted',
    cancellationUrl: 'https://account.adobe.com/plans',
    cancellationSteps: [
      'Log into account.adobe.com/plans.',
      'Select "Manage Plan" for the subscription you wish to cancel.',
      'Click "Cancel your plan" and follow prompt steps.',
    ],
    isSubscriptionOnly: true,
    status: 'active',
    verificationStatus: 'verified',
  },
];

/**
 * Filter catalog providers by country and optionally category.
 * Strictly excludes pure subscription-only services for bill payment queries!
 */
export function getCatalogProviders(country: string, category?: string, includeSubscriptions = false): ExtendedVerifiedProvider[] {
  const normCountry = (country || 'Nigeria').toLowerCase().trim();
  let list = PROVIDER_CATALOG.filter((p) => {
    const matchCountry = p.country.toLowerCase() === normCountry || p.country.toLowerCase() === 'global';
    const allowSubscription = includeSubscriptions || !p.isSubscriptionOnly;
    return matchCountry && allowSubscription;
  });

  if (category && category !== 'All') {
    const normCategory = category.toLowerCase().trim();
    list = list.filter((p) => {
      const pCat = p.category.toLowerCase().trim();
      return pCat === normCategory || pCat.includes(normCategory) || normCategory.includes(pCat);
    });
  }

  return list;
}

/**
 * Search provider catalog by query
 */
export function searchProviderCatalog(query: string, country?: string): ExtendedVerifiedProvider[] {
  const normQuery = (query || '').toLowerCase().trim();
  let list = country ? getCatalogProviders(country) : PROVIDER_CATALOG;

  if (!normQuery) return list;

  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(normQuery) ||
      p.category.toLowerCase().includes(normQuery) ||
      (p.description && p.description.toLowerCase().includes(normQuery))
  );
}

/**
 * Get verified provider catalog entry by name
 */
export function getCatalogProviderByName(name: string): ExtendedVerifiedProvider | null {
  if (!name || !name.trim()) return null;
  const norm = name.toLowerCase().trim();
  return (
    PROVIDER_CATALOG.find(
      (p) => p.name.toLowerCase() === norm || p.name.toLowerCase().includes(norm) || norm.includes(p.name.toLowerCase())
    ) || null
  );
}
