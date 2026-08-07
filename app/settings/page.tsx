'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, ShieldCheck, DollarSign, Save, Loader2, Moon, Sun, Check } from 'lucide-react';
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
  }> = [
    {
      id: 'midnight',
      name: 'Midnight (Default)',
      description: 'Clean dark interface featuring #101215 background, #171A21 section surfaces, #1D222B cards, and #4F46E5 primary accent.',
      icon: Moon,
    },
    {
      id: 'light',
      name: 'Light',
      description: 'Clean light environment for daytime usability.',
      icon: Sun,
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl min-h-[85vh] pb-32">
      <div className="space-y-1">
        <h1 className="text-[40px] font-bold text-white tracking-tight leading-[48px]">Settings</h1>
        <p className="text-[15px] text-[#A1AAB8] font-normal leading-[22px]">
          Manage your account credentials, theme preferences, and database security settings.
        </p>
      </div>

      {/* Theme Preference Settings Card (Midnight Default vs Light) */}
      <div className="p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-6">
        <div className="flex items-center gap-3 border-b border-[#2B313D] pb-4">
          <Moon className="w-5 h-5 text-[#6F7787]" />
          <div>
            <h2 className="text-[28px] font-bold text-white tracking-tight leading-[36px]">Appearance</h2>
            <p className="text-[15px] text-[#A1AAB8]">Choose your preferred application theme</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.id;
            const Icon = opt.icon;

            return (
              <div
                key={opt.id}
                onClick={() => {
                  setTheme(opt.id);
                  toast.success(`Theme set to ${opt.name}.`, 'Appearance Updated');
                }}
                className={`p-5 rounded-2xl border transition-colors cursor-pointer space-y-3 relative ${
                  isSelected
                    ? 'border-[#4F46E5] bg-[#1D222B]'
                    : 'border-[#2B313D] bg-[#1D222B] hover:border-[#4F46E5]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-[#4F46E5]' : 'text-[#6F7787]'}`} />
                    <span className="text-[18px] font-semibold text-white">{opt.name}</span>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-[#22C55E]" />}
                </div>

                <p className="text-[15px] text-[#A1AAB8] leading-[22px]">{opt.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Profile Settings Card */}
      <div className="p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-6">
        <div className="flex items-center gap-3 border-b border-[#2B313D] pb-4">
          <UserIcon className="w-5 h-5 text-[#6F7787]" />
          <div>
            <h2 className="text-[28px] font-bold text-white tracking-tight leading-[36px]">Profile Information</h2>
            <p className="text-[15px] text-[#A1AAB8]">Update your account name and view registration details.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#A1AAB8]">
            <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" />
            <span>Loading user profile...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#6F7787] block">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full h-11 px-4 py-2.5 text-xs rounded-xl border border-[#2B313D] text-[#6F7787] bg-[#1D222B] cursor-not-allowed"
                />
                <span className="text-[10px] text-[#6F7787]">Managed via Supabase Auth</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#6F7787] block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full h-11 px-4 py-2.5 text-xs rounded-xl border border-[#2B313D] bg-[#1D222B] text-white placeholder-[#6F7787] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Regional & Currency Preferences Card */}
      <div className="p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-4">
        <div className="flex items-center gap-3 border-b border-[#2B313D] pb-4">
          <DollarSign className="w-5 h-5 text-[#6F7787]" />
          <div>
            <h2 className="text-[28px] font-bold text-white tracking-tight leading-[36px]">Default Currency Preferences</h2>
            <p className="text-[15px] text-[#A1AAB8]">Default currency used when creating new subscriptions.</p>
          </div>
        </div>

        <div className="max-w-xs space-y-1.5">
          <label className="text-[13px] font-medium text-[#6F7787] block">Default Currency</label>
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              toast.info(`Default currency set to ${e.target.value}.`, 'Preference Updated');
            }}
            className="w-full h-11 px-4 py-2.5 text-xs rounded-xl border border-[#2B313D] bg-[#1D222B] text-white focus:outline-none focus:border-[#4F46E5] transition-colors"
          >
            <option value="USD" className="bg-[#1D222B] text-white">USD ($) - US Dollar</option>
            <option value="EUR" className="bg-[#1D222B] text-white">EUR (€) - Euro</option>
            <option value="GBP" className="bg-[#1D222B] text-white">GBP (£) - British Pound</option>
            <option value="CAD" className="bg-[#1D222B] text-white">CAD ($) - Canadian Dollar</option>
          </select>
        </div>
      </div>

      {/* Security & RLS Status Card */}
      <div className="p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
          <div>
            <h2 className="text-[28px] font-bold text-white tracking-tight leading-[36px]">Database Security & Row Level Security (RLS)</h2>
            <p className="text-[15px] text-[#22C55E] font-semibold">Active & Enforced in PostgreSQL</p>
          </div>
        </div>

        <p className="text-[15px] text-[#A1AAB8] leading-[22px] bg-[#1D222B] p-4 rounded-2xl border border-[#2B313D]">
          All subscription records are protected by Supabase Row Level Security (RLS) policies (`auth.uid() = user_id`). Your data is strictly isolated and inaccessible to any unauthenticated or third-party users.
        </p>
      </div>
    </div>
  );
}
