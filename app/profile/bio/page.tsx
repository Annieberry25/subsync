'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeGetItem, safeSetItem } from '@/lib/safe-local-storage';

const MAX_BIO_LENGTH = 160;

export default function EditBioPage() {
  const router = useRouter();

  const [bio, setBio] = useState(() => {
    if (typeof window === 'undefined') return '';
    return safeGetItem('subhalt_user_bio') || '';
  });

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      safeSetItem('subhalt_user_bio', bio.trim());
    }
    // No confirmation toast: the page closes on save, so a message would only
    // flash over the screen the user just asked to leave.
    router.back();
  };

  return (
    <div className="space-y-6 max-w-3xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      {/* Header: Cancel (red) and Save (white) share the top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          data-touch="compact"
          className="h-9 px-1 flex items-center text-sm font-semibold text-[#D9363E] hover:opacity-80 transition-opacity cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          data-touch="compact"
          className="h-9 px-1 flex items-center text-sm font-semibold text-[#F5F7F6] hover:opacity-80 transition-opacity cursor-pointer"
        >
          Save
        </button>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="bio-input"
          className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block"
        >
          Short Bio
        </label>
        <textarea
          id="bio-input"
          rows={5}
          maxLength={MAX_BIO_LENGTH}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us a bit about yourself or your software portfolio..."
          autoFocus
          className="w-full p-4 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none leading-relaxed"
        />
        <p className="text-[11px] text-[#94A3B8] text-right">
          {bio.length}/{MAX_BIO_LENGTH}
        </p>
      </div>
    </div>
  );
}
