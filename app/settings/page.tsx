'use client';
import { safeRemoveItem } from '@/lib/safe-local-storage';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  getPushPermissionState,
  isPushSupported,
  enablePushNotifications,
  disablePushNotifications,
  hasPushSubscription,
  type PushPermissionState,
} from '@/lib/push/client';
import { signOutAndRedirect } from '@/lib/auth/sign-out';
import {
  User,
  ArrowUpCircle,
  Sliders,
  Globe,
  Moon,
  Lock,
  Download,
  Database,
  HelpCircle,
  FileText,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Loader2,
  Mail,
  Bell,
  Smartphone,
  Palette,
  ChevronLeft,
  ChevronRight,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useTheme, type Theme } from '@/lib/hooks/use-theme';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import { recoverPlusPurchase, syncPlusPurchaseRecord } from '@/lib/services/plan-service';
import {
  PLUS_PLAN,
  SUBHALT_SUBSCRIPTION_NAME,
  buildPlusSubscriptionRecord,
} from '@/lib/constants/plus-plan';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import {
  fetchSubscriptions,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { AddPaymentModal } from '@/components/settings/add-payment-modal';
import { PaymentResultSheet, type PaymentResultState } from '@/components/settings/payment-result-sheet';
import { LegalModal } from '@/components/settings/legal-modal';
import { EditBillingModal } from '@/components/settings/edit-billing-modal';
import { CategoryManager } from '@/components/settings/category-manager';
import { DeleteAccountModal } from '@/components/settings/delete-account-modal';
import { CustomSelect } from '@/components/ui/custom-select';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import Sheet from '@/components/ui/sheet';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { CardIcon } from '@/components/ui/card-icons';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
import { IntegrationsSettingsPanel } from '@/components/integrations/integrations-settings-panel';
import { FROM_SETTINGS } from '@/lib/back-nav';

type SettingsSection = 'account' | 'plan' | 'integrations' | 'preferences' | 'privacy' | 'help';

/** Long-form end-of-period date, in the same wording as the payment sheet. */
function formatPlanEndDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'the end of your billing period';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A borderless list container; rows are separated by hairlines unless `divided` is false. */
function SettingsGroup({
  children,
  className = '',
  divided = true,
}: {
  children: React.ReactNode;
  className?: string;
  divided?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden ${
        divided ? 'divide-y divide-[#1A1D1D]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** OPay-style read-only row: label on the left, value on the right. */
function DataRow({
  label,
  value,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 min-h-[56px] pl-4 pr-5 ${
        divider ? 'border-b border-white/[0.04]' : ''
      }`}
    >
      <span className="text-sm text-[#94A3B8] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#F5F7F6] text-right truncate min-w-0">{value}</span>
    </div>
  );
}

/** OPay-style action row: label on the left, trailing chevron on the right. */
function ActionRow({
  label,
  href,
  onClick,
  danger = false,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className = `w-full flex items-center justify-between gap-4 min-h-[56px] px-4 transition-colors hover:bg-[#121414] cursor-pointer ${
    danger ? 'text-[#D9363E]' : 'text-[#F5F7F6]'
  }`;
  const content = (
    <>
      <span className="text-sm font-medium">{label}</span>
      <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

interface SettingsRowProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  iconClassName?: string;
  children?: React.ReactNode;
}

/** A single minimalist settings row: leading icon, label(s), trailing control. */
function SettingsRow({
  icon: Icon,
  title,
  description,
  iconClassName = 'text-[#94A3B8]',
  children,
}: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && <Icon className={`w-5 h-5 shrink-0 ${iconClassName}`} aria-hidden="true" />}
        <div className="min-w-0">
          <span className="text-sm font-medium text-[#F5F7F6] block">{title}</span>
          {description && (
            <span className="text-[11px] text-[#94A3B8] block">{description}</span>
          )}
        </div>
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const sectionParam = (searchParams.get('section') as SettingsSection) || 'account';
  const [activeSection, setActiveSection] = useState<SettingsSection>(sectionParam);
  
  // Mobile two-level navigation state: null = showing category list screen; non-null = viewing specific section page
  const [mobileSectionView, setMobileSectionView] = useState<SettingsSection | null>(
    searchParams.has('section') ? sectionParam : null
  );

  // Sync section from URL param (render-phase adjustment).
  const [prevSectionParam, setPrevSectionParam] = useState(sectionParam);
  if (sectionParam !== prevSectionParam) {
    setPrevSectionParam(sectionParam);
    setActiveSection(sectionParam);
    setMobileSectionView(sectionParam);
  }

  const {
    defaultCurrency,
    fullName,
    email,
    avatarColor,
    notificationPreferences,
    isPlus,
    planExpiresAt,
    billingDetails,
    paymentMethods,
    billingTransactions: _billingTransactions,
    updateDefaultCurrency,
    updateNotificationPreferences,
    updatePlanTier,
    deletePaymentMethod,
  } = useUserSettings();
  const { addInboxItem } = useInbox();

  const [isEditBillingOpen, setIsEditBillingOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isViewSubscriptionOpen, setIsViewSubscriptionOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [subscriptionsLoaded, setSubscriptionsLoaded] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResultState | null>(null);
  const [paymentPlanExpiresAt, setPaymentPlanExpiresAt] = useState<string | null>(null);
  const [paymentListed, setPaymentListed] = useState(false);
  const billedResultHandled = useRef(false);
  const subhaltRowEnsured = useRef(false);
  /* Set once a cancellation is accepted by the server, so the button becomes an
     "ends on" line instead of inviting a second cancellation. Session-scoped on
     purpose: re-reading it on load would need a client-readable cancelled flag,
     and the server already refuses to act twice. */
  const [cancelScheduledUntil, setCancelScheduledUntil] = useState<string | null>(null);

  /* Push permission, read from the browser rather than stored: it is a property
     of this device and this browser, and can be revoked outside the app at any
     time, so a persisted flag would report notifications as on when they cannot
     arrive. */
  const [pushPermission, setPushPermission] = useState<PushPermissionState>('default');
  const [pushSupported, setPushSupported] = useState(true);
  /* Whether this device is actually registered with the server. Deliberately not
     the same as permission: permission can be granted while the subscription was
     never stored, and that combination would render an ON switch that delivers
     nothing. */
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToggling, setPushToggling] = useState(false);

  useEffect(() => {
    // Deferred rather than read synchronously in the effect body: a setState that
    // runs immediately after mount is a cascading render, and it would also make
    // the client's first paint disagree with the server's — the switch's
    // aria-checked would flip right after hydration. A microtask lands before
    // paint and the browser reads the same value either way.
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPushSupported(isPushSupported());
      setPushPermission(getPushPermissionState());
      void hasPushSubscription().then((subscribed) => {
        if (active) setPushEnabled(subscribed);
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Account Deletion States
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isAccountDeletedOpen, setIsAccountDeletedOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Privacy & Data states
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState('#14B8A6');

  // Legal Modal States
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  const supabase = createClient();

  const loadSubData = useCallback(async () => {
    const { data } = await fetchSubscriptions();
    if (data) setSubscriptions(data);
    setSubscriptionsLoaded(true);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadSubData());
  }, [loadSubData]);

  // View model for the "SubHalt subscription" detail modal. Prefer the real
  // SubHalt row created after a Paystack purchase; otherwise fall back to a
  // record derived from the plan definition (no hardcoded dates).
  const subhaltFallback = buildPlusSubscriptionRecord({
    paymentMethod: paymentMethods[0]?.brand || 'Card',
  });
  const subhaltSubscription: SubscriptionRow | null =
    subscriptions.find((s) => s.name.toLowerCase().trim() === 'subhalt') ||
    (isPlus
      ? {
          id: 'subhalt_local_subscription',
          user_id: '',
          ...subhaltFallback,
          end_date: null,
          account_links: null,
          receipts: null,
          is_synced: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null);

  const refreshPlanState = useCallback(async (): Promise<{
    active: boolean;
    expiresAt: string | null;
  }> => {
    // The plan tier lives in the session metadata and the context only re-reads
    // it on an auth event, so the session has to be refreshed before anything
    // else — otherwise the UI stays on Free even though the server already
    // granted the plan.
    try {
      const { data } = await supabase.auth.refreshSession();
      const metadata = data.session?.user?.user_metadata ?? {};
      const tier = metadata.plan_tier;
      return {
        active: tier === 'plus' || tier === 'premium',
        expiresAt: typeof metadata.plan_expires_at === 'string' ? metadata.plan_expires_at : null,
      };
    } catch {
      return { active: false, expiresAt: null };
    }
  }, [supabase]);

  const settlePaymentResult = useCallback(async () => {
    setPaymentResult('checking');

    let state = await refreshPlanState();
    if (!state.active) {
      await recoverPlusPurchase();
      state = await refreshPlanState();
    }
    if (!state.active) {
      // The webhook may still be in flight; give it one short window to land
      // before deciding what to tell the customer.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await recoverPlusPurchase();
      state = await refreshPlanState();
    }

    subhaltRowEnsured.current = true;
    if (!state.active) {
      // The charge exists but the grant has not landed yet. Recording it in the
      // inbox means the customer is told the payment was seen even if they walk
      // away from this page; the "active" notice is posted by the server once
      // the grant completes, so both ends of the delay reach the inbox.
      addInboxItem({
        type: 'plan_update',
        title: `${PLUS_PLAN.name} payment received`,
        description:
              "We're confirming your payment with Paystack. Your plan activates automatically as soon as it is verified. No action needed.",
        actionType: 'view',
        actionLabel: 'View subscription',
        subscriptionName: SUBHALT_SUBSCRIPTION_NAME,
      });
      setPaymentResult('pending');
      return;
    }

    // The context only re-reads the tier on an auth event, so without this the
    // confirmation can sit in the inbox while the app still renders Free until
    // the next reload. Setting it here makes premium land immediately.
    await updatePlanTier('plus');
    setPaymentPlanExpiresAt(state.expiresAt);
    let listed = false;
    try {
      await syncPlusPurchaseRecord({ planExpiresAt: state.expiresAt });
      listed = true;
    } catch {
      toast.warning(
        'Your plan is active, but the SubHalt entry was not added to your subscriptions.',
        'Record Sync Issue'
      );
    }
    setPaymentListed(listed);
    setPaymentResult('success');
    void loadSubData();
  }, [refreshPlanState, addInboxItem, toast, loadSubData, updatePlanTier]);

  // Handle post-checkout results from the Paystack callback route
  // (/settings?section=plan&billing=paid|error|failed).
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (!billing || billedResultHandled.current) return;
    billedResultHandled.current = true;
    router.replace('/settings?section=plan');

    if (billing === 'failed') {
      queueMicrotask(() => setPaymentResult('failed'));
      return;
    }
    if (billing === 'paid' || billing === 'error') {
      queueMicrotask(() => void settlePaymentResult());
    }
  }, [searchParams, router, settlePaymentResult]);

  // The purchase has to show up in the subscription list even when the
  // post-payment bookkeeping never ran (a closed tab, a rejected write).
  useEffect(() => {
    if (!subscriptionsLoaded || !isPlus || subhaltRowEnsured.current) return;
    subhaltRowEnsured.current = true;

    const alreadyListed = subscriptions.some(
      (sub) => sub.name.toLowerCase().trim() === SUBHALT_SUBSCRIPTION_NAME.toLowerCase()
    );
    if (alreadyListed) return;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const expiresAt = data.session?.user?.user_metadata?.plan_expires_at;
        await syncPlusPurchaseRecord({
          planExpiresAt: typeof expiresAt === 'string' ? expiresAt : null,
        });
        await loadSubData();
      } catch {
        toast.warning(
          'Your plan is active, but the SubHalt entry was not added to your subscriptions.',
          'Record Sync Issue'
        );
      }
    })();
  }, [subscriptionsLoaded, isPlus, subscriptions, supabase, loadSubData, toast]);

  const handleCurrencyChange = async (newCurr: string) => {
    try {
      await updateDefaultCurrency(newCurr);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update currency.';
      toast.error(msg, 'Currency Error');
    }
  };

  const handleAccountDeleted = async () => {
    // The account is gone server-side; show the farewell sheet instead of a
    // toast, then redirect to /login only when the user dismisses it.
    setIsAccountDeletedOpen(true);
  };

  const handleFarewellDone = async () => {
    // Clears the caches and performs a hard navigation to /login itself, so there
    // is no client-side push here — see lib/auth/sign-out.ts for why.
    const ok = await signOutAndRedirect();

    if (ok) {
      return;
    }

    // The session cookie survived, so /login would bounce back to the dashboard.
    toast.error('Could not sign you out. Please try again.', 'Sign Out Failed');
  };

  const handleSignOut = async () => {
    const ok = await signOutAndRedirect();
    if (ok) return;
    toast.error('Could not sign you out. Please try again.', 'Sign Out Failed');
  };

  const handleExportData = () => {
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(subscriptions, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `subhalt-portfolio-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      toast.error('Failed to export subscription data.', 'Export Error');
    }
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      safeRemoveItem('subhalt_reminders');
      toast.success('Local cache & reminder preferences purged.', 'Cache Cleared');
    }
  };

  const sectionsList: { id: SettingsSection; label: string; icon: LucideIcon; description: string }[] = [
    { id: 'account', label: 'Account', icon: User, description: 'Profile info, authentication, and security' },
    { id: 'plan', label: 'Plan & Billing', icon: ArrowUpCircle, description: 'Current plan & billing controls' },
    { id: 'integrations', label: 'Integrations', icon: Plug, description: 'Gmail & receipt email forwarding' },
    { id: 'preferences', label: 'Preferences', icon: Sliders, description: 'Currency, theme, notifications & categories' },
    { id: 'privacy', label: 'Privacy & Data', icon: Lock, description: 'Data export, local cache & privacy controls' },
    { id: 'help', label: 'Help & Legal', icon: HelpCircle, description: 'Support resources, terms, and policies' },
  ];

  const handleSelectCategory = (secId: SettingsSection) => {
    setActiveSection(secId);
    setMobileSectionView(secId);
    // Mirror the section into the URL so a sub-page (e.g. /profile, reached via
    // Edit Profile) can be backed out of straight into this section. Without it,
    // Back lands on /settings with no section and mobile shows the category list
    // again. `replace` keeps the category tap out of history.
    router.replace(`/settings?section=${secId}`);
  };

  const handleMobileBackToCategories = () => {
    setMobileSectionView(null);
    router.replace('/settings');
  };

  return (
    <div className="space-y-6 max-w-5xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      <h1 className="sr-only">Settings</h1>

      {/* Header Title. On mobile a drilled-in section owns the top of the screen,
          so this block and its back affordance are hidden while a section is open. */}
      <div className={mobileSectionView !== null ? 'hidden lg:block' : ''}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            data-touch="compact"
            className="w-9 h-9 -ml-2 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer lg:hidden"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">Settings</h1>
        </div>
        <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
          Manage your account security, billing preferences, app configuration, and categories.
        </p>
      </div>

      {/* MOBILE 2-LEVEL NAVIGATION (Visible on mobile < 1024px) */}
      <div className="block lg:hidden">
        {mobileSectionView === null ? (
          /* Mobile Level 1: Category List Screen */
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider px-1">Settings Categories</h2>
            <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden divide-y divide-[#1A1D1D]">
              {sectionsList.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelectCategory(sec.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#121414] transition-colors cursor-pointer group"
                  >
                    <Icon className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] shrink-0 transition-colors" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#F5F7F6]">
                      {sec.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Mobile Level 2: bare back chevron + section title */
          <div className="space-y-6">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleMobileBackToCategories}
                aria-label="Back to settings categories"
                data-touch="compact"
                className="w-9 h-9 -ml-2 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {sectionsList.find((sec) => sec.id === mobileSectionView)?.label}
              </h2>
            </div>

            <div className="space-y-6">
              {/* Render Active Section Content for Mobile */}
              {mobileSectionView === 'plan' && renderBillingSection()}
              {mobileSectionView === 'account' && renderAccountSection()}
              {mobileSectionView === 'integrations' && renderIntegrationsSection()}
              {mobileSectionView === 'preferences' && renderPreferencesSection()}
              {mobileSectionView === 'privacy' && renderPrivacySection()}
              {mobileSectionView === 'help' && renderHelpSection()}
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP CONNECTED PANEL LAYOUT (Visible on lg screens 1024px+) */}
      <div className="hidden lg:flex rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden min-h-[600px] max-h-[750px]">
        {/* Left Settings Navigation Column (Fixed surface, no scrollbar) */}
        <nav
          className="settings-nav w-64 border-r border-[#1A1D1D] p-3 space-y-1 shrink-0 flex flex-col justify-start bg-[#0B0D0D] overflow-hidden"
        >
          {sectionsList.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectCategory(sec.id)}
                data-active={isActive ? 'true' : 'false'}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#1A1D1D] text-[#F5F7F6]'
                    : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#121414]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'}`} />
                <div className="min-w-0">
                  <span className="block truncate">{sec.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right Settings Content Area (Only content area scrolls) */}
        <div className="flex-1 p-7 overflow-y-auto max-h-[750px] space-y-6 bg-[#0B0D0D]">
          {activeSection === 'plan' && renderBillingSection()}
          {activeSection === 'account' && renderAccountSection()}
          {activeSection === 'integrations' && renderIntegrationsSection()}
          {activeSection === 'preferences' && renderPreferencesSection()}
          {activeSection === 'privacy' && renderPrivacySection()}
          {activeSection === 'help' && renderHelpSection()}
        </div>
      </div>

      {/* Modals & Dialogs */}
      {/* Account Deletion (re-auth protected) */}
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        onDeleted={handleAccountDeleted}
      />

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleSignOut}
        title="Log out?"
        description="You'll need to sign in again to access your subscriptions and reminders on this device."
        confirmText="Log out"
        cancelText="Stay signed in"
        variant="danger"
      />

      {/* Goodbye after successful deletion (small sheet, sized like checkouts).
          Dismissing it signs out and hard-redirects to /login. */}
      <Sheet
        open={isAccountDeletedOpen}
        onClose={handleFarewellDone}
        size="sm"
        footer={
          <div className="flex items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleFarewellDone}
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold bg-[#14B8A6] hover:bg-[#0D9488] text-white transition-colors cursor-pointer"
            >
              Take Care
            </button>
          </div>
        }
      >
        <div className="text-center py-2 space-y-3">
          <p className="text-sm font-semibold text-[#F5F7F6]">Account Deleted</p>
          <p className="text-xs leading-relaxed text-[#94A3B8]">
            Hey friend! Thank you for staying in our hut for a while. We hope to have you back
            someday. Take care!
          </p>
        </div>
      </Sheet>

      <LegalModal
        isOpen={!!legalModalType}
        onClose={() => setLegalModalType(null)}
        type={legalModalType}
      />

      <EditBillingModal
        isOpen={isEditBillingOpen}
        onClose={() => setIsEditBillingOpen(false)}
      />

      <AddPaymentModal
        isOpen={isAddPaymentOpen}
        onClose={() => setIsAddPaymentOpen(false)}
      />

      <SubscriptionDetailModal
        subscription={subhaltSubscription}
        isOpen={isViewSubscriptionOpen}
        onClose={() => setIsViewSubscriptionOpen(false)}
        onEdit={() => {}}
        onDeleteRequest={() => {}}
        onPaymentReminderRequest={() => {}}
      />

      <PaymentResultSheet
        state={paymentResult}
        planExpiresAt={paymentPlanExpiresAt}
        subscriptionListed={paymentListed}
        onClose={() => setPaymentResult(null)}
        onRecheck={() => void settlePaymentResult()}
      />
    </div>
  );

  /* SECTION RENDER HELPERS */

  // 1. BILLING SECTION
  function renderBillingSection() {
    return (
      <section className="space-y-6">
        <div className="hidden lg:block">
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Plan &amp; Billing</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Your current plan and billing controls</p>
        </div>

        <SettingsGroup divided={false}>
          <SettingsRow
            title={isPlus ? 'SubHalt Plus' : 'SubHalt Free'}
            description={isPlus ? undefined : 'Intelligence for everyday tasks'}
          >
            {isPlus ? (
              <button
                type="button"
                onClick={() => setIsViewSubscriptionOpen(true)}
                className="text-xs font-semibold text-[#F5F7F6] hover:underline cursor-pointer"
              >
                View
              </button>
            ) : (
              <Link
                href={`/plans?from=${encodeURIComponent('/settings?section=plan')}`}
                className="text-xs font-semibold text-[#F5F7F6] hover:underline"
              >
                Upgrade
              </Link>
            )}
          </SettingsRow>
        </SettingsGroup>

        {isPlus && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Billing information
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditBillingOpen(true)}
                  className="text-xs font-semibold text-[#F5F7F6] hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>

              <SettingsGroup divided={false}>
                <div className="px-4 py-3">
                  <span className="text-[11px] text-[#94A3B8] block">Billing email</span>
                  <span className="text-sm font-medium text-[#F5F7F6]">
                    {billingDetails?.email || email || 'Not set'}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <span className="text-[11px] text-[#94A3B8] block">Name</span>
                  <span className="text-sm font-medium text-[#F5F7F6]">
                    {billingDetails?.fullName || fullName || 'Not set'}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <span className="text-[11px] text-[#94A3B8] block">Address</span>
                  <div className="text-sm font-medium text-[#F5F7F6] leading-relaxed whitespace-pre-line">
                    {billingDetails ? (
                      <>
                        {billingDetails.addressLine1}
                        {billingDetails.addressLine2 ? `\n${billingDetails.addressLine2}` : ''}
                        {`\n${billingDetails.city}${billingDetails.stateProvince ? `, ${billingDetails.stateProvince}` : ''}${billingDetails.postalCode ? `, ${billingDetails.postalCode}` : ''}`}
                        {`\n${billingDetails.country}`}
                      </>
                    ) : (
                      `Umuchima, Ihiagwa, Owerri.\nOwerri, Imo, 460106\nNigeria`
                    )}
                  </div>
                </div>
              </SettingsGroup>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Payment methods
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(true)}
                  className="text-xs font-semibold text-[#F5F7F6] hover:underline cursor-pointer"
                >
                  Add
                </button>
              </div>

              <SettingsGroup divided={false}>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((pm) => (
                    <div key={pm.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <CardIcon brand={pm.brand} className="w-8 h-5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-[#F5F7F6] block">{pm.brand}</span>
                          <span className="text-[11px] text-[#94A3B8]">•••• {pm.last4}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pm.isDefault && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#1A1D1D] text-[#94A3B8] text-[11px] font-semibold">
                            Default
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePaymentMethod(pm.id)}
                          className="text-[#94A3B8] hover:text-[#D9363E] transition-colors p-1 cursor-pointer"
                          title="Remove payment method"
                          aria-label="Remove payment method"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-3 text-xs text-[#94A3B8]">No payment methods on file.</p>
                )}
              </SettingsGroup>
            </div>

            <SettingsGroup divided={false}>
              <SettingsRow
                icon={AlertTriangle}
                iconClassName="text-[#D9363E]"
                title="Cancel plan"
                description={
                  <>
                    If you cancel, you&apos;ll keep full access to your plan features until{' '}
                    {planExpiresAt ? formatPlanEndDate(planExpiresAt) : 'the end of your billing period'}, and you
                    can upgrade again from that date.
                  </>
                }
              >
                {cancelScheduledUntil ? (
                  <span className="text-xs font-semibold text-[#94A3B8] text-right">
                    Ends on {formatPlanEndDate(cancelScheduledUntil)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/paystack/cancel', { method: 'POST' });
                        if (!res.ok) {
                          throw new Error('Cancel request failed.');
                        }
                        const data = (await res.json().catch(() => null)) as {
                          planTier?: string;
                          expiresAt?: string | null;
                        } | null;

                        if (data?.planTier === 'plus' && data.expiresAt) {
                          // Only the renewal path is retired — the tier stays plus
                          // until the paid period runs out, so it must not be
                          // touched here or access would end immediately.
                          setCancelScheduledUntil(data.expiresAt);
                          toast.success(
                            `You'll keep full access until ${formatPlanEndDate(data.expiresAt)}. Your plan will not renew after that.`,
                            'Plan Cancelled'
                          );
                          return;
                        }

                        // Nothing to ride out (no expiry recorded): the server
                        // downgraded immediately, so the app has to follow.
                        await updatePlanTier('free');
                        toast.success('Your Plus plan has been cancelled. You are now on Free.', 'Plan Cancelled');
                      } catch {
                        toast.error('Failed to cancel plan. Please try again.', 'Cancel Failed');
                      }
                    }}
                    className="text-xs font-semibold text-[#D9363E] hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </SettingsRow>
            </SettingsGroup>
          </>
        )}
      </section>
    );
  }

  // 2. ACCOUNT SECTION
  function renderAccountSection() {
    const initials = (() => {
      if (!fullName || !fullName.trim()) return 'SU';
      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    })();

    return (
      <section className="space-y-6">
        <div className="hidden lg:block">
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Account</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Profile details, email credentials, and security</p>
        </div>

        {/* Identity */}
        <div className="flex flex-col items-center text-center gap-3 pt-1">
          <div
            style={{ backgroundColor: `${avatarColor}1A`, color: avatarColor }}
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
          >
            {initials}
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold text-[#F5F7F6]">{fullName || 'SubHalt User'}</h3>
            <p className="text-xs text-[#94A3B8]">{email || 'user@example.com'}</p>
          </div>
        </div>

        {/* Data rows */}
        <SettingsGroup divided={false}>
          <DataRow divider label="Display Name" value={fullName || 'SubHalt User'} />
          <DataRow divider label="Email" value={email || 'user@example.com'} />
        </SettingsGroup>

        {/* Action rows */}
        <SettingsGroup divided={false}>
          <ActionRow label="Edit Profile" href={`/profile?${FROM_SETTINGS}`} />
          <ActionRow label="Authentication Methods" href={`/settings/authentication?${FROM_SETTINGS}`} />
          <ActionRow label="Log out" onClick={() => setShowSignOutConfirm(true)} />
        </SettingsGroup>

        {/* Danger zone: standalone row with its own red rounded corners,
            deliberately not wrapped in a card. */}
        <button
          type="button"
          onClick={() => setIsDeleteAccountOpen(true)}
          className="w-full flex items-center justify-between gap-4 min-h-[56px] px-4 rounded-2xl border border-[#D9363E]/50 text-[#D9363E] hover:bg-[#D9363E]/10 transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium">Delete SubHalt Account</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#D9363E]/70" aria-hidden="true" />
        </button>
      </section>
    );
  }


  // 3. INTEGRATIONS SECTION
  function renderIntegrationsSection() {
    return <IntegrationsSettingsPanel />;
  }

  // 4. PREFERENCES SECTION
  function renderPreferencesSection() {
    return (
      <section className="space-y-6">
        <div className="hidden lg:block">
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Preferences</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Currency, theme, notifications & categories</p>
        </div>

        <SettingsGroup>
          <SettingsRow icon={Moon} title="Appearance">
            <CustomSelect
              options={[{ value: 'system', label: 'System' }]}
              value={theme || 'system'}
              onChange={(val) => setTheme(val as Theme)}
              ariaLabel="Appearance theme"
              variant="inline"
              showCheckmark={false}
              alignRight
            />
          </SettingsRow>

          <SettingsRow icon={Palette} title="Accent color">
            <CustomSelect
              options={[{ value: '#14B8A6', label: 'Green' }]}
              value={accentColor || '#14B8A6'}
              onChange={(val) => setAccentColor(val)}
              ariaLabel="Accent color"
              variant="inline"
              showCheckmark={false}
              alignRight
            />
          </SettingsRow>

          <SettingsRow icon={Globe} title="Reporting Currency">
            <CustomSelect
              options={SUPPORTED_CURRENCIES.map((c) => ({
                value: c.code,
                label: `${c.code} (${c.symbol})`,
              }))}
              value={defaultCurrency || 'USD'}
              onChange={(val) => handleCurrencyChange(val)}
              ariaLabel="Reporting currency"
              variant="inline"
              showCheckmark={false}
              alignRight
            />
          </SettingsRow>

          <SettingsRow
            icon={Bell}
            title="In-app Alerts"
            description="Inbox unread badges & bell indicators"
          >
            <ToggleSwitch
              checked={notificationPreferences.inApp}
              ariaLabel="In-app alerts"
              onToggle={async () => {
                const val = !notificationPreferences.inApp;
                await updateNotificationPreferences({ inApp: val });
              }}
            />
          </SettingsRow>

          {/*
            Browser permission, not just an app preference.

            The switch tracks whether this device is registered to receive push,
            which is the only state that means delivery will actually happen.
            Turning it on has to grant permission — browsers allow that only from a
            click — so this cannot be a plain toggle: `requestPermission()` called
            outside a gesture resolves to denied without showing a prompt, and
            Chrome treats repeated programmatic requests as grounds to block the
            origin. Hence the enable path running from this handler.
          */}
          <SettingsRow
            icon={Smartphone}
            title="Push Notifications"
            description={
              pushPermission === 'unsupported'
                ? 'Not supported by this browser'
                : pushPermission === 'denied'
                  ? 'Blocked for this site. Allow them in your browser settings'
                  : 'Renewal reminders, weekly recap & new insights'
            }
          >
            <ToggleSwitch
              checked={pushEnabled}
              ariaLabel="Push notifications"
              disabled={!pushSupported || pushToggling}
              onToggle={async () => {
                if (pushToggling) return;
                setPushToggling(true);
                try {
                  if (pushEnabled) {
                    await disablePushNotifications();
                    setPushEnabled(false);
                    return;
                  }

                  // Only reachable from this click, which is what makes the
                  // permission prompt legal.
                  const permission = await enablePushNotifications();
                  setPushPermission(permission);
                  const subscribed = await hasPushSubscription();
                  setPushEnabled(subscribed);

                  if (permission === 'unsupported') {
                    toast.error(
                      'This browser cannot receive notifications.',
                      'Push Unavailable'
                    );
                  } else if (permission === 'denied') {
                    toast.error(
                      'Notifications are blocked for this site. Allow them in your browser settings to get reminders.',
                      'Notifications Blocked'
                    );
                  } else if (!subscribed) {
                    // Granted, but no subscription reached the server — the VAPID
                    // key is missing or the request failed. Reporting success here
                    // would leave the switch ON for a device that gets nothing.
                    toast.error(
                      'Notifications are allowed, but this device could not be registered. Try again in a moment.',
                      'Push Not Enabled'
                    );
                  }
                } finally {
                  setPushToggling(false);
                }
              }}
            />
          </SettingsRow>

          <SettingsRow
            icon={Mail}
            title="Renewal Emails"
            description={
              notificationPreferences.email
                ? 'Emails at the lead time you chose per subscription'
                : 'Off. Renewal reminders are sent as push instead'
            }
          >
            <ToggleSwitch
              checked={notificationPreferences.email}
              ariaLabel="Renewal emails"
              onToggle={async () => {
                const val = !notificationPreferences.email;
                await updateNotificationPreferences({ email: val });
              }}
            />
          </SettingsRow>
        </SettingsGroup>

        {/* Category Manager */}
        <div className="pt-2">
          <CategoryManager subscriptions={subscriptions} onSubscriptionsUpdated={loadSubData} />
        </div>
      </section>
    );
  }

  // 5. PRIVACY SECTION
  function renderPrivacySection() {
    return (
      <section className="space-y-6">
        <div className="hidden lg:block">
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Privacy &amp; Data</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Data export, local cache, and telemetry</p>
        </div>

        <SettingsGroup>
          <SettingsRow
            icon={Download}
            iconClassName="text-[#14B8A6]"
            title="Export Subscription Data"
            description="Download a complete JSON export of your portfolio records"
          >
            <button
              type="button"
              onClick={handleExportData}
              className="text-xs font-semibold text-[#14B8A6] hover:underline cursor-pointer"
            >
              Export
            </button>
          </SettingsRow>

          <SettingsRow
            icon={Database}
            iconClassName="text-[#F59E0B]"
            title="Clear Local Storage & Cache"
            description="Purge temporary client cache & saved reminder preferences"
          >
            <button
              type="button"
              onClick={handleClearCache}
              className="text-xs font-semibold text-[#14B8A6] hover:underline cursor-pointer"
            >
              Clear
            </button>
          </SettingsRow>

          <SettingsRow
            icon={ShieldCheck}
            title="Anonymous Product Telemetry"
            description="Allow SubHalt to collect anonymous error reports"
          >
            <ToggleSwitch
              checked={telemetryEnabled}
              ariaLabel="Anonymous product telemetry"
              onToggle={() => setTelemetryEnabled(!telemetryEnabled)}
            />
          </SettingsRow>
        </SettingsGroup>
      </section>
    );
  }

  // 6. HELP SECTION
  function renderHelpSection() {
    return (
      <section className="space-y-6">
        <div className="hidden lg:block">
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Help &amp; Legal</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Support resources, terms, and policies</p>
        </div>

        <SettingsGroup>
          <SettingsRow
            icon={HelpCircle}
            title="SubHalt Help Center"
            description="Browse guides for adding, linking, and managing subscriptions"
          >
            <Link
              href={`/help?${FROM_SETTINGS}`}
              className="text-xs font-semibold text-[#14B8A6] hover:underline"
            >
              Open
            </Link>
          </SettingsRow>

          <SettingsRow
            icon={Mail}
            title="Contact Support"
            description="Reach out directly to the SubHalt support team"
          >
            <a
              href="mailto:support@subhalt.app"
              className="text-xs font-semibold text-[#14B8A6] hover:underline"
            >
              Email
            </a>
          </SettingsRow>
        </SettingsGroup>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider px-1">
            Legal
          </h3>
          <SettingsGroup>
            <button
              type="button"
              onClick={() => setLegalModalType('privacy')}
              className="w-full flex items-center gap-3.5 min-h-[56px] px-4 hover:bg-[#121414] transition-colors cursor-pointer text-left"
            >
              <ShieldCheck className="w-5 h-5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-[#F5F7F6]">Privacy Policy</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setLegalModalType('terms')}
              className="w-full flex items-center gap-3.5 min-h-[56px] px-4 hover:bg-[#121414] transition-colors cursor-pointer text-left"
            >
              <FileText className="w-5 h-5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-[#F5F7F6]">Terms of Service</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
            </button>
          </SettingsGroup>
        </div>
      </section>
    );
  }
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#94A3B8]">
          <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />
          <span>Loading settings...</span>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
