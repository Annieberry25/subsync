'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

interface ServiceIconProps {
  name: string;
  category?: string;
  className?: string;
  providerUrl?: string | null;
}

// Comprehensive dictionary mapping subscription service names to their primary domain names
const BRAND_DOMAIN_MAP: Record<string, string> = {
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  github: 'github.com',
  youtube: 'youtube.com',
  yt: 'youtube.com',
  chatgpt: 'openai.com',
  openai: 'openai.com',
  gpt: 'openai.com',
  figma: 'figma.com',
  adobe: 'adobe.com',
  photoshop: 'adobe.com',
  'creative cloud': 'adobe.com',
  icloud: 'apple.com',
  apple: 'apple.com',
  'apple music': 'music.apple.com',
  'apple tv': 'tv.apple.com',
  disney: 'disneyplus.com',
  'disney+': 'disneyplus.com',
  hbo: 'max.com',
  max: 'max.com',
  amazon: 'amazon.com',
  aws: 'aws.amazon.com',
  'prime video': 'primevideo.com',
  prime: 'amazon.com',
  hulu: 'hulu.com',
  dropbox: 'dropbox.com',
  google: 'google.com',
  'google one': 'one.google.com',
  'google drive': 'drive.google.com',
  workspace: 'workspace.google.com',
  slack: 'slack.com',
  notion: 'notion.so',
  microsoft: 'microsoft.com',
  'office 365': 'microsoft.com',
  m365: 'microsoft.com',
  linkedin: 'linkedin.com',
  twitter: 'x.com',
  x: 'x.com',
  vercel: 'vercel.com',
  stripe: 'stripe.com',
  linear: 'linear.app',
  zoom: 'zoom.us',
  canva: 'canva.com',
  duolingo: 'duolingo.com',
  grammarly: 'grammarly.com',
  coursera: 'coursera.org',
  udemy: 'udemy.com',
  playstation: 'playstation.com',
  xbox: 'xbox.com',
  nintendo: 'nintendo.com',
  steam: 'steampowered.com',
  nordvpn: 'nordvpn.com',
  expressvpn: 'expressvpn.com',
  '1password': '1password.com',
  bitwarden: 'bitwarden.com',
  hubspot: 'hubspot.com',
  salesforce: 'salesforce.com',
  jira: 'atlassian.com',
  confluence: 'atlassian.com',
  atlassian: 'atlassian.com',
  trello: 'trello.com',
  asana: 'asana.com',
  loom: 'loom.com',
  miro: 'miro.com',
};

function extractDomainFromUrl(urlStr: string): string | null {
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

function resolveBrandDomain(name: string, providerUrl?: string | null): string {
  // 1. Try extracting domain from providerUrl if provided
  if (providerUrl) {
    const extracted = extractDomainFromUrl(providerUrl);
    if (extracted) return extracted;
  }

  const norm = name.toLowerCase().trim();

  // 2. Exact or substring match in BRAND_DOMAIN_MAP
  if (BRAND_DOMAIN_MAP[norm]) {
    return BRAND_DOMAIN_MAP[norm];
  }

  for (const [key, domain] of Object.entries(BRAND_DOMAIN_MAP)) {
    if (norm.includes(key)) {
      return domain;
    }
  }

  // 3. If name itself looks like a domain (e.g. app.slack.com or example.io)
  if (norm.includes('.') && !norm.includes(' ')) {
    return norm;
  }

  // 4. Default slug fallback to name.com
  const slug = norm.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : 'example.com';
}

function getProviderInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';

  const words = trimmed.split(/[\s\-_]+/).filter(Boolean);

  if (words.length >= 2) {
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  const clean = trimmed.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean.toUpperCase() || trimmed.slice(0, 2).toUpperCase();
}

function getAccentTextClass(norm: string): string {
  if (norm.includes('netflix')) return 'text-[#EF4444]';
  if (norm.includes('spotify')) return 'text-[#1DB954]';
  if (norm.includes('youtube') || norm.includes('yt')) return 'text-[#EF4444]';
  if (norm.includes('chatgpt') || norm.includes('openai') || norm.includes('gpt')) return 'text-[#14B8A6]';
  return '';
}

/* Defined at module scope on purpose: declaring this inside the render body
   creates a new component type on every render, which React treats as a
   different component (remounting the subtree each pass). */
function Monogram({
  className,
  initials,
  norm,
}: {
  className: string;
  initials: string;
  norm: string;
}) {
  return (
    <div
      className={`${className} rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] flex items-center justify-center shrink-0`}
    >
      <span className={`font-bold text-xs ${getAccentTextClass(norm)}`}>{initials}</span>
    </div>
  );
}

export function ServiceIcon({
  name,
  className = 'w-10 h-10',
  providerUrl,
}: ServiceIconProps) {
  const norm = name.toLowerCase().trim();

  const domain = resolveBrandDomain(name, providerUrl);
  const initials = getProviderInitials(name);

  /* Logo sources in preference order.
     This used to be gated entirely behind `NEXT_PUBLIC_LOGO_DEV_TOKEN`, and the
     no-token branch rendered initials unconditionally. That meant an
     unconfigured deployment showed generated letters for *every* provider
     rather than a real logo, which is indistinguishable from a bug to the user.
     The no-key sources below keep logos working with no configuration at all. */
  const sources = useMemo(() => {
    const list: string[] = [];
    const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
    if (token) {
      list.push(`https://img.logo.dev/${domain}?token=${token}&size=128&fallback=monogram`);
    }
    list.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    list.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    return list;
  }, [domain]);

  // Advance through the sources as each one fails, and reset when the resolved
  // logo domain changes, using the documented "adjust state during render"
  // pattern (no effect).
  const [srcIndex, setSrcIndex] = useState(0);
  const [prevDomain, setPrevDomain] = useState(domain);
  if (prevDomain !== domain) {
    setPrevDomain(domain);
    setSrcIndex(0);
  }

  /* An image is shown while there is still an untried source. The comparison
     must be against sources.length (not length - 1), otherwise the final
     source is skipped and the monogram appears even though it was never
     attempted. */
  const exhausted = srcIndex >= sources.length;

  if (norm === 'subhalt') {
    // SubHalt is our own brand, not a third-party logo, so there is no domain
    // to resolve and no logo.dev entry. This used to return null, which
    // removed the element entirely: any caller rendering <ServiceIcon> as a
    // direct flex child lost an alignment box and the row collapsed on narrow
    // screens. Render the brand mark in a box of the requested size instead.
    return (
      <div
        className={`${className} rounded-xl bg-[#000000] border border-[#14B8A6]/30 flex items-center justify-center shrink-0`}
        role="img"
        aria-label="SubHalt"
      >
        <span className="flex items-center gap-[18%] h-[54%]" aria-hidden="true">
          <span className="w-[22%] h-full rounded-full bg-[#14B8A6]" />
          <span className="w-[22%] h-full rounded-full bg-[#14B8A6]" />
        </span>
      </div>
    );
  }

  // Every source has failed, so the monogram is the honest last resort.
  if (exhausted || srcIndex >= sources.length) {
    return <Monogram className={className} initials={initials} norm={norm} />;
  }

  return (
    <div className={`${className} rounded-xl bg-[#000000] border border-[#1A1D1D] overflow-hidden flex items-center justify-center shrink-0 p-1`}>
      <Image
        src={sources[srcIndex]}
        alt={`${name} logo`}
        width={128}
        height={128}
        className="w-full h-full object-contain rounded-lg"
        onError={() => setSrcIndex((i) => i + 1)}
        loading="lazy"
        unoptimized
      />
    </div>
  );
}
