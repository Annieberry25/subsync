'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Plus, Trash2, Upload, Link2, ExternalLink } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { 
  type SubscriptionRow, 
  type SubscriptionInsert,
  type AccountLink,
  getKnownProviderWebsite,
  getKnownProviderAccountUrl,
  parseAccountLinks,
  cleanNotesUserText,
  formatNotesWithAccountLinks,
  getSubscriptionHistoryState,
  parseAttachedReceipts,
} from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';
import { ServiceIcon } from '@/components/ui/service-icon';
import { CustomSelect } from '@/components/ui/custom-select';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { usePlan } from '@/lib/contexts/user-settings-context';
import { hasReachedAccountLinkCap } from '@/lib/constants/plan-limits';
import ReceiptImportModal, { type ExtractedReceiptData } from './receipt-import-modal';
import { storeReceiptFile } from '@/lib/services/receipt-storage';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSave: (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => Promise<string | null>;
  initialData?: SubscriptionRow | null;
  /** File carried over from the receipt import step, uploaded after save. */
  pendingReceiptFile?: File | null;
  /** Opens the upgrade sheet when a Plus-only feature is attempted. */
  onRequireUpgrade?: () => void;
}

const categories = ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'] as const;
const billingCycles = ['monthly', 'yearly', 'quarterly', 'weekly'] as const;
const statuses = ['active', 'paused', 'canceled', 'trial'] as const;

const ACCOUNT_TYPES = ['Personal', 'Family', 'Work', 'Main Account', 'Other'] as const;

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MIN_DATE = '2000-01-01';
const MAX_DATE = formatDateInput(new Date(new Date().getFullYear() + 10, 11, 31));

const SUBSCRIPTION_FORM_ID = 'subscription-modal-form';

