'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, Plus, Trash2, ChevronLeft, ExternalLink } from 'lucide-react';
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

import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { usePlan } from '@/lib/contexts/user-settings-context';
import { hasReachedAccountLinkCap } from '@/lib/constants/plan-limits';
import { normalizeSubscriptionName } from '@/lib/services/receipt-discovery';
import { formatCurrency } from '@/lib/utils/metrics-utils';
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
  /**
   * The subscriptions this user already tracks.
   *
   * Used to recognise a service that is already on the list. When the typed
   * name matches one of these, the form stops being an "add a subscription"
   * form and becomes an "add another account to it" form: the same service,
   * another login. The row that is already there is updated instead of a
   * second one being created, because two rows for one service is what makes
   * the totals and the reminders wrong.
   */
  existingSubscriptions?: SubscriptionRow[];
  /**
   * The account the form should open on.
   *
   * Set when the user came from the detail sheet, where they had picked which
   * account they wanted. The row is ringed and scrolled into view, so the edit
   * starts where the eye already was.
   */
  focusAccountId?: string | null;
}

const categories = ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'] as const;
const billingCycles = ['monthly', 'yearly', 'quarterly', 'weekly'] as const;
const statuses = ['active', 'paused', 'canceled', 'trial'] as const;

const ACCOUNT_TYPES = ['Personal', 'Family', 'Work', 'Main Account', 'Other'] as const;

/**
 * The fields a subscription cannot exist without.
 *
 * Everything else in the form is optional and says so on the label. These three
 * are validated individually so the error can sit under the box that is empty
 * instead of in one summary the user has to map back to the form.
 */
interface FieldErrors {
  name?: string;
  price?: string;
  date?: string;
  startDate?: string;
  currency?: string;
  cycle?: string;
  category?: string;
  status?: string;
  accountType?: string;
}

function validateName(value: string): string | undefined {
  return value.trim() ? undefined : 'Subscription name is required.';
}

function validatePrice(value: string): string | undefined {
  const parsed = parseFloat(value);
  if (!value.trim() || isNaN(parsed) || parsed <= 0) {
    return 'Enter a valid price greater than 0.';
  }
  return undefined;
}

function validateDate(value: string): string | undefined {
  return value ? undefined : 'Next billing date is required.';
}

function validateChoice(value: string, label: string): string | undefined {
  return value ? undefined : `${label} is required.`;
}

/**
 * A unique id for a seeded account row.
 *
 * Derived from the rows already there rather than from a clock: the seeding
 * happens while the form renders, and an id built from the time would make the
 * form's state depend on when it happened to render.
 */
