'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Mail,
  Camera,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Palette,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { ChangeEmailModal } from '@/components/settings/change-email-modal';

const AVATAR_ACCENT_COLORS = [
  { hex: '#14B8A6', label: 'Teal' },
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#3B82F6', label: 'Blue' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    fullName: initialFullName,
    email,
    lastNameChange,
    loading: settingsLoading,
    updateProfile,
  } = useUserSettings();

  const [fullName, setFullName] = useState(initialFullName);
  const [bio, setBio] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('subsync_user_bio') || '';
  });
  const [avatarColor, setAvatarColor] = useState(() => {
    if (typeof window === 'undefined') return '#14B8A6';
    return localStorage.getItem('subsync_avatar_color') || '#14B8A6';
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setFullName(initialFullName);
  }, [initialFullName]);

  useEffect(() => {
    async function fetchUserMeta() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }
    }
    fetchUserMeta();
  }, [supabase]);

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

  const isNameChanged = fullName.trim() !== initialFullName.trim();

  const getInitials = (nameStr: string): string => {
    if (!nameStr || !nameStr.trim()) return 'SU';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarUrl(dataUrl);

      try {
        await supabase.auth.updateUser({
          data: { avatar_url: dataUrl },
        });
        toast.success('Profile photo updated successfully.', 'Photo Uploaded');
      } catch {
        toast.error('Failed to update avatar picture.', 'Upload Error');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Please enter a valid display name.', 'Validation Error');
      return;
    }

    if (isNameChanged && isLockedBy30Days) {
      toast.error(
        `Display name can only be updated once every 30 days. Next change allowed on ${nextAllowedDateString}.`,
        'Name Restricted'
      );
      return;
    }

    setSaving(true);
    try {
      if (isNameChanged) {
        await updateProfile({ fullName: fullName.trim() });
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('subsync_user_bio', bio.trim());
        localStorage.setItem('subsync_avatar_color', avatarColor);
      }

      toast.success('Your profile details have been saved.', 'Profile Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      toast.error(msg, 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl min-h-[85vh] pb-24 animate-fade-in text-[#F5F7F6]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">Public Profile</h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
              Customize your profile avatar, display name, and bio details.
            </p>
          </div>
        </div>
      </div>

      {/* Main Profile Form Card */}
      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-5 sm:p-8 space-y-7 shadow-xl">
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-[#1A1D1D]">
          <div className="relative group">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={fullName || 'Avatar'}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-[#14B8A6] shadow-xl"
              />
            ) : (
              <div
                style={{ backgroundColor: `${avatarColor}20`, borderColor: `${avatarColor}50`, color: avatarColor }}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-xl transition-all"
              >
                {getInitials(fullName)}
              </div>
            )}

            {/* Photo Upload Overlay */}
            <label
              htmlFor="avatar-upload-input"
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
              title="Upload new profile picture"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#14B8A6]" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </label>
            <input
              id="avatar-upload-input"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
            <div>
              <h2 className="text-lg font-bold text-[#F5F7F6]">{fullName || 'SubSync User'}</h2>
              <p className="text-xs text-[#94A3B8]">{email || 'user@example.com'}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <label
                htmlFor="avatar-upload-input"
                className="px-3.5 py-2 rounded-xl bg-[#14B8A6]/15 hover:bg-[#14B8A6]/25 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="px-3 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {/* Generated Initials Color Customizer */}
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-2">
                Avatar Accent Color
              </span>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                {AVATAR_ACCENT_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => setAvatarColor(col.hex)}
                    style={{ backgroundColor: col.hex }}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      avatarColor === col.hex ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0B0D0D]' : 'hover:scale-110'
                    }`}
                    title={col.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Inputs Form */}
        <form onSubmit={handleSaveProfile} className="space-y-5">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full h-11 pl-10 pr-4 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>
            {isLockedBy30Days && (
              <p className="text-[11px] text-[#94A3B8] pt-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                <span>Display name can only be changed once every 30 days. Next change allowed on {nextAllowedDateString}.</span>
              </p>
            )}
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Email Address
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full h-11 pl-10 pr-4 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#94A3B8] cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsChangeEmailOpen(true)}
                className="h-11 px-4 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] text-[#14B8A6] text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Change Email
              </button>
            </div>
          </div>

          {/* Optional Short Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Short Bio (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Tell us a bit about yourself or your software portfolio..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3.5 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Prominent Save Button */}
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving || (isNameChanged && isLockedBy30Days)}
              className="w-full sm:w-auto min-w-[160px] h-12 px-7 rounded-xl bg-[#14B8A6] hover:opacity-90 disabled:opacity-50 text-[#091512] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg min-h-[44px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#091512]" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <ChangeEmailModal
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
      />
    </div>
  );
}
