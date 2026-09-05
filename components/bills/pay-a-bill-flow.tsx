'use client';

import { useState, useMemo } from 'react';
import {
  Send,
  Plus,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { SUPPORTED_COUNTRIES, getCountryCategories } from '@/lib/constants/country-architecture';
import { getCatalogProviders } from '@/lib/constants/provider-catalog';
import type { VerifiedProvider } from '@/lib/types/bills.types';
import ProviderLogo from './provider-logo';

interface PayABillFlowProps {
  onOpenScanReceipt: () => void;
  onOpenManualAdd: (prefill?: { providerName: string; category: string; country: string; amount?: number; currency?: string; officialUrl?: string }) => void;
}

export default function PayABillFlow({
  onOpenScanReceipt,
  onOpenManualAdd,
}: PayABillFlowProps) {
  // Primary Entry Action state: null (initial state), 'pay', or 'add'
  const [activeAction, setActiveAction] = useState<'pay' | 'add' | null>(null);

  // Pay a Bill flow state
  const [selectedCountry, setSelectedCountry] = useState<string>('Nigeria');
  const [selectedCategory, setSelectedCategory] = useState<string>('Electricity');
  const [selectedProvider, setSelectedProvider] = useState<VerifiedProvider | null>(null);

  // Form fields for Step 4
  const [accountReference, setAccountReference] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [showRedirectNotice, setShowRedirectNotice] = useState(false);

  // Available categories based on country
  const categories = useMemo(() => {
    return getCountryCategories(selectedCountry);
  }, [selectedCountry]);

  // Available providers based on country and category (excluding pure subscription services)
  const providers = useMemo(() => {
    return getCatalogProviders(selectedCountry, selectedCategory || undefined, false);
  }, [selectedCountry, selectedCategory]);

  const handleCountryChange = (cName: string) => {
    setSelectedCountry(cName);
    setSelectedProvider(null);
    const countryConfig = SUPPORTED_COUNTRIES.find((c) => c.name === cName);
    if (countryConfig) {
      setCurrency(countryConfig.currency);
      // Reset default category for country
      const firstCategory = countryConfig.categories[0] || 'Electricity';
      setSelectedCategory(firstCategory);
    }
  };

  const handleCategoryChange = (catName: string) => {
    setSelectedCategory(catName);
    setSelectedProvider(null);
  };

  const handleProviderSelect = (provider: VerifiedProvider) => {
    setSelectedProvider(provider);
    if (provider.officialPaymentUrl) {
      const countryConfig = SUPPORTED_COUNTRIES.find((c) => c.name === provider.country);
      if (countryConfig) setCurrency(countryConfig.currency);
    }
  };

  const handleContinueToPayment = () => {
    if (!selectedProvider) return;
    const url = selectedProvider.officialPaymentUrl || selectedProvider.officialWebsite || 'https://google.com';
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Open official payment page in new tab
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
    setShowRedirectNotice(true);
  };

  const toggleAction = (action: 'pay' | 'add') => {
    if (activeAction === action) {
      setActiveAction(null);
    } else {
      setActiveAction(action);
    }
  };

  const activeCountryConfig = SUPPORTED_COUNTRIES.find((c) => c.name === selectedCountry) || SUPPORTED_COUNTRIES[0];

  return (
    <div className="space-y-4">
      {/* 1. COMPACT ACTION PILL CONTROLS (RESTORED PILL / BUTTON STYLE) */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => toggleAction('pay')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 min-h-[42px] ${
            activeAction === 'pay'
              ? 'bg-[#14B8A6] text-[#051310] shadow-sm'
              : 'bg-[#090C0B] border border-[#161F1D] text-[#94A3B8] hover:text-[#F5F7F6] hover:border-[#222B28]'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Pay a Bill</span>
        </button>

        <button
          type="button"
          onClick={() => toggleAction('add')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 min-h-[42px] ${
            activeAction === 'add'
              ? 'bg-[#14B8A6] text-[#051310] shadow-sm'
              : 'bg-[#090C0B] border border-[#161F1D] text-[#94A3B8] hover:text-[#F5F7F6] hover:border-[#222B28]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add Payment</span>
        </button>
      </div>

      {/* 2. EXPANDED FLOW 1: PAY A BILL */}
      {activeAction === 'pay' && (
        <div className="space-y-5 bg-[#090C0B] border border-[#161F1D] rounded-2xl p-4 sm:p-6 shadow-sm animate-in fade-in duration-150">
          
          {/* STEP 1: CLEAN MODERN COUNTRY DROPDOWN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">
              Country
            </label>
            <div className="relative max-w-sm">
              <select
                value={selectedCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#060908] border border-[#161F1D] hover:border-[#222B28] focus:border-[#14B8A6] rounded-xl text-xs sm:text-sm font-semibold text-[#F5F7F6] focus:outline-none appearance-none transition-colors cursor-pointer min-h-[44px]"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name} className="bg-[#090C0B] text-[#F5F7F6]">
                    {c.flag} {c.name} — {c.currency}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* STEP 2: COMPACT CATEGORY PILLS */}
          <div className="space-y-2 pt-1 border-t border-[#161F1D]">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">
              Category
            </label>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#14B8A6] text-[#051310] border-[#14B8A6] font-semibold shadow-sm'
                        : 'bg-[#060908] border-[#161F1D] text-[#94A3B8] hover:text-[#F5F7F6] hover:border-[#222B28]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: PROVIDER LIST (STRICTLY RELEVANT BILL PROVIDERS ONLY) */}
          <div className="space-y-2 pt-1 border-t border-[#161F1D]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">
                Select Provider ({providers.length})
              </label>
              <button
                type="button"
                onClick={() => onOpenManualAdd({ providerName: '', category: selectedCategory || 'Utilities', country: selectedCountry })}
                className="text-xs text-[#14B8A6] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Can&apos;t find provider? Add manually</span>
              </button>
            </div>

            {providers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {providers.map((provider) => {
                  const isSelected = selectedProvider?.name === provider.name;
                  return (
                    <div
                      key={provider.id || provider.name}
                      onClick={() => handleProviderSelect(provider)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 min-h-[58px] ${
                        isSelected
                          ? 'bg-[#14B8A6]/10 border-[#14B8A6]'
                          : 'bg-[#060908] border-[#161F1D] hover:border-[#222B28] hover:bg-[#0C100E]'
                      }`}
                    >
                      <ProviderLogo
                        name={provider.name}
                        officialUrl={provider.officialPaymentUrl}
                        size="sm"
                      />

                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-[#F5F7F6] block truncate">
                          {provider.name}
                        </span>
                        <span className="text-[11px] text-[#94A3B8] block truncate mt-0.5">
                          {provider.description || provider.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[#060908] border border-[#161F1D] text-center text-[#94A3B8] space-y-2">
                <p className="text-xs font-medium">No verified bill providers found for {selectedCategory} in {selectedCountry}.</p>
                <button
                  type="button"
                  onClick={() => onOpenManualAdd({ providerName: '', category: selectedCategory || 'Utilities', country: selectedCountry })}
                  className="text-xs text-[#14B8A6] hover:underline font-semibold"
                >
                  + Add payment manually instead
                </button>
              </div>
            )}
          </div>

          {/* STEP 4: SERVICE / PAYMENT CONFIG & CONTINUE TO PAYMENT */}
          {selectedProvider && (
            <div className="p-4 rounded-xl bg-[#060908] border border-[#161F1D] space-y-3 pt-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[#161F1D] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <ProviderLogo
                    name={selectedProvider.name}
                    officialUrl={selectedProvider.officialPaymentUrl}
                    size="sm"
                  />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#F5F7F6]">{selectedProvider.name}</h4>
                    <span className="text-[11px] text-[#94A3B8]">{selectedProvider.category} · {selectedCountry}</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-[10px] font-semibold uppercase tracking-wider">
                  Official Portal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                    Account / Meter / Phone No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountReference}
                    onChange={(e) => setAccountReference(e.target.value)}
                    placeholder="e.g. 0419203810"
                    className="w-full px-3 py-2 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                    Payment Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6]"
                    />
                    <span className="px-2.5 py-2 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs font-bold text-[#F5F7F6]">
                      {currency}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  SubHalt will redirect you to {selectedProvider.name}&apos;s payment website.
                </p>

                <button
                  type="button"
                  onClick={handleContinueToPayment}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] active:bg-[#0B7A70] text-[#051310] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[40px] shrink-0"
                >
                  <span>Continue to {selectedProvider.name}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* POST REDIRECTION PROMPT DIALOG */}
          {showRedirectNotice && selectedProvider && (
            <div className="p-3.5 rounded-xl bg-[#0E1513] border border-[#14B8A6]/30 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-[#14B8A6]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <h4 className="text-xs font-bold text-[#F5F7F6]">
                  Redirected to {selectedProvider.name}
                </h4>
              </div>

              <p className="text-xs text-[#94A3B8] leading-relaxed">
                After completing your payment on the official portal, return here to save your transaction record into Payment History.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowRedirectNotice(false);
                    onOpenScanReceipt();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scan Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRedirectNotice(false);
                    onOpenManualAdd({
                      providerName: selectedProvider.name,
                      category: selectedProvider.category,
                      country: selectedCountry,
                      amount: amountInput ? parseFloat(amountInput) : undefined,
                      currency: currency,
                      officialUrl: selectedProvider.officialPaymentUrl || undefined,
                    });
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#090C0B] border border-[#161F1D] text-[#F5F7F6] text-xs font-semibold hover:border-[#14B8A6]/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Payment Manually</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. EXPANDED FLOW 2: ADD PAYMENT (COMPACT CHOICE PILLS FOR SCAN RECEIPT AND ADD MANUALLY) */}
      {activeAction === 'add' && (
        <div className="p-4 rounded-2xl bg-[#090C0B] border border-[#161F1D] space-y-3 shadow-sm animate-in fade-in duration-150">
          <span className="text-xs font-bold text-[#F5F7F6] block">
            Choose how to record your payment:
          </span>

          <div className="flex flex-wrap gap-2.5">
            {/* CHOICE A: SCAN RECEIPT PILL */}
            <button
              type="button"
              onClick={() => onOpenScanReceipt()}
              className="px-4 py-2.5 rounded-xl bg-[#121615] hover:bg-[#1A201E] border border-[#161F1D] hover:border-[#14B8A6]/40 text-xs font-semibold text-[#F5F7F6] transition-all cursor-pointer flex items-center gap-2 min-h-[42px]"
            >
              <Sparkles className="w-4 h-4 text-[#14B8A6]" />
              <span>Scan Receipt</span>
            </button>

            {/* CHOICE B: ADD MANUALLY PILL */}
            <button
              type="button"
              onClick={() => onOpenManualAdd()}
              className="px-4 py-2.5 rounded-xl bg-[#121615] hover:bg-[#1A201E] border border-[#161F1D] hover:border-[#14B8A6]/40 text-xs font-semibold text-[#F5F7F6] transition-all cursor-pointer flex items-center gap-2 min-h-[42px]"
            >
              <Plus className="w-4 h-4 text-[#14B8A6]" />
              <span>Add Manually</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