function nextAccountLinkId(existing: AccountLink[]): string {
  const base = `link-seed-${existing.length + 1}`;
  let id = base;
  let suffix = 2;
  while (existing.some((link) => link.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/**
 * The account type for a newly added row.
 *
 * The first type nobody is using yet, so the rows do not all land on
 * "Personal" by accident. The row number is the label above it
 * ("Account Type 1", "Account Type 2"); this is what the row is for.
 */
function nextAccountType(existing: AccountLink[]): string {
  const used = new Set(existing.map((link) => link.label));
  return ACCOUNT_TYPES.find((type) => !used.has(type)) ?? 'Other';
}

/**
 * The next billing date, one cycle after a date.
 *
 * Done in UTC because a renewal date is a date, not a moment: doing it in
 * local time moved a renewal by a day for anyone east or west of Greenwich,
 * and a reminder that fires on the wrong day is the whole product failing.
 *
 * The day is clamped to the end of the month, so the 31st of January renews
 * on the 28th or 29th of February rather than rolling into March.
 */
function addCycleToDate(isoDate: string, cycle: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(Date.UTC(year, month - 1, day));

  if (cycle === 'yearly') {
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth() + 1, 0)
    ).getUTCDate();
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCDate(Math.min(day, lastDay));
    return date.toISOString().split('T')[0];
  }

  if (cycle === 'quarterly') {
    const targetMonth = date.getUTCMonth() + 3;
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)
    ).getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(targetMonth);
    date.setUTCDate(Math.min(day, lastDay));
    return date.toISOString().split('T')[0];
  }

  if (cycle === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString().split('T')[0];
  }

  const targetMonth = date.getUTCMonth() + 1;
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)
  ).getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(targetMonth);
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().split('T')[0];
}

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
  existingSubscriptions = [],
  focusAccountId = null,
}: SubscriptionModalProps) {
  const { toast } = useToast();
  const { planTier } = usePlan();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  /*
   * These four start empty on purpose.
   *
   * A default the user never chose is a value the user never entered: the
   * currency, the cycle, the category and the status are all things they have
   * an opinion about, and a silently assumed one is how a subscription ends up
   * filed under the wrong category and billed on the wrong day. They are
   * required, and the form says which one is missing.
   *
   * When the name matches a subscription that is already tracked, they are
   * filled in from that row instead — see carryOverFrom.
   */
  const [currency, setCurrency] = useState('');
  const [billingCycle, setBillingCycle] = useState<typeof billingCycles[number] | ''>('');
  const [category, setCategory] = useState<typeof categories[number] | ''>('');
  const [status, setStatus] = useState<typeof statuses[number] | ''>('');
  const [startDate, setStartDate] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [isUserEditedUrl, setIsUserEditedUrl] = useState(false);
  const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
  /**
   * The account the form is working on.
   *
   * Each account carries its own details — its own type, amount, cycle,
   * category and renewal date — because a personal plan and a work plan on
   * the same service are not the same subscription. The main fields describe
   * the account in view, and the account rows carry the rest.
   */
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const [notes, setNotes] = useState('');

  /*
   * The note the row already had, kept out of the box.
   *
   * The notes box is for the user to write in, so it opens empty in every
   * form. The text that was already there is still saved when the box is left
   * empty, so editing a price never quietly deletes a note — and what the
   * user did write replaces it.
   */
  const [existingNotesText, setExistingNotesText] = useState('');

  /**
   * The account row the form opens on, when the user came from the detail
   * sheet having picked one.
   */
  const [focusedLinkId, setFocusedLinkId] = useState<string | null>(null);

  /*
   * The type of the account being added.
   *
   * It is a field of the form rather than a control buried under the account
   * links, because it is something the user chooses about the account, not
   * about a link. It applies to the account that is added next, and changing
   * it afterwards renames the account that was added last.
   */
  const [accountType, setAccountType] = useState('');

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  /**
   * The subscription the typed name already belongs to.
   *
   * Set the moment the name matches one the user tracks, and it is what turns
   * this form into the "add another account" form. It is also the row the
   * save writes to, so no second row is ever created for a service that is
   * already on the list.
   */
  const [duplicateOf, setDuplicateOf] = useState<SubscriptionRow | null>(null);

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
      setNextBillingDate(initialData.next_billing_date);
      
      const actualProviderUrl = initialData.provider_url ? initialData.provider_url.trim() : '';
      setProviderUrl(actualProviderUrl);
      setIsUserEditedUrl(Boolean(actualProviderUrl));
      
      setAccountLinks(parseAccountLinks(initialData));
      setAccountType('');
      setNotes('');
      setExistingNotesText(cleanNotesUserText(initialData.notes));
      setFocusedLinkId(focusAccountId);
    } else {
      setName('');
      setPrice('');
      setCurrency('');
      setBillingCycle('');
      setCategory('');
      setStatus('');
      setStartDate('');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setNextBillingDate(nextMonth.toISOString().split('T')[0]);
      setProviderUrl('');
      setIsUserEditedUrl(false);
      setAccountLinks([]);
      setAccountType('');
      setNotes('');
      setExistingNotesText('');
    }
    setDuplicateOf(null);
    setFieldErrors({});
  }

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isUserEditedUrl) {
      const knownWebsite = getKnownProviderWebsite(val);
      setProviderUrl(knownWebsite || '');
    }
    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));

    /*
     * A service that is already tracked turns this into an "add another
     * account" form. The save then writes to that row instead of creating a
     * second one for the same service.
     */
    const match = initialData?.id ? null : findTrackedMatch(val);
    if (match && match.id !== duplicateOf?.id) {
      setDuplicateOf(match);
      carryOverFrom(match);
    } else if (!match) {
      setDuplicateOf(null);
    }
  };

  /**
   * Finds a tracked subscription for the same service.
   *
   * Compared the way the discovery paths compare it — case and whitespace
   * ignored — so "Netflix" and "netflix " are the same service. A cancelled
   * row is not a match: a subscription that was cancelled and then started
   * again is a new subscription, not a second account on the old one.
   */
  const findTrackedMatch = (value: string): SubscriptionRow | null => {
    const normalized = normalizeSubscriptionName(value);
    if (!normalized) return null;
    return (
      existingSubscriptions.find(
        (sub) => sub.status !== 'canceled' && normalizeSubscriptionName(sub.name) === normalized
      ) ?? null
    );
  };

  /**
   * Fills the form with the tracked row's values.
   *
   * The price, the currency, the cycle, the category and the status all come
   * from the subscription that is already there, because another account for
   * the same service is the same service at the same price — and the user can
   * still change any of them.
   *
   * The boxes the user has to decide for themselves are left empty: the
   * account type, the start date and the renewal date. A date the user never
   * chose is a date the reminders will be wrong about, and the type of the
   * extra account is theirs to say.
   */
  const carryOverFrom = (match: SubscriptionRow) => {
    setPrice((current) => (current.trim() ? current : match.price.toString()));
    setCurrency(match.currency);
    setBillingCycle(match.billing_cycle as typeof billingCycles[number]);
    setCategory(match.category as typeof categories[number]);
    setStatus(match.status as typeof statuses[number]);
    if (!isUserEditedUrl) setProviderUrl(match.provider_url || '');

    /* The boxes the user has to decide are emptied rather than filled in. */
    setNextBillingDate('');
    setStartDate('');
    setAccountType('');

    // The note the row already has is kept for the save, but the box the user
    // types in stays empty.
    setExistingNotesText(cleanNotesUserText(match.notes));

    const existing = parseAccountLinks(match);
    setAccountLinks([
      ...existing,
      {
        id: nextAccountLinkId(existing),
        label: nextAccountType(existing),
        /*
         * Empty on purpose: the box is for the user's own account link. The
         * arrow beside it opens the provider's account page.
         */
        url: '',
      },
    ]);
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

    setAccountLinks((prev) => [
      ...prev,
      {
        id: `link-${Date.now()}`,
        // The type the user picked in the form, or the first one nobody is
        // using yet when the form has not been filled in.
        label: accountType || nextAccountType(prev),
        /*
         * The account starts with the details the form is holding, which is
         * what the user is looking at when they add it.
         */
        price: price ? Number(price) : undefined,
        currency: currency || undefined,
        billing_cycle: billingCycle || undefined,
        category: category || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        next_billing_date: nextBillingDate || undefined,
        /*
         * Empty on purpose.
         *
         * This box is for the user's own account link. The provider's link is
         * what the arrow beside it opens, and putting the provider's link in
         * here made it impossible to tell which one the box was holding.
         */
        url: '',
      },
    ]);
    /* The new account is the one the form works on next. */
    setActiveAccountId(`link-${Date.now()}`);
  };

  const handleUpdateAccountLink = (
    id: string,
    field: string,
    value: string | boolean | number | undefined
  ) => {
    setAccountLinks((prev) =>
      prev.map((item) =>
        item.id === id ? ({ ...item, [field]: value } as AccountLink) : item
      )
    );
  };

  const handleRemoveAccountLink = (id: string) => {
    setAccountLinks((prev) => prev.filter((item) => item.id !== id));
    setActiveAccountId((current) => (current === id ? null : current));
  };

  /**
   * Puts an account's own details into the main fields.
   *
   * The main fields describe the account in view, so selecting an account row
   * brings up what that account costs and when it renews — not the
   * subscription's, which is a different thing once there is more than one.
   */
  const loadAccountIntoForm = (link: AccountLink) => {
    setActiveAccountId(link.id);
    setAccountType(link.label || 'Personal');
    setPrice(link.price !== undefined ? String(link.price) : price);
    setCurrency(link.currency || currency);
    setBillingCycle((link.billing_cycle as typeof billingCycles[number]) || billingCycle);
    setCategory((link.category as typeof categories[number]) || category);
    setStatus((link.status as typeof statuses[number]) || status);
    setStartDate(link.start_date || startDate);
    setNextBillingDate(link.next_billing_date || nextBillingDate);
  };

  /**
   * Changes the type of the account in view.
   *
   * The type belongs to the account, and the form holds one of them, so
   * changing it renames the account the form is working on. That way the
   * choice is made in the form rather than in a control tucked under the
   * links.
   */
  const handleAccountTypeChange = (value: string) => {
    setAccountType(value);
    if (fieldErrors.accountType) setFieldErrors((prev) => ({ ...prev, accountType: undefined }));
    setAccountLinks((prev) => {
      if (prev.length === 0) return prev;
      /* The account in view, or the one that was added last when the form is
         not on an account yet. */
      const target =
        prev.find((link) => link.id === activeAccountId) ?? prev[prev.length - 1];
      return prev.map((link) => (link.id === target.id ? { ...link, label: value } : link));
    });
  };

  /* False once the tier's account-link cap is met, which drives both the Plus
     badge and the inline upgrade hint. Derived rather than stored so removing a
     row immediately re-enables the button. */
  const canAddAnotherAccount = !hasReachedAccountLinkCap({
    tier: planTier,
    linkCount: accountLinks.length,
  });

  /**
   * What the account being added is worth, in the form's own words.
   *
   * "This account adds $15.99 a month." The price belongs to the subscription,
   * so this is what the new account adds to what is already being paid.
   */
  const accountValueLabel = (() => {
    const amount = parseFloat(price);
    if (!price.trim() || isNaN(amount) || amount <= 0) return null;
    const period =
      billingCycle === 'yearly'
        ? 'a year'
        : billingCycle === 'weekly'
          ? 'a week'
          : billingCycle === 'quarterly'
            ? 'a quarter'
            : 'a month';
    return `${formatCurrency(amount, currency || 'USD')} ${period}`;
  })();

  /**
   * The start date decides the renewal date.
   *
   * A subscription that started on a day renews a cycle later, so the renewal
   * date follows the start date instead of being a second thing to work out.
   * It is still editable — this only fills it in.
   */
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (fieldErrors.startDate) setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
    if (!value) return;
    const next = addCycleToDate(value, billingCycle || 'monthly');
    if (next) {
      setNextBillingDate(next);
      if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
    }
  };

  /**
   * The quick choices set the cycle and the renewal date together.
   *
   * The date is measured from the start date the user entered, not from today,
   * so a subscription that started in the past still renews a cycle after it
   * started rather than a cycle after today.
   */
  const setQuickCycle = (cycle: 'monthly' | 'yearly') => {
    setBillingCycle(cycle);
    const base = startDate || new Date().toISOString().split('T')[0];
    const next = addCycleToDate(base, cycle);
    if (next) {
      setNextBillingDate(next);
      if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
    }
  };

  const validateForm = () => {
    const errors: FieldErrors = {};

    const nameError = validateName(name);
    if (nameError) errors.name = nameError;

    const priceError = validatePrice(price);
    if (priceError) errors.price = priceError;

    const dateError = validateDate(nextBillingDate);
    if (dateError) errors.date = dateError;

    const startDateError = validateDate(startDate);
    if (startDateError) errors.startDate = 'Start date is required.';

    const currencyError = validateChoice(currency, 'Currency');
    if (currencyError) errors.currency = currencyError;

    const cycleError = validateChoice(billingCycle, 'Cycle');
    if (cycleError) errors.cycle = cycleError;

    const categoryError = validateChoice(category, 'Category');
    if (categoryError) errors.category = categoryError;

    const statusError = validateChoice(status, 'Status');
    if (statusError) errors.status = statusError;

    /* The account type only matters once there is an account to type. */
    if (accountLinks.length > 0) {
      const accountTypeError = validateChoice(accountType, 'Account type');
      if (accountTypeError) errors.accountType = accountTypeError;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Validates one field when the user leaves it.
   *
   * Reporting an error the moment a box is left empty is what makes the form
   * legible: the message sits under the box, not in a summary the user has to
   * map back to the field. It only ever reports a field the user has actually
   * touched, so an untouched form is never covered in red.
   */
  const validateField = (
    field:
      | 'name'
      | 'price'
      | 'date'
      | 'startDate'
      | 'currency'
      | 'cycle'
      | 'category'
      | 'status'
      | 'accountType'
  ) => {
    const message =
      field === 'name'
        ? validateName(name)
        : field === 'price'
          ? validatePrice(price)
          : field === 'date'
            ? validateDate(nextBillingDate)
            : field === 'startDate'
              ? startDate
                ? undefined
                : 'Start date is required.'
              : field === 'currency'
                ? validateChoice(currency, 'Currency')
                : field === 'cycle'
                  ? validateChoice(billingCycle, 'Cycle')
                  : field === 'category'
                    ? validateChoice(category, 'Category')
                    : field === 'status'
                      ? validateChoice(status, 'Status')
                      : validateChoice(accountType, 'Account type');

    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    /*
     * The row this save writes to.
     *
     * Normally the row being edited. When the typed name belongs to a service
     * that is already tracked, it is that row — so a second account for the
     * same service is added to the subscription that is already there, and no
     * second row is created for it.
     */
    const saveTarget = initialData?.id ? initialData : duplicateOf;

    /*
     * Another account is a Plus feature. A plan that is already at its limit
     * is told so here, at the moment of the save, instead of being allowed to
     * save a form whose only point was the extra account.
     */
    if (
      saveTarget &&
      duplicateOf &&
      hasReachedAccountLinkCap({
        tier: planTier,
        linkCount: parseAccountLinks(saveTarget).length,
      })
    ) {
      onRequireUpgrade?.();
      return;
    }

setLoading(true);
    const parsedPrice = parseFloat(price);

    // Filter valid account links (must have a label or url)
    const validAccountLinks = accountLinks.filter(
      (link) => (link.label && link.label.trim().length > 0) || (link.url && link.url.trim().length > 0)
    );

    /*
     * The account in view takes the details the form is holding.
     *
     * The main fields describe one account, and the account rows carry the
     * rest, so what the user typed belongs to the account they are on.
     */
    const accountsWithFormValues = activeAccountId
      ? validAccountLinks.map((link) =>
          link.id === activeAccountId
            ? {
                ...link,
                price: parsedPrice,
                currency,
                billing_cycle: billingCycle,
                category,
                status,
                start_date: startDate || undefined,
                next_billing_date: nextBillingDate || undefined,
              }
            : link
        )
      : validAccountLinks;

    /*
     * The row's own values come from its accounts.
     *
     * The amount is what all of them cost together — two accounts on one
     * service are two charges — and the renewal date is the soonest of them,
     * which is the next one to warn about. Without accounts the row is what
     * the form says, as before.
     */
    const accountAmounts = accountsWithFormValues
      .map((link) => link.price)
      .filter((value): value is number => typeof value === 'number' && !isNaN(value));
    const accountDates = accountsWithFormValues
      .map((link) => link.next_billing_date)
      .filter((value): value is string => Boolean(value))
      .sort();
    const firstAccount = accountsWithFormValues[0];

    const rowPrice = accountAmounts.length > 0
      ? accountAmounts.reduce((sum, value) => sum + value, 0)
      : parsedPrice;
    const rowNextBillingDate = accountDates.length > 0 ? accountDates[0] : nextBillingDate;

    // Rebuild the notes metadata blocks from the row being edited. The form
    // only holds the user-visible text, so without this an ordinary edit would
    // strip [AttachedReceipts: ...] and [HistoryState: ...] — silently erasing
    // the row's attachments and, for an archived/deleted row, resurrecting it
    // into the active list. The same applies to the row an extra account is
    // being added to.
    const formattedNotes = formatNotesWithAccountLinks(
      // What the user typed replaces the note; an empty box keeps the note the
      // row already had.
      notes.trim() ? notes : existingNotesText,
      validAccountLinks,
      saveTarget ? getSubscriptionHistoryState(saveTarget).metadata ?? null : null,
      saveTarget ? parseAttachedReceipts(saveTarget) : null
    );

    try {
      const savedId = await onSave(
        {
          name: name.trim(),
          price: rowPrice,
          currency: firstAccount?.currency || currency,
          /*
           * The four choices are required and validateForm has already refused
           * the save if any of them is empty, so the cast is the compiler being
           * told something it cannot see.
           */
          billing_cycle:
            (firstAccount?.billing_cycle as typeof billingCycles[number]) ||
            (billingCycle as typeof billingCycles[number]),
          category:
            (firstAccount?.category as typeof categories[number]) ||
            (category as typeof categories[number]),
          status:
            (firstAccount?.status as typeof statuses[number]) ||
            (status as typeof statuses[number]),
          start_date: startDate ? startDate : null,
          /*
           * The form has no end date any more, so the value on the row is
           * carried through untouched rather than being quietly cleared.
           */
          end_date: saveTarget ? saveTarget.end_date ?? null : null,
          next_billing_date: rowNextBillingDate,
          payment_method: null,
          provider_url: providerUrl.trim() || null,
          account_links: accountsWithFormValues,
          notes: formattedNotes,
        },
        saveTarget?.id
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
        title={
          initialData?.id
            ? 'Edit Subscription'
            : duplicateOf
              ? 'Add Another Account'
              : 'Add New Subscription'
        }
        /* Reached from the Add Subscription chooser, so it needs its own way
           back to that menu. The header's close button already covers Cancel,
           and Import Receipt lives on the chooser as its own step. */
        headerLeading={
          onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Add Subscription"
              data-touch="compact"
              className="w-9 h-9 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null
        }
        /* Actions are pinned below the scrolling form. */
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              form={SUBSCRIPTION_FORM_ID}
              disabled={isSubmitDisabled}
              /* Both responsive labels sit in the DOM at once, so without this
                 the accessible name would read "Add Add Subscription". */
              aria-label={
                loading
                  ? 'Saving...'
                  : initialData?.id
                    ? 'Update Subscription'
                    : duplicateOf
                      ? 'Add Another Account'
                      : 'Add Subscription'
              }
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                  <span>Saving...</span>
                </>
              ) : initialData?.id ? (
                <span>Update Subscription</span>
              ) : duplicateOf ? (
                <span>Add Another Account</span>
              ) : (
                <>
                  <span className="sm:hidden">Add</span>
                  <span className="hidden sm:inline">Add Subscription</span>
                </>
              )}
            </button>
          </div>
        }
      >
          {/* Form. The Sheet body owns the scroll; the submit button in the
              footer targets this form by id. */}
          <form id={SUBSCRIPTION_FORM_ID} onSubmit={handleSubmit} className="space-y-6 sm:space-y-7 pt-1 pb-3">
            {/* The service is already on the list, so this form is adding an
                account to it. Said here, inside the form, because the user
                has to know that what they are about to save is not a new
                subscription. */}
            {duplicateOf && (
              <p className="text-[12px] text-[#94A3B8]">
                Add another {duplicateOf.name} account
              </p>
            )}

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
                  onBlur={() => validateField('name')}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? 'sub-name-error' : undefined}
                  className={`flex-1 h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                    fieldErrors.name ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <span id="sub-name-error" className="text-[11px] text-[#D9363E] font-medium flex items-center gap-1">
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
                  onBlur={() => validateField('price')}
                  aria-invalid={fieldErrors.price ? true : undefined}
                  aria-describedby={fieldErrors.price ? 'sub-price-error' : undefined}
                  className={`w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                    fieldErrors.price ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                />
                {fieldErrors.price && (
                  <span id="sub-price-error" className="text-[10px] text-[#D9363E] font-medium">
                    {fieldErrors.price}
                  </span>
                )}
                {/*
                  What the extra account is worth, in the currency the user is
                  looking at. The price above is the subscription's, and this is
                  what this account adds to it.
                */}
                {duplicateOf && accountValueLabel && (
                  <span className="text-[10px] text-[#94A3B8]">This account adds {accountValueLabel}</span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Currency</label>
                <select
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    if (fieldErrors.currency) setFieldErrors((prev) => ({ ...prev, currency: undefined }));
                  }}
                  onBlur={() => validateField('currency')}
                  aria-invalid={fieldErrors.currency ? true : undefined}
                  aria-describedby={fieldErrors.currency ? 'sub-currency-error' : undefined}
                  className={`w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] focus:outline-none transition-colors ${
                    fieldErrors.currency ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                >
                  <option value="" disabled className="bg-[#0D0F0F] text-[#94A3B8]">
                    Select currency
                  </option>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#0D0F0F] text-[#F5F7F6]">
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
                {fieldErrors.currency && (
                  <span id="sub-currency-error" className="text-[10px] text-[#D9363E] font-medium">
                    {fieldErrors.currency}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Cycle</label>
                <select
                  aria-label="Cycle"
                  value={billingCycle}
                  onChange={(e) => {
                    const cycle = e.target.value as typeof billingCycles[number] | '';
                    setBillingCycle(cycle);
                    if (fieldErrors.cycle) setFieldErrors((prev) => ({ ...prev, cycle: undefined }));
                    /* The renewal date is a cycle after the start date, so
                       changing the cycle moves it. */
                    if (cycle && startDate) {
                      const next = addCycleToDate(startDate, cycle);
                      if (next) setNextBillingDate(next);
                    }
                  }}
                  onBlur={() => validateField('cycle')}
                  aria-invalid={fieldErrors.cycle ? true : undefined}
                  aria-describedby={fieldErrors.cycle ? 'sub-cycle-error' : undefined}
                  className={`w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] focus:outline-none transition-colors capitalize ${
                    fieldErrors.cycle ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                >
                  <option value="" disabled className="bg-[#0D0F0F] text-[#94A3B8]">
                    Select cycle
                  </option>
                  {billingCycles.map((c) => (
                    <option key={c} value={c} className="bg-[#0D0F0F] text-[#F5F7F6] capitalize">{c}</option>
                  ))}
                </select>
                {fieldErrors.cycle && (
                  <span id="sub-cycle-error" className="text-[10px] text-[#D9363E] font-medium">
                    {fieldErrors.cycle}
                  </span>
                )}
              </div>
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Category</label>
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as typeof categories[number] | '');
                    if (fieldErrors.category) setFieldErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                  onBlur={() => validateField('category')}
                  aria-invalid={fieldErrors.category ? true : undefined}
                  aria-describedby={fieldErrors.category ? 'sub-category-error' : undefined}
                  className={`w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] focus:outline-none transition-colors ${
                    fieldErrors.category ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                >
                  <option value="" disabled className="bg-[#0D0F0F] text-[#94A3B8]">
                    Select category
                  </option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0D0F0F] text-[#F5F7F6]">{cat}</option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <span id="sub-category-error" className="text-[10px] text-[#D9363E] font-medium">
                    {fieldErrors.category}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Status</label>
                <select
                  aria-label="Status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as typeof statuses[number] | '');
                    if (fieldErrors.status) setFieldErrors((prev) => ({ ...prev, status: undefined }));
                  }}
                  onBlur={() => validateField('status')}
                  aria-invalid={fieldErrors.status ? true : undefined}
                  aria-describedby={fieldErrors.status ? 'sub-status-error' : undefined}
                  className={`w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] focus:outline-none transition-colors capitalize ${
                    fieldErrors.status ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                >
                  <option value="" disabled className="bg-[#0D0F0F] text-[#94A3B8]">
                    Select status
                  </option>
                  {statuses.map((s) => (
                    <option key={s} value={s} className="bg-[#0D0F0F] text-[#F5F7F6] capitalize">{s}</option>
                  ))}
                </select>
                {fieldErrors.status && (
                  <span id="sub-status-error" className="text-[10px] text-[#D9363E] font-medium">
                    {fieldErrors.status}
                  </span>
                )}
              </div>
            </div>

            {/* Start Date. The end date is gone: the renewal date already says
                when the next charge is, and a second date that can also mean
                "the end" was one more thing to get wrong. */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#94A3B8] block">Start Date</label>
                <input
                  type="date"
                  aria-label="Start Date"
                  value={startDate}
                  min={MIN_DATE}
                  max={MAX_DATE}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  onBlur={() => validateField('startDate')}
                  aria-invalid={fieldErrors.startDate ? true : undefined}
                  aria-describedby={fieldErrors.startDate ? 'sub-start-date-error' : undefined}
                  className={`w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] focus:outline-none transition-colors ${
                    fieldErrors.startDate ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                  }`}
                />
              {fieldErrors.startDate && (
                <span id="sub-start-date-error" className="text-[10px] text-[#D9363E] font-medium">
                  {fieldErrors.startDate}
                </span>
              )}
            </div>

            {/* Next Billing Date & Quick Presets (Contract & Renewal Section) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-[#94A3B8] block">Next Billing / Renewal Date</label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setQuickCycle('monthly')}
                    className="px-3 py-1 min-h-[32px] rounded-lg bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
                  >
                    +1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCycle('yearly')}
                    className="px-3 py-1 min-h-[32px] rounded-lg bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
                  >
                    +1 Year
                  </button>
                </div>
              </div>
              <input
                type="date"
                aria-label="Next Billing Date"
                value={nextBillingDate}
                min={MIN_DATE}
                max={MAX_DATE}
                onChange={(e) => {
                  setNextBillingDate(e.target.value);
                  if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
                }}
                onBlur={() => validateField('date')}
                aria-invalid={fieldErrors.date ? true : undefined}
                aria-describedby={fieldErrors.date ? 'sub-date-error' : undefined}
                className={`w-full h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border text-[#F5F7F6] focus:outline-none transition-colors ${
                  fieldErrors.date ? 'border-[#D9363E] focus:border-[#D9363E]' : 'border-[#1A1D1D] focus:border-[#14B8A6]'
                }`}
              />
              {fieldErrors.date && (
                <span id="sub-date-error" className="text-[10px] text-[#D9363E] font-medium">
                  {fieldErrors.date}
                </span>
              )}
            </div>

            {/* No Provider URL input. The website is resolved from the provider
                name and the account-link table, so asking for it by hand only
                produced values that disagreed with the ones SubHalt already
                knew. `providerUrl` is still derived and still saved — it just
                has no field of its own. See handleNameChange. */}

            {/* Account Type. A field of the form, not a control under the
                account links: it says what the account is for. */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#94A3B8] block">Account Type</label>
              <select
                aria-label="Account Type"
                value={accountType}
                onChange={(e) => handleAccountTypeChange(e.target.value)}
                onBlur={() => validateField('accountType')}
                aria-invalid={fieldErrors.accountType ? true : undefined}
                aria-describedby={fieldErrors.accountType ? 'sub-account-type-error' : undefined}
                className={`w-full h-11 !pl-4 !pr-14 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border focus:outline-none transition-colors ${
                  fieldErrors.accountType
                    ? 'border-[#D9363E] focus:border-[#D9363E] text-[#F5F7F6]'
                    : accountType
                      ? 'border-[#1A1D1D] focus:border-[#14B8A6] text-[#F5F7F6]'
                      : 'border-[#1A1D1D] focus:border-[#14B8A6] text-[#94A3B8]'
                }`}
              >
                <option value="" disabled className="bg-[#0D0F0F] text-[#94A3B8]">
                  Select account type
                </option>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-[#0D0F0F] text-[#F5F7F6]">
                    {type}
                  </option>
                ))}
              </select>
              {fieldErrors.accountType && (
                <span id="sub-account-type-error" className="text-[10px] text-[#D9363E] font-medium">
                  {fieldErrors.accountType}
                </span>
              )}
            </div>

            {/*
             * Accounts.
             *
             * No section heading: the control that creates an account is the
             * heading, and it says accounts are optional. Nothing is shown
             * until there is an account to show.
             */}
            <div className="space-y-4 pt-1">
              {/* The control that creates an account, in place of a heading,
                  with the marker that says accounts are optional. */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddAccountLink}
                  aria-label="Add account link"
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
                <span className="text-[11px] font-normal text-[#64748B]">(optional)</span>
              </div>

              {/* No "Plus" badge here on purpose. The account itself is a
                  normal part of adding a subscription; only the attempt to go
                  past one account is Plus, and that is explained when it
                  happens rather than advertised up front. */}
              {!canAddAnotherAccount && (
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Your plan includes one account per subscription. Upgrade to Plus to add
                  multiple accounts: family, work, or a second profile.
                </p>
              )}

              {accountLinks.length > 0 && (
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
                      <div
                        key={link.id}
                        data-account-id={link.id}
                        onClick={() => loadAccountIntoForm(link)}
                        className={`space-y-3 pt-2 pb-1 last:border-b-0 cursor-pointer ${
                          activeAccountId === link.id
                            ? 'border-b border-[#14B8A6]/50 rounded-xl bg-[#14B8A6]/[0.04] px-3 pt-3'
                            : focusedLinkId === link.id
                              ? 'border-b border-[#14B8A6]/30 rounded-xl px-3 pt-3'
                              : 'border-b border-[#1A1D1D]/40'
                        }`}
                      >
                        {/* The account's name, with the type it was given in
                            the form, and the control that removes it. */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#94A3B8]">
                            Account {idx + 1}
                            {link.label ? (
                              <span className="text-[11px] font-normal text-[#64748B] ml-1.5">
                                {link.label}
                              </span>
                            ) : null}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAccountLink(link.id);
                            }}
                            className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-[#D9363E] hover:bg-[#D9363E]/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="Delete account row"
                            aria-label="Delete account row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* The account's own details. Each account is its own
                            thing: a personal plan and a work plan on the same
                            service cost different amounts and renew on
                            different days. */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-[#64748B] block">
                              Amount
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              aria-label={`Amount for account ${idx + 1}`}
                              placeholder="0.00"
                              value={link.price ?? ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const raw = e.target.value;
                                handleUpdateAccountLink(
                                  link.id,
                                  'price',
                                  raw === '' ? undefined : Number(raw)
                                );
                              }}
                              className="w-full h-9 px-3 py-2 text-xs rounded-lg bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6] transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-[#64748B] block">
                              Cycle
                            </label>
                            <select
                              aria-label={`Cycle for account ${idx + 1}`}
                              value={link.billing_cycle || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleUpdateAccountLink(link.id, 'billing_cycle', e.target.value)
                              }
                              className="w-full h-9 !pl-3 !pr-8 py-2 text-xs rounded-lg bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                            >
                              <option value="" disabled className="bg-[#0D0F0F] text-[#64748B]">
                                Cycle
                              </option>
                              {billingCycles.map((c) => (
                                <option key={c} value={c} className="bg-[#0D0F0F] text-[#F5F7F6] capitalize">
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-[#64748B] block">
                              Category
                            </label>
                            <select
                              aria-label={`Category for account ${idx + 1}`}
                              value={link.category || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleUpdateAccountLink(link.id, 'category', e.target.value)
                              }
                              className="w-full h-9 !pl-3 !pr-8 py-2 text-xs rounded-lg bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                            >
                              <option value="" disabled className="bg-[#0D0F0F] text-[#64748B]">
                                Category
                              </option>
                              {categories.map((c) => (
                                <option key={c} value={c} className="bg-[#0D0F0F] text-[#F5F7F6]">
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-[#64748B] block">
                              Renews
                            </label>
                            <input
                              type="date"
                              aria-label={`Renewal date for account ${idx + 1}`}
                              value={link.next_billing_date || ''}
                              min={MIN_DATE}
                              max={MAX_DATE}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleUpdateAccountLink(link.id, 'next_billing_date', e.target.value)
                              }
                              className="w-full h-9 px-3 py-2 text-xs rounded-lg bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors"
                            />
                          </div>
                        </div>

                        {/* Account URL */}
                        <div className="space-y-2">
                          <label
                            htmlFor={`account-url-${link.id}`}
                            className="text-[13px] font-medium text-[#94A3B8] block"
                          >
                            Account URL
                            <span className="text-[11px] font-normal text-[#64748B] ml-1.5 select-none">
                              (Optional)
                            </span>
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

            {/* Notes */}
            <div className="space-y-2 pt-1">
              <label className="text-[13px] font-medium text-[#94A3B8] block">
                Notes <span className="text-[11px] font-normal text-[#64748B] ml-1.5 select-none">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none"
              />
            </div>
          </form>
      </Sheet>
    </>
  );
}

