'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Shield,
  Key,
  Crown,
  Zap,
  Sliders,
  Globe,
  Moon,
  Bell,
  Lock,
  Download,
  Database,
  HelpCircle,
  FileText,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Mail,
  Palette,
  ChevronDown,
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
import { CategoryManager } from '@/components/settings/category-manager';

type SettingsSection = 'account' | 'plan' | 'preferences' | 'privacy' | 'help';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const sectionParam = (searchParams.get('section') as SettingsSection) || 'account';
  const [activeSection, setActiveSection] = useState<SettingsSection>(sectionParam);

  useEffect(() => {
    if (sectionParam) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);

  const {
    defaultCurrency,
    fullName,
    email,
    loading: settingsLoading,
    notificationPreferences,
    updateDefaultCurrency,
    updateNotificationPreferences,
  } = useUserSettings();

  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);

  // Subscriptions for category counts & data export
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  // Account Deletion States
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Privacy & Data states
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState('#14B8A6');

  // Legal Modal States
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  const supabase = createClient();

  // Load subscriptions for category usage tracking & data export
  const loadSubData = useCallback(async () => {
    setSubsLoading(true);
    const { data } = await fetchSubscriptions();
    if (data) setSubscriptions(data);
    setSubsLoading(false);
  }, []);

  useEffect(() => {
    loadSubData();
  }, [loadSubData]);

  // Currency Change Handler
  const handleCurrencyChange = async (newCurr: string) => {
    try {
      await updateDefaultCurrency(newCurr);
      toast.success(`Reporting currency updated to ${newCurr}.`, 'Currency Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update currency.';
      toast.error(msg, 'Currency Error');
    }
  };

  // Account Deletion Handler
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

      toast.success('Your account and associated data have been deleted.', 'Account Deleted');
      router.push('/login');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account.';
      toast.error(msg, 'Account Deletion Error');
      setDeletingAccount(false);
    }
  };

  // Data Export Handler
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
      toast.success('Exported subscription portfolio JSON file.', 'Data Exported');
    } catch {
      toast.error('Failed to export subscription data.', 'Export Error');
    }
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subsync_reminders');
      toast.success('Local cache & cached states cleared successfully.', 'Cache Cleared');
    }
  };

  const sectionsList: { id: SettingsSection; label: string; icon: any; description: string }[] = [
    { id: 'account', label: 'Account', icon: User, description: 'Profile info, authentication, and security' },
    { id: 'plan', label: 'Plan & Billing', icon: Crown, description: 'Current SubSync tier & plan management' },
    { id: 'preferences', label: 'Preferences', icon: Sliders, description: 'Currency, theme, notifications & categories' },
    { id: 'privacy', label: 'Privacy & Data', icon: Lock, description: 'Data export, local cache & privacy controls' },
    { id: 'help', label: 'Help & Legal', icon: HelpCircle, description: 'Support resources, terms, and policies' },
  ];

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

      {/* SaaS Architecture Grid: Sidebar Tabs + Main Section View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Section Cards */}
        <nav
          className="settings-nav space-y-1 bg-[#0B0D0D] border border-[#1A1D1D] p-2 rounded-2xl shadow-none"
          style={{
            boxShadow: 'none',
            filter: 'none',
            textShadow: 'none',
            backgroundImage: 'none',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
        >
          {sectionsList.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                data-active={isActive ? 'true' : 'false'}
                className="settings-nav-item relative w-full flex items-center gap-3 p-3 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left shadow-none outline-none focus:outline-none focus:ring-0 text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0D0F0F]"
                style={{
                  boxShadow: 'none',
                  filter: 'none',
                  textShadow: 'none',
                  backgroundImage: 'none',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}
              >
                <Icon className="w-4 h-4 shrink-0 text-[#94A3B8]" style={{ filter: 'none' }} />
                <div className="min-w-0">
                  <span className="block truncate">{sec.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <div className="lg:col-span-3 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-5 sm:p-7 space-y-6 min-h-[500px]">
          {/* 1. ACCOUNT SECTION */}
          {activeSection === 'account' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Account Overview</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">Manage profile page details, email credentials, and security</p>
              </div>

              {/* Profile Shortcut Card */}
              <div className="p-4 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F7F6]">{fullName || 'SubSync User'}</h3>
                    <p className="text-xs text-[#94A3B8]">{email || 'user@example.com'}</p>
                  </div>
                </div>

                <Link
                  href="/profile"
                  className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Edit Profile Page</span>
                  <ArrowRight className="w-3.5 h-3.5" />
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

                <div className="p-3.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between text-xs">
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

                <div className="p-3.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between text-xs">
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

              {/* Account Deletion (Without DANGER ZONE header label) */}
              <div className="pt-4 border-t border-[#1A1D1D]">
                <div className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] border border-[#D9363E]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#F5F7F6] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-[#D9363E]" />
                      Delete SubSync Account
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
          )}

          {/* 2. PLAN SECTION */}
          {activeSection === 'plan' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Plan & Billing Management</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">Your current SubSync workspace plan tier and features</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-[#14B8A6]" />
                    <h3 className="text-sm font-bold text-[#F5F7F6]">Workspace Plan: SubSync Free</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1A1D1D] text-[#94A3B8] border border-[#1A1D1D]">
                    Active Plan
                  </span>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Includes core subscription portfolio tracking, receipt parsing, multi-currency reporting, and payment alerts.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#F5F7F6] pt-1 border-t border-[#1A1D1D]/60">
                  <div className="flex items-center gap-2 pt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span className="text-[#94A3B8]">Unlimited manual subscriptions</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span className="text-[#94A3B8]">Receipt import & parsing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span className="text-[#94A3B8]">Multi-currency spend reporting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span className="text-[#94A3B8]">Multiple linked accounts</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] space-y-3">
                <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Payment Methods & Invoices
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  No active payment methods or billing invoices on file for this account.
                </p>
              </div>
            </section>
          )}

          {/* 3. PREFERENCES SECTION */}
          {activeSection === 'preferences' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Preferences & Display</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">Configure default currency, notification alerts, and categories</p>
              </div>

              {/* Compact Native Settings Rows Group */}
              <div className="rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] divide-y divide-[#1A1D1D] overflow-hidden">
                {/* Row 1: Appearance */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <span className="text-xs font-semibold text-[#F5F7F6]">Appearance</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as any)}
                      className="bg-transparent text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] border-none focus:outline-none cursor-pointer pr-1 text-right"
                    >
                      <option value="system" className="bg-[#0D0F0F] text-[#F5F7F6]">System</option>
                      <option value="dark" className="bg-[#0D0F0F] text-[#F5F7F6]">Midnight Dark</option>
                      <option value="light" className="bg-[#0D0F0F] text-[#F5F7F6]">Light</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 pointer-events-none" />
                  </div>
                </div>

                {/* Row 2: Accent Color */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <span className="text-xs font-semibold text-[#F5F7F6]">Accent color</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={accentColor}
                      onChange={(e) => {
                        setAccentColor(e.target.value);
                        toast.success(`Accent color set to ${e.target.value}.`, 'Preferences Updated');
                      }}
                      className="bg-transparent text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] border-none focus:outline-none cursor-pointer pr-1 text-right"
                    >
                      <option value="#14B8A6" className="bg-[#0D0F0F] text-[#F5F7F6]">Teal (#14B8A6)</option>
                      <option value="#6366F1" className="bg-[#0D0F0F] text-[#F5F7F6]">Indigo (#6366F1)</option>
                      <option value="#F59E0B" className="bg-[#0D0F0F] text-[#F5F7F6]">Amber (#F59E0B)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 pointer-events-none" />
                  </div>
                </div>

                {/* Row 3: Reporting Currency */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <span className="text-xs font-semibold text-[#F5F7F6]">Reporting Currency</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={defaultCurrency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] border-none focus:outline-none cursor-pointer pr-1 text-right"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#0D0F0F] text-[#F5F7F6]">
                          {c.code} ({c.symbol})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 pointer-events-none" />
                  </div>
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
                      toast.success(`In-app notifications ${val ? 'enabled' : 'disabled'}.`, 'Preferences Updated');
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
                      toast.success(`Email notifications ${val ? 'enabled' : 'disabled'}.`, 'Preferences Updated');
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
          )}

          {/* 4. PRIVACY & DATA SECTION */}
          {activeSection === 'privacy' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Privacy & Data Controls</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">Controls for data export, local cache management, and telemetry</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-[#14B8A6]" />
                    <div>
                      <h3 className="text-xs font-bold text-[#F5F7F6]">Export Subscription Data</h3>
                      <p className="text-[11px] text-[#94A3B8]">Download a complete JSON export of your portfolio records</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Export JSON
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-[#F59E0B]" />
                    <div>
                      <h3 className="text-xs font-bold text-[#F5F7F6]">Clear Local Storage & Cache</h3>
                      <p className="text-[11px] text-[#94A3B8]">Purge temporary client cache & saved reminder preferences</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="px-4 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] text-[#F5F7F6] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Clear Cache
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#F5F7F6]">Anonymous Product Telemetry</h3>
                  <p className="text-[11px] text-[#94A3B8]">Allow SubSync to collect anonymous error reports</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={telemetryEnabled}
                  onClick={() => {
                    setTelemetryEnabled(!telemetryEnabled);
                    toast.success(`Telemetry ${!telemetryEnabled ? 'enabled' : 'disabled'}.`, 'Privacy Updated');
                  }}
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
          )}

          {/* 5. HELP & LEGAL SECTION */}
          {activeSection === 'help' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Help & Legal Resources</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">Access user guides, support team, and terms of service</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-[#14B8A6]" />
                  <div>
                    <h3 className="text-xs font-bold text-[#F5F7F6]">SubSync Help Center</h3>
                    <p className="text-[11px] text-[#94A3B8]">Browse guides for adding, linking, and managing subscriptions</p>
                  </div>
                </div>

                <Link
                  href="/help"
                  className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Help Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#14B8A6]" />
                  <div>
                    <h3 className="text-xs font-bold text-[#F5F7F6]">Contact Support</h3>
                    <p className="text-[11px] text-[#94A3B8]">Reach out directly to the SubSync support team</p>
                  </div>
                </div>

                <a
                  href="mailto:support@subsync.app"
                  className="px-4 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] text-[#F5F7F6] text-xs font-semibold transition-colors cursor-pointer"
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
          )}
        </div>
      </div>

      {/* Dialogs & Modals */}
      <ConfirmDialog
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        loading={deletingAccount}
        title="Permanently Delete Account?"
        description="Are you sure you want to delete your SubSync account? All subscription records and custom settings will be purged immediately. This action cannot be undone."
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
    </div>
  );
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
