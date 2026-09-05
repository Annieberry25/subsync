/**
 * Provider domain and logo registry for utility billers, telcos, and software providers.
 */

export interface ProviderRegistryItem {
  id: string;
  name: string;
  aliases: string[];
  domain: string;
  category: string;
}

export const PROVIDER_REGISTRY: ProviderRegistryItem[] = [
  // --- ELECTRICITY DISCOs ---
  {
    id: 'ikedc',
    name: 'Ikeja Electric (IKEDC)',
    aliases: ['ikedc', 'ikeja electric', 'ikeja electricity', 'ikeja disco'],
    domain: 'ikejaelectric.com',
    category: 'Electricity',
  },
  {
    id: 'ekedc',
    name: 'Eko Electricity (EKEDC)',
    aliases: ['ekedc', 'eko electric', 'eko electricity', 'eko disco'],
    domain: 'ekedp.com',
    category: 'Electricity',
  },
  {
    id: 'ibedc',
    name: 'Ibadan Electricity (IBEDC)',
    aliases: ['ibedc', 'ibadan electric', 'ibadan electricity'],
    domain: 'ibedc.com',
    category: 'Electricity',
  },
  {
    id: 'aedc',
    name: 'Abuja Electricity (AEDC)',
    aliases: ['aedc', 'abuja electric', 'abuja electricity'],
    domain: 'aborigelectricity.com',
    category: 'Electricity',
  },
  {
    id: 'phed',
    name: 'Port Harcourt Electricity (PHED)',
    aliases: ['phed', 'port harcourt electric', 'phedc'],
    domain: 'phed.com.ng',
    category: 'Electricity',
  },
  {
    id: 'eedc',
    name: 'Enugu Electricity (EEDC)',
    aliases: ['eedc', 'enugu electric', 'enugu electricity'],
    domain: 'enugudisco.com',
    category: 'Electricity',
  },
  {
    id: 'kedco',
    name: 'Kano Electricity (KEDCO)',
    aliases: ['kedco', 'kano electric', 'kano electricity'],
    domain: 'kedco.ng',
    category: 'Electricity',
  },

  // --- TELCO & MOBILE DATA ---
  {
    id: 'mtn',
    name: 'MTN Nigeria',
    aliases: ['mtn', 'mtn nigeria', 'mymtn', 'mtn data', 'mtn airtime'],
    domain: 'mtn.ng',
    category: 'Airtime / Mobile Data',
  },
  {
    id: 'airtel',
    name: 'Airtel Nigeria',
    aliases: ['airtel', 'airtel nigeria', 'airtel data'],
    domain: 'airtel.com.ng',
    category: 'Airtime / Mobile Data',
  },
  {
    id: 'glo',
    name: 'Glo Nigeria',
    aliases: ['glo', 'glo nigeria', 'globacom', 'glo data'],
    domain: 'gloworld.com',
    category: 'Airtime / Mobile Data',
  },
  {
    id: '9mobile',
    name: '9mobile',
    aliases: ['9mobile', 'etisalat', '9mobile data'],
    domain: '9mobile.com.ng',
    category: 'Airtime / Mobile Data',
  },

  // --- INTERNET PROVIDERS ---
  {
    id: 'spectranet',
    name: 'Spectranet 4G LTE',
    aliases: ['spectranet', 'spectranet 4g', 'spectranet lte'],
    domain: 'spectranet.com.ng',
    category: 'Internet',
  },
  {
    id: 'starlink',
    name: 'Starlink',
    aliases: ['starlink', 'spacex starlink', 'starlink internet'],
    domain: 'starlink.com',
    category: 'Internet',
  },
  {
    id: 'swift',
    name: 'Swift Networks',
    aliases: ['swift', 'swift networks', 'swift 4g'],
    domain: 'swiftng.com',
    category: 'Internet',
  },
  {
    id: 'fiberone',
    name: 'FiberOne Broadband',
    aliases: ['fiberone', 'fob', 'fiberone broadband'],
    domain: 'fob.ng',
    category: 'Internet',
  },

  // --- WATER & MUNICIPAL ---
  {
    id: 'lwc',
    name: 'Lagos Water Corporation (LWC)',
    aliases: ['lwc', 'lagos water', 'lagos water corporation', 'water corporation'],
    domain: 'lagoswater.org',
    category: 'Utilities',
  },

  // --- TV & STREAMING ---
  {
    id: 'dstv',
    name: 'MultiChoice DSTV',
    aliases: ['dstv', 'multichoice dstv', 'dstv nigeria'],
    domain: 'dstv.com',
    category: 'TV / Streaming',
  },
  {
    id: 'gotv',
    name: 'GOtv Nigeria',
    aliases: ['gotv', 'gotv nigeria'],
    domain: 'gotvafrica.com',
    category: 'TV / Streaming',
  },
  {
    id: 'startimes',
    name: 'StarTimes Nigeria',
    aliases: ['startimes', 'startimes nigeria'],
    domain: 'startimes.com.ng',
    category: 'TV / Streaming',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    aliases: ['netflix', 'netflix streaming'],
    domain: 'netflix.com',
    category: 'TV / Streaming',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    aliases: ['spotify', 'spotify music'],
    domain: 'spotify.com',
    category: 'TV / Streaming',
  },

  // --- SOFTWARE & CLOUD ---
  {
    id: 'aws',
    name: 'Amazon Web Services (AWS)',
    aliases: ['aws', 'amazon web services', 'amazon cloud', 'aws billing'],
    domain: 'aws.amazon.com',
    category: 'Software / Digital Services',
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    aliases: ['gcp', 'google cloud', 'google cloud platform', 'gsuite', 'google workspace'],
    domain: 'cloud.google.com',
    category: 'Software / Digital Services',
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    aliases: ['openai', 'chatgpt', 'gpt', 'chat gpt'],
    domain: 'openai.com',
    category: 'Software / Digital Services',
  },
  {
    id: 'github',
    name: 'GitHub',
    aliases: ['github', 'github copilot', 'github inc'],
    domain: 'github.com',
    category: 'Software / Digital Services',
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365',
    aliases: ['microsoft', 'microsoft 365', 'office 365', 'm365', 'azure'],
    domain: 'microsoft.com',
    category: 'Software / Digital Services',
  },
  {
    id: 'adobe',
    name: 'Adobe Creative Cloud',
    aliases: ['adobe', 'adobe creative cloud', 'photoshop'],
    domain: 'adobe.com',
    category: 'Software / Digital Services',
  },
];

