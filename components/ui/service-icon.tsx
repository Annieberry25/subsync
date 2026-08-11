'use client';

import { useState, useEffect } from 'react';

interface ServiceIconProps {
  name: string;
  category?: string;
  className?: string;
  providerUrl?: string | null;
}

const DEFAULT_LOGO_DEV_TOKEN = 'pk_DjjLxkpaTgWW8UuIFUX1lQ';

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

export function ServiceIcon({
  name,
  className = 'w-10 h-10',
  providerUrl,
}: ServiceIconProps) {
  const [hasError, setHasError] = useState(false);

  const domain = resolveBrandDomain(name, providerUrl);
  
  // Reset hasError if domain/name changes
  useEffect(() => {
    setHasError(false);
  }, [name, providerUrl]);

  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || DEFAULT_LOGO_DEV_TOKEN;
  const logoUrl = `https://img.logo.dev/${domain}?token=${token}&size=128&fallback=monogram`;

  const norm = name.toLowerCase().trim();
  const initials = getProviderInitials(name);

  // If Logo.dev fails to load image, render SubSync styled initial fallback
  if (hasError) {
    let accentTextClass = 'text-[#F5F7F6]';
    if (norm.includes('netflix')) accentTextClass = 'text-[#EF4444]';
    else if (norm.includes('spotify')) accentTextClass = 'text-[#1DB954]';
    else if (norm.includes('youtube') || norm.includes('yt')) accentTextClass = 'text-[#EF4444]';
    else if (norm.includes('chatgpt') || norm.includes('openai') || norm.includes('gpt')) accentTextClass = 'text-[#14B8A6]';

    return (
      <div className={`${className} rounded-xl bg-[#000000] border border-[#1A1D1D] text-[#F5F7F6] flex items-center justify-center shrink-0`}>
        <span className={`font-bold text-xs ${accentTextClass}`}>{initials}</span>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-xl bg-[#000000] border border-[#1A1D1D] overflow-hidden flex items-center justify-center shrink-0 p-1`}>
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="w-full h-full object-contain rounded-lg"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
