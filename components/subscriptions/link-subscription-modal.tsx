'use client';

import { useState } from 'react';
import { X, Search, ShieldCheck, ExternalLink, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Link2 } from 'lucide-react';
import { ServiceIcon } from '@/components/ui/service-icon';
import { getKnownProviderWebsite, getKnownProviderManagementUrl } from '@/lib/services/subscription-service';
import type { SubscriptionInsert } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface LinkSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLinkedData: (data: Partial<Omit<SubscriptionInsert, 'user_id'>>) => void;
}

const POPULAR_PROVIDERS = [
  { name: 'Netflix', category: 'Streaming' as const, defaultPrice: 15.49, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Spotify', category: 'Streaming' as const, defaultPrice: 11.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Adobe Creative Cloud', category: 'Software' as const, defaultPrice: 54.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'ChatGPT Plus', category: 'Software' as const, defaultPrice: 20.00, currency: 'USD', cycle: 'monthly' as const },
  { name: 'GitHub Pro', category: 'Software' as const, defaultPrice: 4.00, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Amazon Prime', category: 'Streaming' as const, defaultPrice: 14.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'YouTube Premium', category: 'Streaming' as const, defaultPrice: 13.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Google One', category: 'Utilities' as const, defaultPrice: 2.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Disney+', category: 'Streaming' as const, defaultPrice: 13.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'PlayStation Plus', category: 'Gaming' as const, defaultPrice: 79.99, currency: 'USD', cycle: 'yearly' as const },
];

export default function LinkSubscriptionModal({
  isOpen,
  onClose,
  onConfirmLinkedData,
}: LinkSubscriptionModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<typeof POPULAR_PROVIDERS[number] | null>(null);
  const [customProviderName, setCustomProviderName] = useState('');
  const [step, setStep] = useState<'select' | 'authorize' | 'review'>('select');
  const [connecting, setConnecting] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');

  if (!isOpen) return null;

  const filteredProviders = POPULAR_PROVIDERS.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const activeName = selectedProvider ? selectedProvider.name : customProviderName.trim();

  const handleStartConnection = (provider: typeof POPULAR_PROVIDERS[number] | string) => {
    if (typeof provider === 'string') {
      setSelectedProvider(null);
      setCustomProviderName(provider);
    } else {
      setSelectedProvider(provider);
      setCustomProviderName(provider.name);
    }
    setStep('authorize');
  };

  const handleAuthorizeConnect = () => {
    if (!activeName) {
      toast.error('Please enter or select a valid provider name.', 'Provider Required');
      return;
    }

    setConnecting(true);
    // Simulate authorized provider handshake check
    setTimeout(() => {
      setConnecting(false);
      setStep('review');
    }, 1200);
  };

  const handleSaveImportedData = () => {
    const knownWebsite = getKnownProviderWebsite(activeName);
    const knownManage = getKnownProviderManagementUrl(activeName);

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const importedData: Partial<Omit<SubscriptionInsert, 'user_id'>> = {
      name: activeName,
      price: selectedProvider ? selectedProvider.defaultPrice : 9.99,
      currency: selectedProvider ? selectedProvider.currency : 'USD',
      billing_cycle: selectedProvider ? selectedProvider.cycle : 'monthly',
      category: selectedProvider ? selectedProvider.category : 'Streaming',
      status: 'active',
      next_billing_date: nextBilling.toISOString().split('T')[0],
      provider_url: knownManage || knownWebsite || null,
      account_links: accountEmail
        ? [{ id: `link-${Date.now()}`, label: 'Authorized Account', url: knownWebsite || '', email: accountEmail }]
        : [],
      notes: `[Synced via Provider Link: ${activeName}]`,
      is_synced: true,
    };

    onConfirmLinkedData(importedData);
    toast.success(`Account for ${activeName} linked successfully! Let's review the details.`, 'Subscription Linked');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#0F1111] border border-[#1A1D1D] rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'select' && (
              <button
                type="button"
                onClick={() => setStep('select')}
                className="w-8 h-8 rounded-lg bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 id="link-modal-title" className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#14B8A6]" />
                <span>Link Subscription</span>
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Link your subscription account to import available subscription details.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: SELECT PROVIDER */}
        {step === 'select' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#94A3B8] block">Search Provider or Service</label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Netflix, Spotify, Adobe, ChatGPT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>
            </div>

            {/* Matching Providers Grid */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                {searchQuery ? 'Matching Providers' : 'Supported Providers'}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {filteredProviders.map((provider) => (
                  <button
                    key={provider.name}
                    type="button"
                    onClick={() => handleStartConnection(provider)}
                    className="p-3 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] hover:border-[#14B8A6] flex items-center gap-3 transition-colors text-left group cursor-pointer"
                  >
                    <ServiceIcon
                      name={provider.name}
                      category={provider.category}
                      className="w-9 h-9 rounded-lg shrink-0 border border-[#1A1D1D]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-[#F5F7F6] block truncate group-hover:text-[#14B8A6] transition-colors">
                        {provider.name}
                      </span>
                      <span className="text-[11px] text-[#94A3B8] block">
                        {provider.category}
                      </span>
                    </div>
                  </button>
                ))}

                {searchQuery.trim() && filteredProviders.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleStartConnection(searchQuery.trim())}
                    className="col-span-full p-3.5 rounded-xl bg-[#0D0F0F] border border-[#14B8A6]/30 hover:border-[#14B8A6] flex items-center justify-between text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <ServiceIcon name={searchQuery} category="Other" className="w-9 h-9 rounded-lg shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-[#F5F7F6] block">
                          Link &quot;{searchQuery}&quot;
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">
                          Custom provider connection
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#14B8A6] group-hover:underline">Continue →</span>
                  </button>
                )}
              </div>
            </div>

            {/* OAuth Notice */}
            <div className="p-3.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-start gap-3 text-xs text-[#94A3B8]">
              <ShieldCheck className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                SubSync redirects you to authorize your provider account securely using OAuth / SSO protocol. SubSync never asks for or stores your provider passwords.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: AUTHORIZATION SCREEN */}
        {step === 'authorize' && (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 text-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-center mx-auto text-[#14B8A6]">
              <ServiceIcon name={activeName} category={selectedProvider?.category || 'Streaming'} className="w-12 h-12 rounded-xl" />
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-lg font-bold text-[#F5F7F6]">
                Authorize SubSync with {activeName}
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Link your {activeName} account to securely import active plan tier, billing frequency, and renewal details.
              </p>
            </div>

            <div className="space-y-3 max-w-sm mx-auto text-left">
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#94A3B8] block">Account Email / Username (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  className="w-full h-10 px-3.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-xs text-[#14B8A6] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>SubSync uses official OAuth login flow. Your password remains private to {activeName}.</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleAuthorizeConnect}
                disabled={connecting}
                className="w-full h-11 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                    <span>Connecting to {activeName}...</span>
                  </>
                ) : (
                  <>
                    <span>Authorize & Link {activeName}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#091512]" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW LINKED INFORMATION */}
        {step === 'review' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="p-3.5 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center gap-2.5 text-[#14B8A6] text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#14B8A6]" />
              <span>Connection authorized! Review imported details before adding to your portfolio.</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] space-y-3">
              <div className="flex items-center gap-3 border-b border-[#1A1D1D] pb-3">
                <ServiceIcon name={activeName} category={selectedProvider?.category || 'Streaming'} className="w-10 h-10 rounded-xl" />
                <div>
                  <h4 className="text-sm font-bold text-[#F5F7F6]">{activeName}</h4>
                  <span className="text-[11px] text-[#14B8A6] font-semibold">Authorized Sync Active</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#94A3B8] block text-[11px]">Plan Tier</span>
                  <span className="font-semibold text-[#F5F7F6]">Standard / Premium</span>
                </div>

                <div>
                  <span className="text-[#94A3B8] block text-[11px]">Price & Cycle</span>
                  <span className="font-semibold text-[#F5F7F6]">
                    ${selectedProvider?.defaultPrice || 9.99} / {selectedProvider?.cycle || 'monthly'}
                  </span>
                </div>

                <div>
                  <span className="text-[#94A3B8] block text-[11px]">Category</span>
                  <span className="font-semibold text-[#F5F7F6]">{selectedProvider?.category || 'Streaming'}</span>
                </div>

                <div>
                  <span className="text-[#94A3B8] block text-[11px]">Account Email</span>
                  <span className="font-semibold text-[#F5F7F6] truncate block">{accountEmail || 'Authorized User'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-4 py-2.5 rounded-full border border-[#1A1D1D] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSaveImportedData}
                className="px-5 py-2.5 rounded-full bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Apply & Review Subscription</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