function extractHostname(urlStr: string): string | null {
  try {
    let formatted = urlStr.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    const parsed = new URL(formatted);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname || null;
  } catch {
    return null;
  }
}

/**
 * Resolves brand domain for a provider name or URL.
 */
export function resolveProviderDomain(providerName: string, officialUrl?: string | null): string {
  // 1. Try URL domain extraction first if provided
  if (officialUrl) {
    const extracted = extractHostname(officialUrl);
    if (extracted) return extracted;
  }

  const norm = (providerName || '').toLowerCase().trim();
  if (!norm) return 'example.com';

  // 2. Check provider registry exact name or alias match
  for (const item of PROVIDER_REGISTRY) {
    if (item.name.toLowerCase() === norm || item.aliases.some((alias) => norm.includes(alias) || alias.includes(norm))) {
      return item.domain;
    }
  }

  // 3. Check if name looks like a domain
  if (norm.includes('.') && !norm.includes(' ')) {
    return norm;
  }

  // 4. Default slug fallback
  const slug = norm.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : 'example.com';
}

/**
 * Returns clean uppercase initials (1-3 letters max) for fallback monograms.
 */
export function getProviderInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '??';

  // Remove common prefix noise like (IKEDC) if present at end or start
  const cleanName = trimmed.replace(/\(.*?\)/g, '').trim() || trimmed;
  const words = cleanName.split(/[\s\-_]+/).filter(Boolean);

  if (words.length >= 2) {
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  const clean = cleanName.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean.toUpperCase() || trimmed.slice(0, 2).toUpperCase();
}
