'use client';

import { useState, useEffect } from 'react';
import { X, Check, ShieldCheck, Link as LinkIcon, Paperclip, AlertCircle, Building2, Globe, MapPin, Tag } from 'lucide-react';
import type { BillPayment, BillFrequency, StandardBillCategory } from '@/lib/types/bills.types';
import { STANDARD_BILL_CATEGORIES } from '@/lib/types/bills.types';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { searchVerifiedProviders, getVerifiedProvider } from '@/lib/constants/verified-providers';
import { useUserSettings } from '@/lib/contexts/user-settings-context';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (billData: Partial<BillPayment>) => Promise<void>;
  initialData?: BillPayment | null;
  defaultCategory?: string;
}

export default function BillModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultCategory,
}: BillModalProps) {
  const { defaultCurrency } = useUserSettings();

  const [category, setCategory] = useState<string>('Electricity');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(defaultCurrency || 'NGN');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [country, setCountry] = useState<string>('Nigeria');
  const [region, setRegion] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [paymentFrequency, setPaymentFrequency] = useState<BillFrequency | 'one_time'>('one_time');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [providerReference, setProviderReference] = useState<string>('');
  const [officialProviderUrl, setOfficialProviderUrl] = useState<string>('');
  const [status, setStatus] = useState<'paid' | 'pending' | 'overdue'>('paid');

  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Provider autosuggest dropdown
  const [providerSuggestions, setProviderSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCategory(initialData.category || 'Electricity');
      setCustomCategory(initialData.customCategory || '');
      setProviderName(initialData.providerName || '');
      setAmount(initialData.amount ? String(initialData.amount) : '');
      setCurrency(initialData.currency || defaultCurrency || 'NGN');
      setPaymentDate(initialData.paymentDate || new Date().toISOString().split('T')[0]);
      setCountry(initialData.country || 'Nigeria');
      setRegion(initialData.region || '');
      setCity(initialData.city || '');
      setPaymentFrequency(initialData.paymentFrequency || 'one_time');
      setIsRecurring(initialData.isRecurring || false);
      setNotes(initialData.notes || '');
      setProviderReference(initialData.providerReference || '');
      setOfficialProviderUrl(initialData.officialProviderUrl || '');
      setStatus(initialData.status || 'paid');
    } else {
      setCategory(defaultCategory || 'Electricity');
      setCustomCategory('');
      setProviderName('');
      setAmount('');
      setCurrency(defaultCurrency || 'NGN');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setCountry('Nigeria');
      setRegion('');
      setCity('');
      setPaymentFrequency('one_time');
      setIsRecurring(false);
      setNotes('');
      setProviderReference('');
      setOfficialProviderUrl('');
      setStatus('paid');
    }
    setErrorMsg('');
  }, [initialData, defaultCategory, defaultCurrency, isOpen]);

  // Check verified provider whenever providerName changes
  useEffect(() => {
    if (!providerName.trim()) {
      setIsVerified(false);
      setProviderSuggestions([]);
      return;
    }

    const verified = getVerifiedProvider(providerName);
    if (verified) {
      setIsVerified(true);
      if (verified.officialPaymentUrl && !initialData) {
        setOfficialProviderUrl(verified.officialPaymentUrl);
      }
      if (verified.category && (!category || category === 'Other') && !initialData) {
        setCategory(verified.category);
      }
    } else {
      setIsVerified(false);
    }

    const suggestions = searchVerifiedProviders(providerName, category);
    setProviderSuggestions(suggestions);
  }, [providerName, category, initialData]);

  if (!isOpen) return null;

  const handleSelectSuggestion = (sug: any) => {
    setProviderName(sug.name);
    setCategory(sug.category);
    if (sug.officialPaymentUrl) {
      setOfficialProviderUrl(sug.officialPaymentUrl);
    }
    if (sug.country) setCountry(sug.country);
    if (sug.region) setRegion(sug.region);
    setIsVerified(true);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!providerName.trim()) {
      setErrorMsg('Please enter a provider or merchant name.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (category === 'Other' && !customCategory.trim()) {
      setErrorMsg('Please enter your custom payment category name.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        category,
        customCategory: category === 'Other' ? customCategory.trim() : null,
        providerName: providerName.trim(),
        amount: numAmount,
        currency: currency.toUpperCase(),
        paymentDate,
        country: country.trim() || 'Nigeria',
        region: region.trim() || null,
        city: city.trim() || null,
        paymentFrequency: isRecurring ? (paymentFrequency as BillFrequency) : 'one_time',
        isRecurring,
        notes: notes.trim() || null,
        providerReference: providerReference.trim() || null,
        officialProviderUrl: officialProviderUrl.trim() || null,
        status,
        source: initialData ? initialData.source : 'manual',
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save payment record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1A1D1D] flex items-center justify-between bg-[#0F1111]">
          <div>
            <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#14B8A6]" />
              {initialData ? 'Edit Bill / Payment' : 'Record New Bill or Payment'}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Keep track of recurring utilities, one-off charges, or custom service payments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Provider Name */}
          <div className="relative">
            <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5 flex items-center justify-between">
              <span>Provider / Merchant Name *</span>
              {isVerified && (
                <span className="text-[11px] text-[#14B8A6] font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Provider
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={providerName}
                onChange={(e) => {
                  setProviderName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Ikeja Electric, Spectranet, MTN, Landlord Rent..."
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && providerSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[#121414] border border-[#1A1D1D] rounded-xl shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#64748B] bg-[#0B0D0D]">
                  Verified Provider Suggestions
                </div>
                {providerSuggestions.map((sug) => (
                  <button
                    key={sug.name}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full px-3 py-2 text-left hover:bg-[#1A1D1D] flex items-center justify-between transition-colors text-xs text-[#F5F7F6]"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span className="font-medium">{sug.name}</span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] px-2 py-0.5 rounded bg-[#1A1D1D]">
                      {sug.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
              >
                {STANDARD_BILL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Category Input if "Other" selected */}
            {category === 'Other' && (
              <div>
                <label className="block text-xs font-semibold text-[#14B8A6] mb-1.5">
                  Custom Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Water, Waste Collection, Security, Gym..."
                  className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#14B8A6]/60 rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>
            )}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                Amount *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25000.00"
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                Currency *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                Payment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          {/* Location Fields: Country, Region, City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-[#1A1D1D]/60">
            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Nigeria"
                className="w-full px-3.5 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
                Region / State
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Lagos, Abuja, Oyo..."
                className="w-full px-3.5 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                City / Area
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Ikeja, Lekki, Owerri..."
                className="w-full px-3.5 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
              />
            </div>
          </div>

          {/* Payment Frequency / Recurring toggle */}
          <div className="p-4 rounded-xl bg-[#000000] border border-[#1A1D1D] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#F5F7F6] block">Recurring Payment</span>
                <span className="text-[11px] text-[#94A3B8]">Is this a recurring bill (e.g. monthly internet, rent)?</span>
              </div>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded accent-[#14B8A6] cursor-pointer"
              />
            </div>

            {isRecurring && (
              <div className="pt-2 border-t border-[#1A1D1D]">
                <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                  Frequency
                </label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#0D0F0F] border border-[#1A1D1D] rounded-lg text-xs text-[#F5F7F6]"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="weekly">Weekly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="custom">Custom Cycle</option>
                </select>
              </div>
            )}
          </div>

          {/* Optional Reference & Official URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                Transaction / Bill Reference ID
              </label>
              <input
                type="text"
                value={providerReference}
                onChange={(e) => setProviderReference(e.target.value)}
                placeholder="e.g. IKEDC-94827103"
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5 flex items-center justify-between">
                <span>Official Provider Portal URL</span>
                {isVerified && <span className="text-[10px] text-[#14B8A6]">Verified</span>}
              </label>
              <input
                type="url"
                value={officialProviderUrl}
                onChange={(e) => setOfficialProviderUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
              Notes / Memo
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add optional notes (e.g. Prepaid token number, meter ID, reference details)..."
              className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#1A1D1D] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#1A1D1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{initialData ? 'Update Record' : 'Save Payment'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
