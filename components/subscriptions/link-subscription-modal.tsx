'use client';

import { useState } from 'react';
import { X, Search, ShieldCheck, ExternalLink, ArrowLeft, Link2, CheckCircle2 } from 'lucide-react';
import { ServiceIcon } from '@/components/ui/service-icon';
import { getKnownProviderWebsite, getKnownProviderManagementUrl } from '@/lib/services/subscription-service';
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface LinkSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReceiptFlow?: (providerName: string) => void;
  onConfirmLinkedData?: (data: Partial<Omit<SubscriptionInsert, 'user_id'>>) => void;
  onSelectExistingDetails?: (subscription: SubscriptionRow) => void;
  existingSubscriptions?: SubscriptionRow[];
}

const POPULAR_PROVIDERS = [
  { name: 'Google One', category: 'Utilities' as const, defaultPrice: 2.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Spotify', category: 'Streaming' as const, defaultPrice: 11.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Netflix', category: 'Streaming' as const, defaultPrice: 15.49, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Apple', category: 'Utilities' as const, defaultPrice: 10.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Adobe Creative Cloud', category: 'Software' as const, defaultPrice: 54.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'ChatGPT Plus', category: 'Software' as const, defaultPrice: 20.00, currency: 'USD', cycle: 'monthly' as const },
  { name: 'GitHub Pro', category: 'Software' as const, defaultPrice: 4.00, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Amazon Prime', category: 'Streaming' as const, defaultPrice: 14.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'YouTube Premium', category: 'Streaming' as const, defaultPrice: 13.99, currency: 'USD', cycle: 'monthly' as const },
  { name: 'Disney+', category: 'Streaming' as const, defaultPrice: 13.99, currency: 'USD', cycle: 'yearly' as const },
  { name: 'PlayStation Plus', category: 'Gaming' as const, defaultPrice: 79.99, currency: 'USD', cycle: 'yearly' as const },
];

export default function LinkSubscriptionModal({
  isOpen,
  onClose,
  onSelectReceiptFlow,
  onConfirmLinkedData,
  onSelectExistingDetails,
  existingSubscriptions,
}: LinkSubscriptionModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<typeof POPULAR_PROVIDERS[number] | null>(null);
  const [customProviderName, setCustomProviderName] = useState('');
  const [step, setStep] = useState<'select' | 'manage' | 'confirm_subscribed' | 'no_existing'>('select');

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
    setStep('manage');
  };

  const handleOpenProviderPage = () => {
    if (!activeName) {
      toast.error('Please select a valid provider.', 'Provider Required');
      return;
    }

    const managementUrl = getKnownProviderManagementUrl(activeName);
    const websiteUrl = getKnownProviderWebsite(activeName);
    const targetUrl = managementUrl || websiteUrl || `https://www.google.com/search?q=${encodeURIComponent(activeName + ' subscription management')}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Opened ${activeName} subscription management page in a new tab.`, 'Page Opened');
    
    // Transition to confirmation state AFTER opening provider page
    setStep('confirm_subscribed');
  };

  const handleTrackPortfolio = () => {
    if (!activeName) return;

    const matchingSub = existingSubscriptions?.find(
      (sub) =>
        sub.name.toLowerCase().trim().includes(activeName.toLowerCase().trim()) ||
        activeName.toLowerCase().trim().includes(sub.name.toLowerCase().trim())
    );

    if (matchingSub && onSelectExistingDetails) {
      onSelectExistingDetails(matchingSub);
      onClose();
    } else {
      setStep('no_existing');
    }
  };

  const handleYesSubscribed = () => {
    if (onSelectReceiptFlow && activeName) {
      onSelectReceiptFlow(activeName);
    } else if (onConfirmLinkedData && activeName) {
      handleTrackPortfolio();
    }
  };

  const handleNotYet = () => {
    setStep('manage');
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
        {/* Header (Exact Match to User Screenshot) */}
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
                <Link2 className="w-5 h-5 text-[#94A3B8]" />
                <span>Manage External Subscription</span>
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Access official provider pages to manage your subscriptions directly.
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
                  placeholder="Search Google One, Spotify, Netflix, Apple..."
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
                    className="p-3 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] flex items-center gap-3 transition-colors text-left group cursor-pointer"
                  >
                    <ServiceIcon
                      name={provider.name}
                      category={provider.category}
                      className="w-9 h-9 rounded-lg shrink-0 border border-[#1A1D1D]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-[#F5F7F6] block truncate group-hover:text-[#F5F7F6] transition-colors">
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
                    className="col-span-full p-3.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] hover:bg-[#1A1D1D] flex items-center justify-between text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <ServiceIcon name={searchQuery} category="Other" className="w-9 h-9 rounded-lg shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-[#F5F7F6] block">
                          Manage &quot;{searchQuery}&quot;
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">
                          Custom provider page
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#F5F7F6] group-hover:underline">Continue →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Supporting Explanatory Text */}
            <div className="py-2.5 text-xs text-[#94A3B8] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                SubHalt opens official subscription management pages directly in a new browser tab. SubHalt never asks for or stores your provider credentials.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: PROVIDER DIRECT MANAGEMENT SCREEN (Exact Match to User Screenshot) */}
        {step === 'manage' && (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 text-center py-4">
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-lg font-bold text-[#F5F7F6]">
                Manage {activeName} Subscription
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Open the official {activeName} account page in a new browser tab to view, update, or cancel your subscription settings directly with {activeName}.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleOpenProviderPage}
                className="w-full h-11 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Open {activeName}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#091512]" />
              </button>

              <button
                type="button"
                onClick={handleTrackPortfolio}
                className="w-full h-10 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
              >
                Track {activeName} in SubHalt Portfolio
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMATION STATE (Triggered AFTER user clicks Open Provider) */}
        {step === 'confirm_subscribed' && (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 text-center py-4">
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-lg font-bold text-[#F5F7F6]">
                Did you just subscribe?
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                If you just created this subscription, let&apos;s add it to SubHalt.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5 max-w-sm mx-auto">
              <button
                type="button"
                onClick={handleYesSubscribed}
                className="w-full h-11 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#091512]" />
                <span>Yes, I subscribed</span>
              </button>

              <button
                type="button"
                onClick={handleNotYet}
                className="w-full h-10 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
              >
                <span>Not yet</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: NO EXISTING ACTIVE SUBSCRIPTION FOUND */}
        {step === 'no_existing' && (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 text-center py-4">
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-lg font-bold text-[#F5F7F6]">
                No Active {activeName} Subscription
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Your subscription will appear here once you have an active {activeName} subscription.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  if (onSelectReceiptFlow && activeName) {
                    onSelectReceiptFlow(activeName);
                  }
                }}
                className="w-full h-11 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Import {activeName} Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('select')}
                className="w-full h-10 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
              >
                Back to Provider List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
