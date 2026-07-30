'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, ShieldCheck, DollarSign, Save, Loader2, Moon, Sun, Feather, Check } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useTheme, type Theme } from '@/lib/hooks/use-theme';

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setFullName(user.user_metadata?.full_name || '');
      }
      setLoading(false);
    }
    loadUser();
  }, [supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter a valid full name.', 'Validation Error');
      return;
    }

    setSaving(true);

    try {
      const { error: err } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (err) throw err;

      toast.success('Profile information saved successfully.', 'Profile Updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      toast.error(msg, 'Update Error');
    } finally {
      setSaving(false);
    }
  };

  const themeOptions: Array<{
    id: Theme;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    previewBg: string;
    previewCard: string;
    previewText: string;
    previewAccent: string;
  }> = [
    {
      id: 'dark',
      name: 'Midnight (Dark Obsidian)',
      description: 'Deep obsidian space environment with neon indigo glassmorphic highlights.',
      icon: Moon,
      previewBg: 'bg-[#060609]',
      previewCard: 'bg-[#111119] border-[#1e1e2d]',
      previewText: 'text-[#f8fafc]',
      previewAccent: 'bg-[#6366f1]',
    },
    {
      id: 'ivory',
      name: 'Ivory (Warm Cream)',
      description: 'Warm premium linen ivory palette with soft purple frosted glass accents.',
      icon: Sun,
      previewBg: 'bg-[#f8f5ee]',
      previewCard: 'bg-[#f1ebde] border-[#ded5c2]',
      previewText: 'text-[#1c1917]',
      previewAccent: 'bg-[#9333ea]',
    },
    {
      id: 'sand',
      name: 'Sand (Soft Golden Sand)',
      description: 'Soft warm golden-sand environment with deep espresso typography.',
      icon: Feather,
      previewBg: 'bg-[#eee4ce]',
      previewCard: 'bg-[#e5d7bb] border-[#d1c1a0]',
      previewText: 'text-[#292524]',
      previewAccent: 'bg-[#c2410c]',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl bg-ambient-grid min-h-[85vh] pb-24 sm:pb-32">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-env-heading tracking-tight">Settings</h2>
        <p className="text-xs text-env-body mt-1">
          Manage your account credentials, display preferences, and database security settings.
        </p>
      </div>

      {/* Environmental Theme Selector Card System */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-env-main pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-env-heading">Environmental Atmospheric Themes</h3>
              <p className="text-xs text-env-body">Transform the entire app background, sidebar, header, cards, and typography.</p>
            </div>
          </div>

          <span className="text-xs font-bold px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider shrink-0 self-start sm:self-auto">
            3 Cohesive Environments
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.id;
            const Icon = opt.icon;

            return (
              <div
                key={opt.id}
                onClick={() => {
                  setTheme(opt.id);
                  toast.success(`Switched environment workspace to ${opt.name}.`, 'Environment Updated');
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative group ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                    : 'border-env-main hover:border-env-border-hover'
                }`}
              >
                {/* Visual Mini Preview */}
                <div className={`h-24 w-full rounded-xl ${opt.previewBg} p-2.5 flex flex-col justify-between border border-env-subtle shadow-inner`}>
                  <div className="flex items-center justify-between">
                    <div className="w-3 h-3 rounded-full bg-rose-500/60" />
                    <div className={`w-8 h-2 rounded-md ${opt.previewAccent}`} />
                  </div>
                  <div className={`p-2 rounded-lg ${opt.previewCard} space-y-1`}>
                    <div className={`h-2 w-12 rounded ${opt.previewAccent}`} />
                    <div className={`h-1.5 w-16 rounded opacity-60 bg-current ${opt.previewText}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-env-muted'}`} />
                    <span className="text-xs font-bold text-env-heading">{opt.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </div>

                <p className="text-[11px] text-env-body leading-snug">{opt.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Profile Settings Card */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-env-main pb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-env-heading">Profile Information</h3>
            <p className="text-xs text-env-body">Update your account name and view registration details.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 flex items-center justify-center gap-2 text-xs text-env-body">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Loading user profile...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-env-body block">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-muted bg-env-badge cursor-not-allowed"
                />
                <span className="text-[10px] text-env-muted">Managed via Supabase Auth</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-env-body block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading placeholder-env-muted focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Regional & Currency Preferences Card */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3 border-b border-env-main pb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-env-heading">Default Currency & Regional Preferences</h3>
            <p className="text-xs text-env-body">Default currency used when creating new subscriptions.</p>
          </div>
        </div>

        <div className="max-w-xs space-y-1.5">
          <label className="text-xs font-semibold text-env-body block">Default Currency</label>
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              toast.info(`Default currency set to ${e.target.value}.`, 'Preference Updated');
            }}
            className="w-full h-11 px-4 py-2.5 text-xs rounded-2xl border text-env-heading focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="USD" className="bg-env-card text-env-heading">USD ($) - US Dollar</option>
            <option value="EUR" className="bg-env-card text-env-heading">EUR (€) - Euro</option>
            <option value="GBP" className="bg-env-card text-env-heading">GBP (£) - British Pound</option>
            <option value="CAD" className="bg-env-card text-env-heading">CAD ($) - Canadian Dollar</option>
          </select>
        </div>
      </div>

      {/* Security & RLS Status Card */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-env-heading">Database Security & Row Level Security (RLS)</h3>
            <p className="text-xs text-emerald-400 font-bold">Active & Enforced in PostgreSQL</p>
          </div>
        </div>

        <p className="text-xs text-env-body leading-relaxed bg-env-badge p-4 rounded-2xl border border-env-main">
          All subscription records are protected by Supabase Row Level Security (RLS) policies (`auth.uid() = user_id`). Your data is strictly isolated and inaccessible to any unauthenticated or third-party users.
        </p>
      </div>
    </div>
  );
}
