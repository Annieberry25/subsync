'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, Plus, Trash2, ChevronLeft, ExternalLink } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { 
  type SubscriptionRow, 
  type SubscriptionInsert,
  type AccountLink,
  getKnownProviderWebsite,
  parseAccountLinks,
  cleanNotesUserText,
  formatNotesWithAccountLinks,
  getSubscriptionHistoryState,
  parseAttachedReceipts,
} from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';
import { ServiceIcon } from '@/components/ui/service-icon';

import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { usePlan, useAuth } from '@/lib/contexts/user-settings-context';
import { hasReachedAccountLinkCap } from '@/lib/constants/plan-limits';
import { normalizeSubscriptionName } from '@/lib/services/receipt-discovery';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { storeReceiptFile } from '@/lib/services/receipt-storage';
import { addCycleToDate } from '@/lib/utils/billing-dates';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSave: (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => Promise<string | null>;
  initialData?: SubscriptionRow | null;
  /** File carried over from the receipt import step, uploaded after save. */
  pendingReceiptFile?: File | null;
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
 * Fills in what an account does not carry from the subscription it belongs to.
 *
 * Only for a subscription with one account: then the account and the
 * subscription are the same thing, so the account's boxes show what the
 * subscription says. Once there are several accounts the row's amount is their
 * total and the row's date is the soonest of them, so neither belongs to any
 * single one of them — and an account that was never given a value of its own
 * shows an empty box rather than a figure nobody entered.
 */
function withRowDefaults(links: AccountLink[], row: SubscriptionRow): AccountLink[] {
  /* Only a subscription with one account can lend its values to that account:
     once there are several, the row's amount is their total and the row's date
     is the soonest of them, so neither belongs to any single one of them. */
  if (links.length !== 1) return links;

  return links.map((link) => ({
    ...link,
    price: link.price ?? (Number(row.price) || undefined),
    currency: link.currency || row.currency || undefined,
    billing_cycle: link.billing_cycle || row.billing_cycle || undefined,
    category: link.category || row.category || undefined,
    status: link.status || row.status || undefined,
    start_date: link.start_date || row.start_date || undefined,
    next_billing_date: link.next_billing_date || row.next_billing_date || undefined,
  }));
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
  existingSubscriptions = [],
  focusAccountId = null,
}: SubscriptionModalProps) {
  const { toast } = useToast();
  const { planTier } = usePlan();
  /* The account-link enforcement runs against the tier, but only isAdmin may
     hold a second account while the multi-account feature stays unreleased —
     so the admin flag rides along to every cap check below. */
  const { isAdmin } = useAuth();

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
  const [autoRenew, setAutoRenew] = useState(true);
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

  /**
   * Whether the account's URL box is open.
   *
   * It is closed until the user opens it with the plus on "Add account
   * link" — a box the user did not ask for, sitting between them and the
   * form, is a box that shows up uninvited.
   */
  const [accountUrlOpen, setAccountUrlOpen] = useState(false);

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

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  /**
   * Which row the form is on, and which version of it.
   *
   * The form resets when the row it is editing changes on the server, not
   * when the object it was handed happens to be a new one. A list refresh —
   * which happens whenever a subscription is written anywhere, including in
   * another tab — used to hand the form a new object and wipe whatever the
   * user had typed into it.
   */
  const initialKey = initialData
    ? `${initialData.id}:${initialData.updated_at ?? ''}`
    : null;
  const [prevInitialKey, setPrevInitialKey] = useState<string | null>(null);

  /**
   * The subscription the typed name already belongs to.
   *
   * Set the moment the name matches one the user tracks, and it is what turns
   * this form into the "add another account" form. It is also the row the
   * save writes to, so no second row is ever created for a service that is
   * already on the list.
   */
  const [duplicateOf, setDuplicateOf] = useState<SubscriptionRow | null>(null);

  if (isOpen !== prevIsOpen || initialKey !== prevInitialKey) {
    setPrevIsOpen(isOpen);
    setPrevInitialKey(initialKey);
    if (initialData) {
      setName(initialData.name);
      setPrice(initialData.price.toString());
      setCurrency(initialData.currency);
      setBillingCycle(initialData.billing_cycle as typeof billingCycles[number]);
      setCategory(initialData.category as typeof categories[number]);
      setStatus(initialData.status as typeof statuses[number]);
      setStartDate(initialData.start_date || '');
      /* The renewal date the box holds is the automatic one: a cycle after
         the start date, unless a yearly (or other) cycle was chosen. Reading
         the stored value here would answer with whatever the row has been
         through in the past — a subscription made on 15/10/2026 must open
         with 15/11/2026 in its monthly box, never with a day the date has
         since been shifted to. The start date and the cycle are what the
         renewal is decided by, so the box answers from them; a row whose
         store and rule disagreed is set right the moment it is opened and
         saved again. A row with no start date of its own keeps its stored
         day, because there is nothing automatic to work it out from. */
      const rowStartDate = initialData.start_date || '';
      const rowCycle = initialData.billing_cycle || '';
      setNextBillingDate(
        rowStartDate && rowCycle
          ? addCycleToDate(rowStartDate, rowCycle) || initialData.next_billing_date || ''
          : initialData.next_billing_date || ''
      );
      setAutoRenew(initialData.auto_renew === true);
      
      const actualProviderUrl = initialData.provider_url ? initialData.provider_url.trim() : '';
      setProviderUrl(actualProviderUrl);
      setIsUserEditedUrl(Boolean(actualProviderUrl));
      
      const links = withRowDefaults(parseAccountLinks(initialData), initialData);
      /* The account the form opens on: the one the user came from, or the
         first one. Its type is what the Account Type box shows, and its
         amount and date are what the main fields show — the main fields
         describe the account in view, not the subscription as a whole. */
      const openingAccount =
        links.find((link) => link.id === focusAccountId) ?? links[0] ?? null;

      setAccountLinks(links);
      setActiveAccountId(openingAccount?.id ?? null);
      setAccountType(openingAccount?.label || '');
      /* The main fields describe the account in view, so they open on that
         account's own values — the amount it was given, the day it renews.
         Nothing is filled in on their behalf: an account that was never given
         an amount shows an empty box, not the subscription's total. */
      if (openingAccount) {
        setPrice(openingAccount.price !== undefined ? String(openingAccount.price) : '');
        setCurrency(openingAccount.currency || '');
        setBillingCycle(
          (openingAccount.billing_cycle as typeof billingCycles[number]) || ''
        );
        setCategory((openingAccount.category as typeof categories[number]) || '');
        setStatus((openingAccount.status as typeof statuses[number]) || '');
        setStartDate(openingAccount.start_date || '');
        /* Same rule for the account in view: the automatic renewal date,
           a cycle after the start, not the day the account's record has
           been carrying around. */
        const accountStartDate = openingAccount.start_date || initialData.start_date || '';
        const accountCycle = openingAccount.billing_cycle || initialData.billing_cycle || '';
        setNextBillingDate(
          accountStartDate && accountCycle
            ? addCycleToDate(accountStartDate, accountCycle) || openingAccount.next_billing_date || ''
            : openingAccount.next_billing_date || ''
        );
      }
      setNotes('');
      setExistingNotesText(cleanNotesUserText(initialData.notes));
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
      setAutoRenew(false);
      setProviderUrl('');
      setIsUserEditedUrl(false);
      setAccountLinks([]);
      setAccountType('');
      setNotes('');
      setExistingNotesText('');
    }
    setDuplicateOf(null);
    setFieldErrors({});
    setAccountUrlOpen(false);
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

    const existing = withRowDefaults(parseAccountLinks(match), match);
    const newLinkId = nextAccountLinkId(existing);

    setAccountLinks([
      ...existing,
      {
        id: newLinkId,
        /*
         * No type yet. The type is the user's to choose — a personal plan and
         * a work plan are different accounts — and the Account Type box is
         * empty until they do.
         */
        label: '',
        /*
         * Empty on purpose: the box is for the user's own account link. The
         * arrow beside it opens the provider's account page.
         */
        url: '',
      },
    ]);

    /* The new account is the one the form works on, and its type is the one
       the Account Type box shows. */
    setActiveAccountId(newLinkId);
    setAccountType('');
  };

  /**
   * The plus on "Add account link".
   *
   * The first job of the click is to open the account's URL box: the box is
   * what is closed, and this is what the user opens it with. While the box
   * was closed the click never adds an account — an account the form already
   * has is shown in the box instead, and adding a second one on top of it is
   * not what "open the box" means.
   *
   * A click that meets the box open is the one that adds another account,
   * behind the tier's account-link cap.
   */
  const handleAddAccountLink = () => {
    if (!accountUrlOpen) {
      /* No account yet — a fresh form, or one whose link was deleted. The
         click that opens the box also creates the account to show in it,
         with the details the user is looking at. */
      if (accountLinks.length === 0) {
        const id = `link-${Date.now()}`;
        setAccountLinks((prev) => [
          ...prev,
          {
            id,
            /* The type the user picked in the form, if they picked one. The
               type is the user's to choose — a personal plan and a work plan
               are different accounts — so the box is empty until they do. */
            label: accountType || '',
            /*
             * The account starts with the details the form is holding, which
             * is what the user is looking at when they add it.
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
             * This box is for the user's own account link. The provider's
             * link is what the arrow beside it opens, and putting the
             * provider's link in here made it impossible to tell which one
             * the box was holding.
             */
            url: '',
          },
        ]);
        setActiveAccountId(id);
      }
      setAccountUrlOpen(true);
      return;
    }

    /* One account per subscription: the second account is the Plus feature
       that has not been released yet, so the check happens on the click rather
       than at save, and the user is told while looking at the control. Admins,
       who preview every feature, are not stopped. */
    if (hasReachedAccountLinkCap({ tier: planTier, linkCount: accountLinks.length, isAdmin })) {
      toast.info(
        'Multiple accounts per subscription arrive with the Plus release. For now, each subscription tracks one account.',
        'Coming with Plus'
      );
      return;
    }

    const newId = `link-${Date.now()}`;
    setAccountLinks((prev) => [
      ...prev,
      {
        id: newId,
        /* The type the user picked in the form, if they picked one. The type is
           the user's to choose — a personal plan and a work plan are different
           accounts — so the box is empty until they do. */
        label: accountType || '',
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
    setActiveAccountId(newId);
    setAccountUrlOpen(true);
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

  /**
   * Removes the account in view.
   *
   * The delete sits on the account URL line, after the provider link — the
   * account's link and the way to remove it are the same line. The account's
   * type is not what gets deleted.
   */
  const handleRemoveAccountLink = (id: string) => {
    setAccountLinks((prev) => prev.filter((item) => item.id !== id));
    setActiveAccountId((current) => (current === id ? null : current));
    /* The box belongs to the account it was showing. With the account gone
       the box closes too: it never turns itself into the next account's link
       without being opened again. */
    setAccountUrlOpen(false);
  };

  /**
   * A change to the main fields, when they are describing an account.
   *
   * The two are one thing, so a change in one is a change in the other. This is
   * what stops an amount typed in the form and an amount typed in the account
   * row from going to two different places, and the account being edited from
   * keeping the other's value.
   */
  const applyToActiveAccount = (patch: Partial<AccountLink>) => {
    if (!activeAccountId) return;
    setAccountLinks((prev) =>
      prev.map((link) => (link.id === activeAccountId ? { ...link, ...patch } : link))
    );
  };

  /** The account in view: the one the form is describing. */
  const activeAccount =
    accountLinks.find((link) => link.id === activeAccountId) ?? accountLinks[0] ?? null;

  /**
   * Where the arrow beside the link box goes.
   *
   * The subscription's own provider page — the place the user signs in to
   * change or cancel the subscription. It is not the account's link: the box
   * holds the user's link, and the arrow opens the provider.
   */
  const providerLink = (() => {
    const raw = providerUrl ? providerUrl.trim() : '';
    const candidate = raw || getKnownProviderWebsite(name) || '';
    if (!candidate) return null;
    return candidate.startsWith('http://') || candidate.startsWith('https://')
      ? candidate
      : `https://${candidate}`;
  })();

  /**
   * The account's link, changed in its own box.
   *
   * With no account yet, a link typed in the box is the first account. And
   * clearing the link removes the account: the box is the account's link, so
   * an account with no link is not an account the user meant to keep.
   */
  const handleAccountUrlChange = (value: string) => {
    if (activeAccount) {
      if (value.trim() === '' && (activeAccount.url || '').trim() !== '') {
        setAccountLinks((prev) => prev.filter((link) => link.id !== activeAccount.id));
        setActiveAccountId(null);
        setAccountUrlOpen(false);
        return;
      }
      handleUpdateAccountLink(activeAccount.id, 'url', value);
      return;
    }
    const id = `link-${Date.now()}`;
    setAccountLinks([
      ...accountLinks,
      {
        id,
        label: accountType || 'Personal',
        url: value,
        price: price ? Number(price) : undefined,
        currency: currency || undefined,
        billing_cycle: billingCycle || undefined,
        category: category || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        next_billing_date: nextBillingDate || undefined,
      },
    ]);
    setActiveAccountId(id);
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
     badge and the inline coming-soon hint. Derived rather than stored so
     removing a row immediately re-enables the button. */
  const canAddAnotherAccount = !hasReachedAccountLinkCap({
    tier: planTier,
    linkCount: accountLinks.length,
    isAdmin,
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
   * The start date is just when the subscription began. It no longer rewrites
   * the next billing date: the renewal date is the actual next billing date the
   * user entered (or the account's own), not a date worked out from the start.
   */
  const formatDMY = (iso: string | undefined | null) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  /**
   * The start date a subscription is made on decides the renewal date:
   * started on 15/10/2026, it renews a cycle later (15/11/2026 for monthly,
   * 15/10/2027 for a yearly). The box follows the start the moment it is
   * picked, and the cycle picked for it — monthly when nothing was picked
   * yet.
   */
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (fieldErrors.startDate) setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
    if (value) {
      const next = addCycleToDate(value, billingCycle || 'monthly');
      if (next) {
        setNextBillingDate(next);
        if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
      }
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

    /* The account type is mandatory for every subscription: without it the
       row's account has no label, and an untyped account would be dropped
       silently. */
    const accountTypeError = validateChoice(accountType, 'Account type');
    if (accountTypeError) errors.accountType = accountTypeError;

    if (accountLinks.length > 0) {
      const untyped = accountLinks.some((link) => !link.label || !link.label.trim());
      if (untyped) errors.accountType = 'Every account needs a type.';
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
     * Another account is the Plus feature that has not been released yet. A
     * plan that is already at its one-account cap is told so here, at the
     * moment of the save, instead of being allowed to save a form whose only
     * point was the extra account.
     */
    if (
      saveTarget &&
      duplicateOf &&
      hasReachedAccountLinkCap({
        tier: planTier,
        linkCount: parseAccountLinks(saveTarget).length,
        isAdmin,
      })
    ) {
      toast.info(
        'Multiple accounts per subscription arrive with the Plus release. For now, each subscription tracks one account.',
        'Coming with Plus'
      );
      return;
    }

setLoading(true);
    const parsedPrice = parseFloat(price);

    // Filter valid account links (must have a label or url)
    const validAccountLinks = accountLinks.filter(
      (link) => (link.label && link.label.trim().length > 0) || (link.url && link.url.trim().length > 0)
    );

    /*
     * The accounts keep the details that were typed in their own rows, and the
     * subscription keeps the details that were typed in the main fields.
     *
     * Nothing is copied between them. Copying the main fields onto an account
     * is how one account ended up with another account's amount and date, and
     * how the second account ended up with the first one's details.
     */
    const accountsWithFormValues = validAccountLinks;

    /*
     * Every subscription keeps at least one account link so its account type,
     * category, cycle and dates have a place to live. If the user gave the
     * account a type (or any account detail) but never typed an account URL,
     * synthesize that one link from the form fields instead of dropping them
     * on save — otherwise the detail sheet would show "Not set" for category
     * and account type, and the renew button would fall back to the row's
     * stored cycle instead of the one the user picked.
     */
    if (
      accountsWithFormValues.length === 0 &&
      (accountType.trim() || category.trim() || billingCycle.trim() || nextBillingDate.trim())
    ) {
      accountsWithFormValues.push({
        id: `link-${Date.now()}`,
        label: accountType.trim() || 'Personal',
        url: '',
        price: parsedPrice ? Number(parsedPrice) : undefined,
        currency: currency || undefined,
        billing_cycle: billingCycle || undefined,
        category: category || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        next_billing_date: nextBillingDate || undefined,
      });
    }
    const firstAccount = accountsWithFormValues[0];

    /*
     * The subscription is what its accounts add up to.
     *
     * Two accounts on one service are two charges, so the amount is the sum of
     * what each of them costs, and the renewal date is the soonest of them —
     * the next one to warn about. A subscription with no accounts is what the
     * form says.
     */
    const accountAmounts = accountsWithFormValues
      .map((link) => link.price)
      .filter((value): value is number => typeof value === 'number' && !isNaN(value));
    const everyAccountPriced =
      accountsWithFormValues.length > 0 &&
      accountAmounts.length === accountsWithFormValues.length;
    const accountDates = accountsWithFormValues
      .map((link) => link.next_billing_date)
      .filter((value): value is string => Boolean(value))
      .sort();
    const accountStarts = accountsWithFormValues
      .map((link) => link.start_date)
      .filter((value): value is string => Boolean(value))
      .sort();

    const rowPrice =
      accountsWithFormValues.length > 0
        ? /* The sum, once every account says what it costs. Until then the
             subscription keeps the amount it has: a total built from the
             accounts that happen to be filled in would quietly take money out
             of it. */
          everyAccountPriced
          ? accountAmounts.reduce((sum, value) => sum + value, 0)
          : saveTarget
            ? Number(saveTarget.price) || 0
            : parsedPrice
        : parsedPrice;
    const rowNextBillingDate =
      accountDates.length > 0 ? accountDates[0] : nextBillingDate;
    const rowStartDate =
      accountStarts.length > 0 ? accountStarts[0] : startDate || null;

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
          start_date: rowStartDate,
          /*
           * The form has no end date any more, so the value on the row is
           * carried through untouched rather than being quietly cleared.
           */
          end_date: saveTarget ? saveTarget.end_date ?? null : null,
          next_billing_date: rowNextBillingDate,
          payment_method: null,
          auto_renew: autoRenew,
          provider_url: providerUrl.trim() || null,
          account_links: accountsWithFormValues,
          notes: formattedNotes,
        },
        saveTarget?.id
      );

      // null means the caller handled the submit itself (e.g. the save was
      // refused by a gate above) — do not toast success or close.
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
                    applyToActiveAccount({
                      price: e.target.value ? Number(e.target.value) : undefined,
                    });
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
                    applyToActiveAccount({ currency: e.target.value });
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
                    const picked = e.target.value as typeof categories[number] | '';
                    setCategory(picked);
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
                    const picked = e.target.value as typeof statuses[number] | '';
                    setStatus(picked);
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
                  onChange={(e) => {
                    const picked = e.target.value;
                    handleStartDateChange(picked);
                    applyToActiveAccount({ start_date: picked || undefined });
                  }}
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
                  const picked = e.target.value;
                  setNextBillingDate(picked);
                  applyToActiveAccount({ next_billing_date: picked || undefined });
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
              {/*
                The auto-renewal information belongs to the flag, and to the
                box above it: the period the row is in, as the renewal date in
                the box and the one after it. It is worked out from the box, so
                the box keeps the date the user entered and the line only says
                what the flag promises. With the flag off the line is not
                there — and the date in the box is untouched by it either way.
              */}
              {autoRenew && nextBillingDate && (
                <span data-testid="auto-renew-period" className="text-[11px] text-[#94A3B8] block mt-1">
                  {`${formatDMY(nextBillingDate)}-${formatDMY(addCycleToDate(nextBillingDate, billingCycle || 'monthly'))}`}
                </span>
              )}
            </div>

            {/* No Provider URL input. The website is resolved from the provider
                name and the account-link table, so asking for it by hand only
                produced values that disagreed with the ones SubHalt already
                knew. `providerUrl` is still derived and still saved — it just
                has no field of its own. See handleNameChange. */}

            {/* Account Type. A field of the form, not a control under the
                account links: it says what the account is for. The type is
                not what gets deleted — the link is. */}
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
                    !accountUrlOpen
                      ? 'Show the account link box'
                      : canAddAnotherAccount
                        ? 'Add another account link'
                        : 'Multiple accounts per subscription are coming to Plus'
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
                  One account per subscription for now. Multiple accounts — family, work, or a
                  second profile — are coming to SubHalt Plus soon.
                </p>
              )}

              {/*
                The account in view.
               *
                One link box, for the account being worked on. Its type, amount
                and renewal are in the form above, and the other accounts keep
                theirs — they come back when they are the one in view.
               */}
              {/*
                The account's link box.
               *
                It is closed until the user opens it with the plus, and the
                delete beside it takes the account away again. The arrow is the
                subscription's provider page, not the account's link.
               */}
              {accountUrlOpen && activeAccount && (
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#94A3B8] block">
                    Account URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      aria-label="Account URL"
                      placeholder=""
                      value={activeAccount.url || ''}
                      onChange={(e) => handleAccountUrlChange(e.target.value)}
                      className="flex-1 h-11 px-4 py-2.5 text-xs rounded-xl bg-[#0D0F10] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6] transition-colors"
                    />
                    {providerLink ? (
                      <a
                        href={providerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-11 w-11 shrink-0 rounded-xl bg-[#0D0F10] border border-[#1A1D1D] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer"
                        title={`Open ${name || 'the provider'}'s page in a new tab`}
                        aria-label={`Open ${name || 'provider'} in a new tab`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Type a provider name above so we can open its page"
                        className="h-11 w-11 shrink-0 rounded-xl bg-[#0D0F10] border border-[#1A1D1D] text-[#94A3B8] flex items-center justify-center transition-colors opacity-40 cursor-not-allowed"
                        aria-label="No provider page available yet"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveAccountLink(activeAccount.id)}
                      className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-[#D9363E] hover:bg-[#D9363E]/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Delete this account"
                      aria-label="Delete this account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Auto Renewal */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#94A3B8] block">Auto renewal</label>
              <button
                type="button"
                onClick={() => setAutoRenew((prev) => !prev)}
                aria-pressed={autoRenew}
                aria-label="Auto renewal"
                className={`w-full h-11 px-4 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border transition-colors cursor-pointer ${
                  autoRenew
                    ? 'bg-[#1F2425] text-[#F5F7F6] font-semibold border-[#2A3032]'
                    : 'bg-[#0D0F0F] text-[#94A3B8] border-[#1A1D1D] hover:bg-[#1A1D1D] hover:text-[#F5F7F6]'
                }`}
              >
                <span>The subscription renews itself automatically</span>
                <span className={`text-xs font-semibold ${autoRenew ? 'text-[#14B8A6]' : ''}`}>
                  {autoRenew ? 'On' : 'Off'}
                </span>
              </button>
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