export default function SubscriptionModal({
  isOpen,
  onClose,
  onBack,
  onSave,
  initialData,
  pendingReceiptFile,
  onRequireUpgrade,
}: SubscriptionModalProps) {
  const { toast } = useToast();
  const { planTier } = usePlan();

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
  const [cheaperPlanName, setCheaperPlanName] = useState('');
  const [cheaperPlanPrice, setCheaperPlanPrice] = useState('');

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string; date?: string }>({});

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

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
      setCheaperPlanName(initialData.cheaper_plan_name || '');
      setCheaperPlanPrice(
        initialData.cheaper_plan_price != null ? String(initialData.cheaper_plan_price) : ''
      );
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
      setCheaperPlanName('');
      setCheaperPlanPrice('');
    }
    setFieldErrors({});
  }

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isUserEditedUrl) {
      const knownWebsite = getKnownProviderWebsite(val);
      setProviderUrl(knownWebsite || '');
    }
    const knownAccountUrl = getKnownProviderAccountUrl(val);
    if (knownAccountUrl) {
      setAccountLinks((prev) =>
        prev.map((link) =>
          link.url && link.url.trim() ? link : { ...link, url: knownAccountUrl }
        )
      );
    }
    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleAddAccountLink = () => {
    /* Free allows a single account per subscription. The check happens on the
       click rather than at save so the user is told while looking at the
       control, and so an existing single row on a free account is not silently
       overwritten. */
    if (hasReachedAccountLinkCap({ tier: planTier, linkCount: accountLinks.length })) {
      onRequireUpgrade?.();
      return;
    }

    const knownAccountUrl = getKnownProviderAccountUrl(name);
    setAccountLinks((prev) => [
      ...prev,
      {
        id: `link-${Date.now()}`,
        label: prev.length === 0 ? 'Personal' : `Account ${prev.length + 1}`,
        // Pre-filled from the provider table so the user never has to paste the
        // profile URL themselves. Still editable for providers we don't know.
        url: knownAccountUrl || '',
      },
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

  /* False once the tier's account-link cap is met, which drives both the Plus
     badge and the inline upgrade hint. Derived rather than stored so removing a
     row immediately re-enables the button. */
  const canAddAnotherAccount = !hasReachedAccountLinkCap({
    tier: planTier,
    linkCount: accountLinks.length,
  });

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

    // A cheaper tier only counts when both halves are present: a name with no
    // price (or the reverse) cannot produce a "save $X/mo" figure, so it is
    // discarded rather than shown as a half-configured recommendation.
    const trimmedCheaperName = cheaperPlanName.trim();
    const parsedCheaperPrice = parseFloat(cheaperPlanPrice);
    const hasCheaperPlan =
      trimmedCheaperName.length > 0 &&
      !isNaN(parsedCheaperPrice) &&
      parsedCheaperPrice >= 0;

    // Filter valid account links (must have a label or url)
    const validAccountLinks = accountLinks.filter(
      (link) => (link.label && link.label.trim().length > 0) || (link.url && link.url.trim().length > 0)
    );

    // Rebuild the notes metadata blocks from the row being edited. The form
    // only holds the user-visible text, so without this an ordinary edit would
    // strip [AttachedReceipts: ...] and [HistoryState: ...] — silently erasing
    // the row's attachments and, for an archived/deleted row, resurrecting it
    // into the active list.
    const formattedNotes = formatNotesWithAccountLinks(
      notes,
      validAccountLinks,
      initialData ? getSubscriptionHistoryState(initialData).metadata ?? null : null,
      initialData ? parseAttachedReceipts(initialData) : null
    );

    try {
      const savedId = await onSave(
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
          cheaper_plan_name: hasCheaperPlan ? trimmedCheaperName : null,
          cheaper_plan_price: hasCheaperPlan ? parsedCheaperPrice : null,
        },
        initialData?.id
      );

      // null means the caller handled the submit itself (e.g. a plan-limit
      // gate opened the upgrade modal) — do not toast success or close.
      if (!savedId) return;

      if (pendingReceiptFile && savedId) {
        const stored = await storeReceiptFile({
          file: pendingReceiptFile,
          parent: { kind: 'subscription', subscriptionId: savedId },
        });
        if (stored.error) {
          toast.warning(
            'Subscription saved, but the receipt file could not be attached.',
            'File Not Attached'
          );
        }
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save subscription.';
      toast.error(msg, 'Save Error');
    } finally {
      setLoading(false);
    }
  };

  /* Previously this required name, a parsable price > 0, and a next billing
     date. That combination had two failure modes the user hit directly:
       - a dead button with no visible reason, because validateForm() only runs
         on submit and submit was impossible;
       - an unescapable trap, since an existing row with a null
         next_billing_date left the button disabled forever, so the date could
         never be set and the row could never be saved.
     Disabling only while saving keeps the control interactive; validateForm()
     then reports the specific problems inline. */
  const isSubmitDisabled = loading;

  return (
    <>
      <Sheet
        open={isOpen}
        onClose={onClose}
        size="lg"
        title={initialData?.id ? 'Edit Subscription' : 'Add New Subscription'}
        headerAction={
          <button
            type="button"
            onClick={() => setIsReceiptModalOpen(true)}
            className="px-3 min-h-[44px] rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Import details from subscription receipt"
          >
            <Upload className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="hidden sm:inline">Import Receipt</span>
            <span className="sm:hidden">Import</span>
          </button>
        }
        /* Actions are pinned below the scrolling form. */
        footer={
          <div className="flex items-center justify-end gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={SUBSCRIPTION_FORM_ID}
              disabled={isSubmitDisabled}
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{initialData?.id ? 'Update Subscription' : 'Create Subscription'}</span>
              )}
            </button>
          </div>
        }
      >
          {/* Form. The Sheet body owns the scroll; the submit button in the
              footer targets this form by id. */}
          <form id={SUBSCRIPTION_FORM_ID} onSubmit={handleSubmit} className="space-y-6 sm:space-y-7 pt-1 pb-3">
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
                  aria-describedby={fieldErrors.name ? 'sub-error' : undefined}
                  className={`flex-1 h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                    fieldErrors.name ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <span id="sub-error" className="text-[11px] text-[#D9363E] font-medium flex items-center gap-1">
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
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#0D0F0F] text-[#F5F7F6]">
                      {c.code} ({c.symbol})
                    </option>
                  ))}
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
                  min={MIN_DATE}
                  max={MAX_DATE}
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
                  min={MIN_DATE}
                  max={MAX_DATE}
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
                min={MIN_DATE}
                max={MAX_DATE}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
              {fieldErrors.date && (
                <span className="text-[10px] text-[#D9363E] font-medium">{fieldErrors.date}</span>
              )}
            </div>

            {/* No Provider URL input. The website is resolved from the provider
                name and the account-link table, so asking for it by hand only
                produced values that disagreed with the ones SubHalt already
                knew. `providerUrl` is still derived and still saved — it just
                has no field of its own. See handleNameChange. */}

            {/* Subscription Accounts Section */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[13px] font-medium text-[#94A3B8] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>Subscription Accounts</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddAccountLink}
                  title={
                    canAddAnotherAccount
                      ? 'Add another account link'
                      : 'Multiple accounts per subscription are a Plus feature'
                  }
                  className="text-xs font-semibold text-[#14B8A6] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Add account link</span>
                </button>
              </div>

              {/* No "Plus" badge here on purpose. The section itself is a normal
                  part of adding a subscription; only the attempt to go past one
                  account is Plus, and that is explained when it happens rather
                  than advertised up front. */}
              {!canAddAnotherAccount && (
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Your plan includes one account per subscription. Upgrade to Plus to add
                  multiple accounts — family, work, or a second profile.
                </p>
              )}

              {accountLinks.length === 0 ? (
                <div className="p-3.5 text-center rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs text-[#94A3B8]">
                  No account entries added yet. Click &quot;Add account link&quot; to configure your accounts.
                </div>
              ) : (
                <div className="space-y-4">
                  {accountLinks.map((link, idx) => {
                    const customUrl = link.url ? link.url.trim() : '';
                    const knownAccountUrl = getKnownProviderAccountUrl(name);
                    const knownWebsite = getKnownProviderWebsite(name);

                    /* Fallback chain, most specific first. The link icon is only
                       disabled when we have nothing at all to send the user to,
                       because a dead icon reads as a broken feature rather than
                       as "we don't know this provider". The provider's own site
                       is a usable destination even when the deep account path is
                       unknown — signing in there is the point, and the account URL
                       is already pre-filled from the table wherever we know it. */
                    const effectiveAccountUrl = [
                      customUrl,
                      knownAccountUrl,
                      providerUrl,
                      knownWebsite,
                    ]
                      .filter((value): value is string => Boolean(value && value.trim()))
                      .map((value) =>
                        value.startsWith('http://') || value.startsWith('https://')
                          ? value
                          : `https://${value}`
                      )[0] ?? null;

                    const hasAccountUrl = Boolean(effectiveAccountUrl);
                    const usesKnownAccountPath = !customUrl && Boolean(knownAccountUrl);

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
                          <label
                            htmlFor={`account-url-${link.id}`}
                            className="text-[13px] font-medium text-[#94A3B8] block"
                          >
                            Account URL
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id={`account-url-${link.id}`}
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
                                    ? 'Open your saved account URL in a new tab'
                                    : usesKnownAccountPath
                                      ? `Open your ${name || 'provider'} account page in a new tab to sign in`
                                      : `Open ${name || 'the provider'}’s website in a new tab to sign in and manage your account`
                                }
                                aria-label={`Open ${name || 'provider'} account in a new tab`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                title="Type a provider name above so we can open its account page"
                                className="h-11 w-11 shrink-0 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#94A3B8] flex items-center justify-center transition-colors opacity-40 cursor-not-allowed"
                                aria-label="No provider page available yet"
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

            {/* Cheaper plan tier, used by Savings Intelligence to recommend a
                downgrade instead of a straight cancellation. */}
            <div className="space-y-2 pt-1">
              <label className="text-[13px] font-medium text-[#94A3B8] block">
                Cheaper Plan Tier{' '}
                <span className="text-[11px] font-normal text-[#64748B] ml-1.5 select-none">
                  (Optional)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="e.g. Basic Plan"
                  aria-label="Cheaper plan name"
                  value={cheaperPlanName}
                  onChange={(e) => setCheaperPlanName(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  aria-label="Cheaper plan price"
                  value={cheaperPlanPrice}
                  onChange={(e) => setCheaperPlanPrice(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                />
              </div>
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
          </form>
      </Sheet>

      {/* Receipt Import Review Modal */}
      <ReceiptImportModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onConfirm={handleConfirmReceiptData}
      />
    </>
  );
}

