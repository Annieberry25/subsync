'use client';

import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { resolveProviderDomain } from '@/lib/constants/provider-registry';
import { getCatalogProviderByName } from '@/lib/constants/provider-catalog';

interface ProviderLogoProps {
  name: string;
  officialUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const DEFAULT_LOGO_DEV_TOKEN = 'pk_DjjLxkpaTgWW8UuIFUX1lQ';

/**
 * Reusable Provider Identity / Logo Component for Bills & Payments.
 * - Sits in a sleek, neutral dark container (`bg-[#121615] border border-[#202B27]`)
 * - Resolves company logo automatically via domain mapping or provider catalog
 * - Silently falls back to a clean neutral provider icon on image error or missing logo
 * - Never shows broken images, empty containers, or ugly initials when icon is appropriate
 */
export default function ProviderLogo({
  name,
  officialUrl,
  className = '',
  size = 'md',
}: ProviderLogoProps) {
  const [hasError, setHasError] = useState(false);

  const catalogEntry = getCatalogProviderByName(name);
  const domain = catalogEntry?.domain || resolveProviderDomain(name, officialUrl);

  // Reset error state if provider name or URL changes
  useEffect(() => {
    setHasError(false);
  }, [name, officialUrl]);

  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || DEFAULT_LOGO_DEV_TOKEN;
  const logoUrl = catalogEntry?.logoUrl || `https://img.logo.dev/${domain}?token=${token}&size=128&fallback=monogram`;

  // Size sizing classes
  const sizeClasses =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg text-[10px]'
      : size === 'lg'
      ? 'w-11 h-11 rounded-2xl text-xs'
      : 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs';

  const iconSizeClasses =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4.5 h-4.5';

  const containerClasses = `${sizeClasses} bg-[#121615] border border-[#202B27] flex items-center justify-center shrink-0 overflow-hidden relative transition-colors ${className}`;

  if (hasError || !name.trim()) {
    return (
      <div className={containerClasses} title={name}>
        <Building2 className={`${iconSizeClasses} text-[#94A3B8]`} />
      </div>
    );
  }

  return (
    <div className={containerClasses} title={name}>
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="w-full h-full object-contain p-1 rounded-lg"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
