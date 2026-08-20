'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Plus, Trash2, Globe, Upload, Link2, ExternalLink, ArrowLeft } from 'lucide-react';
import { 
  type SubscriptionRow, 
  type SubscriptionInsert,
  type AccountLink,
  getKnownProviderWebsite,
  getKnownProviderManagementUrl,
  getKnownProviderAccountUrl,
  parseAccountLinks,
  cleanNotesUserText,
  formatNotesWithAccountLinks
} from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';
import { ServiceIcon } from '@/components/ui/service-icon';
import { CustomSelect } from '@/components/ui/custom-select';
import ReceiptImportModal, { type ExtractedReceiptData } from './receipt-import-modal';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSave: (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => Promise<void>;
  initialData?: SubscriptionRow | null;
}

const categories = ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'] as const;
const billingCycles = ['monthly', 'yearly', 'quarterly', 'weekly'] as const;
const statuses = ['active', 'paused', 'canceled', 'trial'] as const;

const ACCOUNT_TYPES = ['Personal', 'Family', 'Work', 'Main Account', 'Other'] as const;

export default function SubscriptionModal({
  isOpen,
  onClose,
  onBack,
  onSave,
  initialData,
}: SubscriptionModalProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<typeof billingCycles[number]>('monthly');
  const [category, setCategory] = useState<typeof categories[number]>('Streaming');
  const [status, setStatus] = useState<typeof statuses[number]>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [isUserEditedUrl, setIsUserEditedUrl] = useState(false);
  const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
  const [notes, setNotes] = useState('');

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string; date?: string }>({});

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (isOpen !== prevIsOpen || initialData !== prevInitialData) {
    setPrevIsOpen(isOpen);
    setPrevInitialData(initialData);
    if (initialData) {
      setName(initialData.name);
      setPrice(initialData.price.toString());
      setCurrency(initialData.currency);
      setBillingCycle(initialData.billing_cycle as typeof billingCycles[number]);
      setCategory(initialData.category as typeof categories[number]);
      setStatus(initialData.status as typeof statuses[number]);
      setStartDate(initialData.start_date || '');
      setEndDate(initialData.end_date || '');
      setNextBillingDate(initialData.next_billing_date);
      
      const actualProviderUrl = initialData.provider_url ? initialData.provider_url.trim() : '';
      setProviderUrl(actualProviderUrl);
      setIsUserEditedUrl(Boolean(actualProviderUrl));
      
      setAccountLinks(parseAccountLinks(initialData));
      setNotes(cleanNotesUserText(initialData.notes));
    } else {
      setName('');
      setPrice('');
      setCurrency('USD');
      setBillingCycle('monthly');
      setCategory('Streaming');
      setStatus('active');
      setStartDate('');
      setEndDate('');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setNextBillingDate(nextMonth.toISOString().split('T')[0]);
      setProviderUrl('');
      setIsUserEditedUrl(false);
      setAccountLinks([]);
      setNotes('');
    }
    setFieldErrors({});
  }

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleUrlChange = (val: string) => {
    setProviderUrl(val);
    setIsUserEditedUrl(true);
  };

  const handleAddAccountLink = () => {
    setAccountLinks((prev) => [
      ...prev,
      { id: `link-${Date.now()}`, label: 'Personal', url: '' },
    ]);
  };

  const handleUpdateAccountLink = (id: string, field: string, value: string | boolean) => {
    setAccountLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveAccountLink = (id: string) => {
    setAccountLinks((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmReceiptData = (extracted: ExtractedReceiptData) => {
    if (extracted.name) {
      setName(extracted.name);
      if (extracted.providerUrl) {
        setProviderUrl(extracted.providerUrl);
        setIsUserEditedUrl(true);
      }
    }
    if (extracted.price) setPrice(extracted.price);
    if (extracted.currency) setCurrency(extracted.currency);
    if (extracted.billingCycle) setBillingCycle(extracted.billingCycle);
    if (extracted.category) setCategory(extracted.category);
    if (extracted.nextBillingDate) setNextBillingDate(extracted.nextBillingDate);

    let addedNotes = '';
    if (extracted.plan) addedNotes += `Plan: ${extracted.plan}\n`;
    if (extracted.trialEndDate) addedNotes += `Trial End Date: ${extracted.trialEndDate}\n`;
    if (addedNotes) {
      setNotes((prev) => (prev ? `${prev}\n${addedNotes.trim()}` : addedNotes.trim()));
    }

    toast.success(`Extracted information for ${extracted.name || 'subscription'} applied to form.`, 'Receipt Imported');
  };

  const setQuickDate = (monthsToAdd: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToAdd);
    setNextBillingDate(d.toISOString().split('T')[0]);
  };

  const validateForm = () => {
    const errors: { name?: string; price?: string; date?: string } = {};

    if (!name.trim()) {
      errors.name = 'Subscription name is required.';
    }

    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.price = 'Enter a valid price > 0.';
    }

    if (!nextBillingDate) {
      errors.date = 'Next billing date is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    const parsedPrice = parseFloat(price);

    // Filter valid account links (must have a label or url)
    const validAccountLinks = accountLinks.filter(
      (link) => (link.label && link.label.trim().length > 0) || (link.url && link.url.trim().length > 0)
    );

    // Format notes with embedded account links fallback
    const formattedNotes = formatNotesWithAccountLinks(notes, validAccountLinks);

    try {
      await onSave(
        {
          name: name.trim(),
          price: parsedPrice,
          currency,
          billing_cycle: billingCycle,
          category,
          status,
          start_date: startDate ? startDate : null,
          end_date: endDate ? endDate : null,
          next_billing_date: nextBillingDate,
          payment_method: null,
          provider_url: providerUrl.trim() || null,
          account_links: validAccountLinks,
          notes: formattedNotes,
        },
        initialData?.id
      );

      toast.success(
        initialData ? `Updated "${name}" successfully.` : `Added "${name}" subscription!`,
        initialData ? 'Subscription Updated' : 'Subscription Created'
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save subscription.';
      toast.error(msg, 'Save Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[620px] bg-[#0F1111] border border-[#1A1D1D] rounded-t-[24px] sm:rounded-[24px] p-5 sm:p-7 space-y-5 sm:space-y-6 max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4 shrink-0">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back to Add Subscription menu"
                  className="w-8 h-8 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D] shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h2 id="modal-title" className="text-2xl sm:text-[28px] font-bold text-[#F5F7F6] tracking-tight leading-tight">
                {initialData ? 'Edit Subscription' : 'Add New Subscription'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
                title="Import details from subscription receipt"
              >
                <Upload className="w-3.5 h-3.5 text-[#94A3B8]" />
                <span className="hidden sm:inline">Import Receipt</span>
                <span className="sm:hidden">Import</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7 overflow-y-auto pr-1.5 flex-1 min-h-0 pb-3">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#94A3B8] block">Subscription Name</label>
              <div className="flex items-center gap-2.5">
                <ServiceIcon name={name || 'Subscription'} category={category} providerUrl={providerUrl} className="w-11 h-11 rounded-xl shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. Netflix, Spotify, GitHub Pro"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`flex-1 h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                    fieldErrors.name ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <span className="text-[11px] text-[#D9363E] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.name}
                </span>
              )}
            </div>

            {/* Price & Currency & Billing Cycle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Price</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="15.99"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: undefined }));
                  }}
                  className={`w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                    fieldErrors.price ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                />
                {fieldErrors.price && (
                  <span className="text-[10px] text-[#D9363E] font-medium">{fieldErrors.price}</span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                >
                  <option value="USD" className="bg-[#0D0F0F] text-[#F5F7F6]">USD ($)</option>
                  <option value="EUR" className="bg-[#0D0F0F] text-[#F5F7F6]">EUR (€)</option>
                  <option value="GBP" className="bg-[#0D0F0F] text-[#F5F7F6]">GBP (£)</option>
                  <option value="CAD" className="bg-[#0D0F0F] text-[#F5F7F6]">CAD ($)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Cycle</label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as typeof billingCycles[number])}
                  className="w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors capitalize"
                >
                  {billingCycles.map((c) => (
                    <option key={c} value={c} className="bg-[#0D0F0F] text-[#F5F7F6] capitalize">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof categories[number])}
                  className="w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0D0F0F] text-[#F5F7F6]">{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof statuses[number])}
                  className="w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors capitalize"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s} className="bg-[#0D0F0F] text-[#F5F7F6] capitalize">{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Start Date & End Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">
                  Start Date <span className="text-[11px] font-normal text-[#64748B] ml-1.5 select-none">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">
                  End Date <span className="text-[11px] font-normal text-[#64748B] ml-1.5 select-none">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="No end date"
                  className="w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>
            </div>

            {/* Next Billing Date & Quick Presets (Contract & Renewal Section) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Next Billing / Renewal Date</label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setQuickDate(1)}
                    className="px-3 py-1 min-h-[32px] rounded-lg bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
                  >
                    +1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(12)}
                    className="px-3 py-1 min-h-[32px] rounded-lg bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
                  >
                    +1 Year
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
              {fieldErrors.date && (
                <span className="text-[10px] text-[#D9363E] font-medium">{fieldErrors.date}</span>
              )}
            </div>

            {/* Provider Website Field */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#94A3B8] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
                <span>Provider URL</span>
              </label>
              <input
                type="url"
                placeholder=""
                value={providerUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>

            {/* Subscription Accounts Section */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-[#94A3B8] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>Subscription Accounts</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddAccountLink}
                  className="text-xs font-semibold text-[#14B8A6] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Add account link</span>
                </button>
              </div>

              {accountLinks.length === 0 ? (
                <div className="p-3.5 text-center rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs text-[#94A3B8]">
                  No account entries added yet. Click &quot;Add account link&quot; to configure your accounts.
                </div>
              ) : (
                <div className="space-y-4">
                  {accountLinks.map((link, idx) => {
                    const customUrl = link.url ? link.url.trim() : '';
                    const knownAccountUrl = getKnownProviderAccountUrl(name);

                    let effectiveAccountUrl: string | null = null;
                    if (customUrl) {
                      effectiveAccountUrl = customUrl.startsWith('http://') || customUrl.startsWith('https://')
                        ? customUrl
                        : `https://${customUrl}`;
                    } else if (knownAccountUrl) {
                      effectiveAccountUrl = knownAccountUrl;
                    }

                    const hasAccountUrl = Boolean(effectiveAccountUrl);

                    return (
                      <div key={link.id} className="space-y-3 pt-2 pb-1 border-b border-[#1A1D1D]/40 last:border-b-0">
                        {/* Account Type Header with Delete Row Button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-2 flex-1 min-w-0">
                            <label className="text-[13px] font-medium text-[#94A3B8] block">
                              Account Type {accountLinks.length > 1 ? `#${idx + 1}` : ''}
                            </label>
                            <CustomSelect
                              options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
                              value={link.label || 'Personal'}
                              onChange={(val) => handleUpdateAccountLink(link.id, 'label', val)}
                              variant="borderless"
                              ariaLabel="Account Type"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAccountLink(link.id)}
                            className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-[#D9363E] hover:bg-[#D9363E]/10 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-3"
                            title="Delete account row"
                            aria-label="Delete account row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Account URL */}
                        <div className="space-y-2">
                          <label className="text-[13px] font-medium text-[#94A3B8] block">Account URL</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              placeholder=""
                              value={link.url || ''}
                              onChange={(e) => handleUpdateAccountLink(link.id, 'url', e.target.value)}
                              className="flex-1 h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                            />
                            {hasAccountUrl ? (
                              <a
                                href={effectiveAccountUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-11 w-11 shrink-0 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer"
                                title={
                                  customUrl
                                    ? 'Open custom account URL in new tab'
                                    : `Open ${name || 'provider'} account destination in new tab`
                                }
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                title="Enter an Account URL or select a known provider to open account destination"
                                className="h-11 w-11 shrink-0 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#94A3B8] flex items-center justify-center transition-colors opacity-40 cursor-not-allowed"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2 pt-1">
              <label className="text-[13px] font-medium text-[#94A3B8] block">
                Notes <span className="text-[11px] font-normal text-[#64748B] ml-1.5 select-none">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Additional renewal notes or plan tier details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1A1D1D] shrink-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl min-h-[44px] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-3 rounded-xl min-h-[44px] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !price.trim() || isNaN(parseFloat(price)) || parseFloat(price) <= 0 || !nextBillingDate}
                className="w-full sm:w-auto px-6 py-3 rounded-xl min-h-[44px] bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{initialData ? 'Update Subscription' : 'Create Subscription'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Receipt Import Review Modal */}
      <ReceiptImportModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onConfirm={handleConfirmReceiptData}
      />
    </>
  );
}

