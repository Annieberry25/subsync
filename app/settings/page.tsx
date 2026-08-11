'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Save,
  Loader2,
  Moon,
  Check,
  Trash2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  RefreshCw,
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

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const {
    defaultCurrency,
    fullName: initialFullName,
    email,
    lastNameChange,
    loading: settingsLoading,
    updateProfile,
    updateDefaultCurrency,
  } = useUserSettings();

  // Profile Form States
  const [fullName, setFullName] = useState(initialFullName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);

  // Subscriptions for category counts & safe deletion
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  // Account Deletion States
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Legal Modal States
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  const supabase = createClient();

  // Sync profile state when settings load
  useEffect(() => {
    setFullName(initialFullName);
  }, [initialFullName]);

  // Calculate 30-day rate limit status for name changes
  let isLockedBy30Days = false;
  let nextAllowedDateString = '';

  if (lastNameChange) {
    const lastChangeDate = new Date(lastNameChange);
    const diffMs = Date.now() - lastChangeDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 30) {
      isLockedBy30Days = true;
      const nextAllowed = new Date(lastChangeDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      nextAllowedDateString = nextAllowed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }

  const isProfileUnchanged = fullName.trim() === initialFullName.trim();

  // Load subscriptions for category usage tracking
  const loadSubData = useCallback(async () => {
    setSubsLoading(true);
    const { data } = await fetchSubscriptions();
    if (data) setSubscriptions(data);
    setSubsLoading(false);
  }, []);

  useEffect(() => {
    loadSubData();
  }, [loadSubData]);

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Please enter a valid name.', 'Validation Error');
      return;
    }

    if (isProfileUnchanged) {
      return;
    }

    if (isLockedBy30Days) {
      toast.error(
        `Name can only be changed once every 30 days. You can change your name again on ${nextAllowedDateString}.`,
        'Name Change Restricted'
      );
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
      });
      toast.success('Profile name updated successfully.', 'Profile Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      toast.error(msg, 'Update Error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save Currency Handler
  const handleCurrencyChange = async (newCurr: string) => {
    try {
      await updateDefaultCurrency(newCurr);
      toast.success(`Reporting currency updated to ${newCurr}.`, 'Currency Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update currency.';
      toast.error(msg, 'Currency Error');
    }
  };

  // Delete Account Handler
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

  return (
    <div className="space-y-5 max-w-4xl min-h-[80vh] pb-24 animate-fade-in text-white">
      {/* Subtitle Header (No duplicate H1 title, header has main title) */}
      <div className="pb-1">
        <p className="text-xs sm:text-sm text-[#A1AAB8]">
          Manage profile details, default currency reporting, category tags, and account settings.
        </p>
      </div>

      {/* UNIFIED WORKSPACE CARD CONTAINER */}
      <div className="rounded-2xl bg-[#171A21] border border-[#2B313D] p-4 sm:p-6 space-y-6 shadow-xl">
        
        {/* 1. PROFILE SECTION */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Profile</h2>
          </div>

          {settingsLoading ? (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-[#A1AAB8]">
              <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" />
              <span>Loading profile...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Name (First) */}
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#A1AAB8] block">Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#2B313D] bg-[#1D222B] text-white placeholder-[#6F7787] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
                {isLockedBy30Days && !isProfileUnchanged && (
                  <p className="text-[11px] text-[#EF4444] pt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Name can only be changed once every 30 days. You can change it again on {nextAllowedDateString}.</span>
                  </p>
                )}
                {isLockedBy30Days && isProfileUnchanged && (
                  <p className="text-[11px] text-[#6F7787] pt-0.5">
                    Name can only be changed once every 30 days. Next change allowed on {nextAllowedDateString}.
                  </p>
                )}
              </div>

              {/* Email Address (Second) */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#A1AAB8] block">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#2B313D] text-[#6F7787] bg-[#1D222B] cursor-not-allowed"
                />
                <div>
                  <button
                    type="button"
                    onClick={() => setIsChangeEmailOpen(true)}
                    className="text-xs text-[#4F46E5] hover:text-[#6366F1] font-semibold hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 pt-0.5"
                  >
                    Change Email
                  </button>
                </div>
              </div>

              {/* Save Profile Button (Aligned to bottom-right) */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingProfile || isProfileUnchanged || (isLockedBy30Days && !isProfileUnchanged)}
                  className="h-10 px-5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          )}
        </section>

        <div className="border-b border-[#2B313D]/70" />

        {/* 2. CURRENCY & SPENDING SECTION */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Currency & Spending</h2>
              <p className="text-xs text-[#A1AAB8]">Reporting currency for dashboard spending metrics & analytics</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1D222B] border border-[#2B313D] text-[10px] text-[#22C55E]">
              <RefreshCw className="w-3 h-3 animate-spin-slow" />
              <span>Rates synced</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-full sm:w-64">
              <select
                value={defaultCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#2B313D] bg-[#1D222B] text-white focus:outline-none focus:border-[#4F46E5] transition-colors cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#1D222B] text-white">
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] sm:text-xs text-[#6F7787] leading-tight">
              Original subscription amounts are preserved. Financial totals dynamically convert into <span className="text-white font-medium">{defaultCurrency}</span>.
            </p>
          </div>
        </section>

        <div className="border-b border-[#2B313D]/70" />

        {/* 3. APPEARANCE SECTION */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Appearance</h2>
            <p className="text-xs text-[#A1AAB8]">Application visual environment</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border border-[#4F46E5] bg-[#1D222B]">
              <Moon className="w-4 h-4 text-[#4F46E5]" />
              <span className="text-xs font-semibold text-white">Midnight Dark</span>
              <Check className="w-4 h-4 text-[#22C55E] ml-1" />
            </div>
            <span className="text-xs text-[#6F7787]">Active default theme</span>
          </div>
        </section>

        <div className="border-b border-[#2B313D]/70" />

        {/* 4. CATEGORIES SECTION */}
        <CategoryManager
          subscriptions={subscriptions}
          onSubscriptionsUpdated={loadSubData}
        />

        <div className="border-b border-[#2B313D]/70" />

        {/* 5. LEGAL SECTION */}
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Legal</h2>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              onClick={() => setLegalModalType('privacy')}
              className="text-[#4F46E5] hover:text-[#6366F1] hover:underline cursor-pointer flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
            <span className="text-[#2B313D]">•</span>
            <button
              onClick={() => setLegalModalType('terms')}
              className="text-[#4F46E5] hover:text-[#6366F1] hover:underline cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </button>
          </div>
        </section>
      </div>

      {/* 6. ACCOUNT DELETION SECTION (Visually distinct red accent container) */}
      <section className="rounded-2xl bg-[#171A21] border border-[#EF4444]/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <h2 className="text-sm font-semibold text-white">Delete Account</h2>
          </div>
          <p className="text-xs text-[#A1AAB8]">
            Your account and all recorded subscription data will be permanently removed. This action cannot be undone.
          </p>
        </div>

        <button
          onClick={() => setIsDeleteAccountOpen(true)}
          className="h-9 px-4 rounded-xl bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Account</span>
        </button>
      </section>

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
