'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Shield,
  Key,
  CreditCard,
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
  Palette,
  ArrowLeft,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useTheme } from '@/lib/hooks/use-theme';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import {
  fetchSubscriptions,
  deleteSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { LegalModal } from '@/components/settings/legal-modal';
import { ChangeEmailModal } from '@/components/settings/change-email-modal';
import { EditBillingModal } from '@/components/settings/edit-billing-modal';
import { AddPaymentModal } from '@/components/settings/add-payment-modal';
import { CategoryManager } from '@/components/settings/category-manager';
import { CustomSelect } from '@/components/ui/custom-select';
import { CardIcon } from '@/components/ui/card-icons';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';

type SettingsSection = 'account' | 'plan' | 'preferences' | 'privacy' | 'help';

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

  useEffect(() => {
    if (sectionParam) {
      setActiveSection(sectionParam);
      setMobileSectionView(sectionParam);
    }
  }, [sectionParam]);

  const {
    defaultCurrency,
    fullName,
    email,
    notificationPreferences,
    isPlus,
    billingDetails,
    paymentMethods,
    billingTransactions,
    updateDefaultCurrency,
    updateNotificationPreferences,
    updatePlanTier,
    deletePaymentMethod,
  } = useUserSettings();

  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isEditBillingOpen, setIsEditBillingOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isViewSubscriptionOpen, setIsViewSubscriptionOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [, setSubsLoading] = useState(true);

  // Account Deletion States
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Privacy & Data states
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState('#14B8A6');

  // Legal Modal States
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  const supabase = createClient();

  const loadSubData = useCallback(async () => {
    setSubsLoading(true);
    const { data } = await fetchSubscriptions();
    if (data) setSubscriptions(data);
    setSubsLoading(false);
  }, []);

  useEffect(() => {
    loadSubData();
  }, [loadSubData]);

  const handleCurrencyChange = async (newCurr: string) => {
    try {
      await updateDefaultCurrency(newCurr);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update currency.';
      toast.error(msg, 'Currency Error');
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: subs } = await supabase.from('subscriptions').select('id');
        if (subs && subs.length > 0) {
          await Promise.all(subs.map((s) => deleteSubscription(s.id)));
        }
        await supabase.from('profiles').delete().eq('id', user.id);
      }

      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }

      router.push('/login');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account.';
      toast.error(msg, 'Account Deletion Error');
      setDeletingAccount(false);
    }
  };

  const handleExportData = () => {
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(subscriptions, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `subsync-portfolio-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      toast.error('Failed to export subscription data.', 'Export Error');
    }
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subsync_reminders');
      toast.success('Local cache & reminder preferences purged.', 'Cache Cleared');
    }
  };

  const sectionsList: { id: SettingsSection; label: string; icon: any; description: string }[] = [
    { id: 'account', label: 'Account', icon: User, description: 'Profile info, authentication, and security' },
    { id: 'plan', label: 'Plan & Billing', icon: ArrowUpCircle, description: 'Current plan & billing controls' },
    { id: 'preferences', label: 'Preferences', icon: Sliders, description: 'Currency, theme, notifications & categories' },
    { id: 'privacy', label: 'Privacy & Data', icon: Lock, description: 'Data export, local cache & privacy controls' },
    { id: 'help', label: 'Help & Legal', icon: HelpCircle, description: 'Support resources, terms, and policies' },
  ];

  const handleSelectCategory = (secId: SettingsSection) => {
    setActiveSection(secId);
    setMobileSectionView(secId);
  };

  return (
    <div className="space-y-6 max-w-5xl min-h-[85vh] pb-24 animate-fade-in text-[#F5F7F6]">
      <h1 className="sr-only">Settings</h1>

      {/* Header Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">Settings</h1>
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
            <div className="space-y-2">
              {sectionsList.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelectCategory(sec.id)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] hover:bg-[#121414] transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#1A1D1D] border border-[#27272A] flex items-center justify-center text-[#F5F7F6] shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-[#F5F7F6] truncate">{sec.label}</span>
                        <span className="block text-xs text-[#94A3B8] truncate mt-0.5">{sec.description}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] shrink-0 ml-2" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Mobile Level 2: Separate Section Page View with Return Button */
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setMobileSectionView(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:underline cursor-pointer py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Settings categories</span>
            </button>

            <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-5 space-y-6">
              {/* Render Active Section Content for Mobile */}
              {mobileSectionView === 'plan' && renderBillingSection()}
              {mobileSectionView === 'account' && renderAccountSection()}
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
                onClick={() => {
                  setActiveSection(sec.id);
                  setMobileSectionView(sec.id);
                }}
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
          {activeSection === 'preferences' && renderPreferencesSection()}
          {activeSection === 'privacy' && renderPrivacySection()}
          {activeSection === 'help' && renderHelpSection()}
        </div>
      </div>

      {/* Modals & Dialogs */}
      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        loading={deletingAccount}
        title="Permanently Delete Account?"
        description="Are you sure you want to delete your SubHalt account? All subscription records and custom settings will be purged immediately. This action cannot be undone."
        confirmText="Yes, Delete My Account"
        variant="danger"
      />

      <LegalModal
        isOpen={!!legalModalType}
        onClose={() => setLegalModalType(null)}
        type={legalModalType}
      />

      <ChangeEmailModal
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
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
        subscription={{
          id: 'subhalt_subscription',
          user_id: 'user_mock',
          name: 'SubHalt',
          price: 4.99,
          currency: 'USD',
          billing_cycle: 'monthly',
          category: 'Software',
          next_billing_date: '2026-09-15',
          start_date: '2026-08-15',
          end_date: null,
          status: 'active',
          payment_method: 'Mastercard •••• 6730',
          provider_url: 'https://subhalt.com',
          notes: 'SubHalt subscription auto-renews monthly at $4.99.',
          account_links: null,
          receipts: null,
          is_synced: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
        isOpen={isViewSubscriptionOpen}
        onClose={() => setIsViewSubscriptionOpen(false)}
        onEdit={() => {}}
        onDeleteRequest={() => {}}
        onPaymentReminderRequest={() => {}}
      />
    </div>
  );

  /* SECTION RENDER HELPERS */

  // 1. BILLING SECTION (Clean unboxed UI matching reference images 2 & 3)
  function renderBillingSection() {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight">Billing</h2>
        </div>

        {/* Active Plan Row */}
        <div className="py-4 border-b border-[#1A1D1D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-[#F5F7F6]">
              {isPlus ? 'SubHalt' : 'SubHalt Free'}
            </h3>
            <p className="text-xs text-[#94A3B8]">
              {isPlus
                ? 'Your plan auto-renews monthly on Sep 15, 2026. ($4.99/month)'
                : 'Intelligence for everyday tasks'}
            </p>
          </div>

          {isPlus ? (
            <button
              type="button"
              onClick={() => setIsViewSubscriptionOpen(true)}
              className="px-4 py-1.5 rounded-full bg-[#1A1D1D] hover:bg-[#27272A] border border-[#2D3135] text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer shrink-0 text-center"
            >
              View subscription
            </button>
          ) : (
            <Link
              href={`/plans?from=${encodeURIComponent('/settings?section=plan')}`}
              className="px-4 py-1.5 rounded-full bg-[#1A1D1D] hover:bg-[#27272A] border border-[#2D3135] text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer shrink-0 text-center"
            >
              Upgrade plan
            </Link>
          )}
        </div>

        {/* PAID STATE CONTENT ONLY - Matching ChatGPT Reference Screenshots */}
        {isPlus && (
          <>
            {/* Billing Information Section */}
            <div className="py-4 border-b border-[#1A1D1D] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#F5F7F6]">Billing information</h3>
                <button
                  type="button"
                  onClick={() => setIsEditBillingOpen(true)}
                  className="px-4 py-1.5 rounded-full bg-[#1A1D1D] hover:bg-[#27272A] border border-[#2D3135] text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <span className="text-xs text-[#94A3B8] block mb-1">Billing email</span>
                  <span className="text-sm font-medium text-[#F5F7F6]">
                    {billingDetails?.email || email || 'anitaonyema25@gmail.com'}
                  </span>
                </div>
                <div className="pt-3 border-t border-[#1A1D1D]/70">
                  <span className="text-xs text-[#94A3B8] block mb-1">Name</span>
                  <span className="text-sm font-medium text-[#F5F7F6]">
                    {billingDetails?.fullName || fullName || 'Anita Onyema'}
                  </span>
                </div>
                <div className="pt-3 border-t border-[#1A1D1D]/70">
                  <span className="text-xs text-[#94A3B8] block mb-1">Address</span>
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
              </div>
            </div>

            {/* Payment Methods Section */}
            <div className="py-4 border-b border-[#1A1D1D] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#F5F7F6]">Payment methods</h3>
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(true)}
                  className="px-4 py-1 rounded-full bg-[#1A1D1D] hover:bg-[#27272A] border border-[#2D3135] text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Add new
                </button>
              </div>

              {paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {paymentMethods.map((pm) => (
                    <div key={pm.id} className="py-2 flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-3">
                        <CardIcon brand={pm.brand} className="w-8 h-5 shrink-0" />
                        <div>
                          <span className="font-semibold text-[#F5F7F6] block">{pm.brand}</span>
                          <span className="text-xs text-[#94A3B8]">•••• {pm.last4}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {pm.isDefault && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#1A1D1D] text-[#14B8A6] text-xs font-semibold border border-[#14B8A6]/30">
                            Default
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePaymentMethod(pm.id)}
                          className="text-[#94A3B8] hover:text-[#D9363E] text-xs transition-colors p-1 cursor-pointer"
                          title="Remove payment method"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8]">
                  No payment methods on file.
                </p>
              )}
            </div>

            {/* Cancel Plan Section */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#F5F7F6]">Cancel plan</h4>
                <p className="text-xs text-[#94A3B8]">
                  If you cancel, you'll keep full access to your plan features until the end of your billing period.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updatePlanTier('free');
                    toast.success('Your subscription will end at the close of the current billing cycle.', 'Plan Cancelled');
                  } catch {
                    toast.error('Failed to update plan.', 'Cancel Failed');
                  }
                }}
                className="px-5 py-2 rounded-full border border-[#D9363E] text-[#D9363E] hover:bg-[#D9363E]/10 text-xs font-semibold transition-colors cursor-pointer shrink-0 text-center"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  // 2. ACCOUNT SECTION
  function renderAccountSection() {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Account Overview</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Manage profile page details, email credentials, and security</p>
        </div>

        {/* Profile Shortcut Card */}
        <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] hover:border-[#2A2E2E] transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[#14B8A6] shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6]">{fullName || 'SubHalt User'}</h3>
              <p className="text-xs text-[#94A3B8]">{email || 'user@example.com'}</p>
            </div>
          </div>

          <Link
            href="/profile"
            className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            <span>Edit Profile Page</span>
          </Link>
        </div>

        {/* Email Address & Change Email */}
        <div className="space-y-2 pt-2 border-t border-[#1A1D1D]">
          <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Account Credentials</h3>
          <div className="space-y-1.5">
            <label className="text-xs text-[#94A3B8]">Email Address</label>
            <div className="flex items-center gap-3">
              <input
                type="email"
                disabled
                value={email}
                className="flex-1 h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] text-[#94A3B8] bg-[#0D0F0F] cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setIsChangeEmailOpen(true)}
                className="h-10 px-4 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#14B8A6] border border-[#1A1D1D] text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Change Email
              </button>
            </div>
          </div>
        </div>

        {/* Authentication & Security Methods */}
        <div className="space-y-3 pt-4 border-t border-[#1A1D1D]">
          <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Authentication Methods</h3>

          <div className="p-3.5 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-[#14B8A6]" />
              <div>
                <span className="font-semibold text-[#F5F7F6] block">Password Authentication</span>
                <span className="text-[11px] text-[#94A3B8]">Secured email and password credentials</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1A1D1D] text-[#94A3B8] border border-[#1A1D1D]">
              Active
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#94A3B8]" />
              <div>
                <span className="font-semibold text-[#F5F7F6] block">OAuth Social Login</span>
                <span className="text-[11px] text-[#94A3B8]">Google / Apple SSO authentication options</span>
              </div>
            </div>
            <span className="text-[11px] text-[#94A3B8]">Configured</span>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="pt-4 border-t border-[#1A1D1D]">
          <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#D9363E]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-[#F5F7F6] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#D9363E]" />
                Delete SubHalt Account
              </h4>
              <p className="text-[11px] text-[#94A3B8]">
                Permanently erase your account, custom settings, and recorded subscription data.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsDeleteAccountOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#D9363E] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 3. PREFERENCES SECTION
  function renderPreferencesSection() {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Preferences & Display</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Configure default currency, notification alerts, and categories</p>
        </div>

        <div className="rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] divide-y divide-[#1A1D1D] overflow-hidden">
          {/* Row 1: Appearance */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <span className="text-xs font-semibold text-[#F5F7F6]">Appearance</span>
            </div>
            <CustomSelect
              options={[{ value: 'system', label: 'System' }]}
              value={theme || 'system'}
              onChange={(val) => setTheme(val as any)}
              ariaLabel="Appearance theme"
              variant="inline"
              showCheckmark={false}
              alignRight
            />
          </div>

          {/* Row 2: Accent Color */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Palette className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <span className="text-xs font-semibold text-[#F5F7F6]">Accent color</span>
            </div>
            <CustomSelect
              options={[{ value: '#14B8A6', label: 'Green' }]}
              value={accentColor || '#14B8A6'}
              onChange={(val) => setAccentColor(val)}
              ariaLabel="Accent color"
              variant="inline"
              showCheckmark={false}
              alignRight
            />
          </div>

          {/* Row 3: Reporting Currency */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <span className="text-xs font-semibold text-[#F5F7F6]">Reporting Currency</span>
            </div>
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
          </div>

          {/* Row 4: In-app Alerts */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-[#F5F7F6] block">In-app Alerts</span>
              <span className="text-[11px] text-[#94A3B8]">Inbox unread badges & bell indicators</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationPreferences.inApp}
              onClick={async () => {
                const val = !notificationPreferences.inApp;
                await updateNotificationPreferences({ inApp: val });
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                notificationPreferences.inApp ? 'bg-[#14B8A6]' : 'bg-[#1A1D1D]'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                notificationPreferences.inApp ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Row 5: Email Digests */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-[#F5F7F6] block">Email Digests</span>
              <span className="text-[11px] text-[#94A3B8]">Upcoming renewal summaries & price changes</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationPreferences.email}
              onClick={async () => {
                const val = !notificationPreferences.email;
                await updateNotificationPreferences({ email: val });
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                notificationPreferences.email ? 'bg-[#14B8A6]' : 'bg-[#1A1D1D]'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                notificationPreferences.email ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Category Manager */}
        <div className="pt-2">
          <CategoryManager subscriptions={subscriptions} onSubscriptionsUpdated={loadSubData} />
        </div>
      </section>
    );
  }

  // 4. PRIVACY SECTION
  function renderPrivacySection() {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Privacy & Data Controls</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Controls for data export, local cache management, and telemetry</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Download className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-[#F5F7F6]">Export Subscription Data</h3>
              <p className="text-[11px] text-[#94A3B8]">Download a complete JSON export of your portfolio records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportData}
            className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Export JSON
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Database className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-[#F5F7F6]">Clear Local Storage & Cache</h3>
              <p className="text-[11px] text-[#94A3B8]">Purge temporary client cache & saved reminder preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearCache}
            className="px-4 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Clear Cache
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-[#F5F7F6]">Anonymous Product Telemetry</h3>
            <p className="text-[11px] text-[#94A3B8]">Allow SubHalt to collect anonymous error reports</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={telemetryEnabled}
            onClick={() => setTelemetryEnabled(!telemetryEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              telemetryEnabled ? 'bg-[#14B8A6]' : 'bg-[#1A1D1D]'
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              telemetryEnabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </section>
    );
  }

  // 5. HELP SECTION
  function renderHelpSection() {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Help & Legal Resources</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Access user guides, support team, and terms of service</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-[#F5F7F6]">SubHalt Help Center</h3>
              <p className="text-[11px] text-[#94A3B8]">Browse guides for adding, linking, and managing subscriptions</p>
            </div>
          </div>

          <Link
            href="/help"
            className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <span>Open Help Center</span>
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Mail className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-[#F5F7F6]">Contact Support</h3>
              <p className="text-[11px] text-[#94A3B8]">Reach out directly to the SubHalt support team</p>
            </div>
          </div>
          <a
            href="mailto:support@subhalt.app"
            className="px-4 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Email Support
          </a>
        </div>

        <div className="pt-4 border-t border-[#1A1D1D] space-y-2">
          <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Legal Documents</h3>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setLegalModalType('privacy')}
              className="text-[#14B8A6] hover:underline cursor-pointer flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
            <span className="text-[#1A1D1D]">•</span>
            <button
              type="button"
              onClick={() => setLegalModalType('terms')}
              className="text-[#14B8A6] hover:underline cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </button>
          </div>
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
