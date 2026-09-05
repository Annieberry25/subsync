import type { VerifiedProvider } from '@/lib/types/bills.types';
import { PROVIDER_CATALOG, getCatalogProviders, searchProviderCatalog } from './provider-catalog';

export const VERIFIED_PROVIDERS: VerifiedProvider[] = PROVIDER_CATALOG;

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
export function searchVerifiedProviders(query: string, category?: string, country?: string): VerifiedProvider[] {
  const normQuery = (query || '').toLowerCase().trim();
  let list = country ? getCatalogProviders(country, category) : VERIFIED_PROVIDERS;

  if (category && category !== 'All' && category !== 'Other' && !country) {
    list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  if (!normQuery) return list.slice(0, 15);

  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(normQuery) ||
      p.category.toLowerCase().includes(normQuery) ||
      (p.region && p.region.toLowerCase().includes(normQuery))
  );
}
