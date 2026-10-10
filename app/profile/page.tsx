'use client';
import { safeGetItem } from '@/lib/safe-local-storage';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { goBack } from '@/lib/back-nav';
import { createClient } from '@/lib/supabase/client';
import { Camera, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/contexts/user-settings-context';

const AVATAR_ACCENT_COLORS = [
  { hex: '#14B8A6', label: 'Teal' },
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#3B82F6', label: 'Blue' },
];

/** OPay-style navigable row: label on the left, value + chevron on the right. */
function InfoLinkRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link
      href={href}
      className="w-full flex items-center justify-between gap-4 min-h-[56px] pl-4 pr-5 transition-colors hover:bg-[#121414] cursor-pointer"
    >
      <span className="text-sm text-[#94A3B8] shrink-0">{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-[#F5F7F6] text-right truncate min-w-0">
          {value}
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 text-[#5A6461]" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { fullName, email, avatarColor, updateAvatarColor } = useAuth();

  const [bio] = useState(() => {
    if (typeof window === 'undefined') return '';
    return safeGetItem('subhalt_user_bio') || '';
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchUserMeta() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }
    }
    fetchUserMeta();
  }, [supabase]);

  const getInitials = (name: string) => {
    if (!name || !name.trim()) return 'SU';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: result } });
      setUploadingAvatar(false);
      if (error) {
        toast.error('Could not update your photo. Please try again.', 'Upload Failed');
      } else {
        toast.success('Your photo has been updated.', 'Photo Updated');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAccentSelect = (hex: string) => {
    void updateAvatarColor(hex);
  };

  const bioSnippet = bio.trim() ? bio.trim() : 'Add a short bio';

  return (
    <div className="space-y-6 max-w-3xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      {/* Header: bare back chevron + title */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => goBack(router)}
          aria-label="Go back"
          data-touch="compact"
          className="w-9 h-9 -ml-2 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Profile</h1>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <div className="relative">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={fullName || 'Profile picture'}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover shadow-lg"
            />
          ) : (
            <div
              style={{ backgroundColor: `${avatarColor}1A`, color: avatarColor }}
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold transition-colors"
            >
              {getInitials(fullName)}
            </div>
          )}

          <label
            htmlFor="avatar-upload-input"
            className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-[#14B8A6] text-[#091512] flex items-center justify-center cursor-pointer shadow-lg transition-opacity hover:opacity-90"
            title="Change profile photo"
          >
            {uploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
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

        <div className="space-y-0.5">
          <h2 className="text-lg font-bold text-[#F5F7F6]">{fullName || 'SubHalt User'}</h2>
          <p className="text-xs text-[#94A3B8]">{email || 'user@example.com'}</p>
        </div>
      </div>

      {/* Info list */}
      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden divide-y divide-[#1A1D1D]">
        <InfoLinkRow href="/profile/name" label="Display Name" value={fullName || 'SubHalt User'} />
        <InfoLinkRow href="/profile/email" label="Email" value={email || 'user@example.com'} />

        {/* Avatar accent lives inline in the list, right before the bio. */}
        <div className="flex items-center justify-between gap-4 min-h-[56px] px-4">
          <span className="text-sm text-[#94A3B8] shrink-0">Avatar Accent</span>
          <div className="flex items-center gap-2">
            {AVATAR_ACCENT_COLORS.map((col) => {
              const selected = avatarColor === col.hex;
              return (
                <button
                  key={col.hex}
                  type="button"
                  onClick={() => handleAccentSelect(col.hex)}
                  aria-label={`Use ${col.label} accent`}
                  title={col.label}
                  aria-pressed={selected}
                  data-touch="compact"
                  style={{ backgroundColor: col.hex }}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                    selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0B0D0D]' : 'hover:scale-110'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <InfoLinkRow href="/profile/bio" label="Short Bio" value={bioSnippet} />
      </div>
    </div>
  );
}
