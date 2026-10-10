'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/contexts/user-settings-context';

// Cached wall-clock snapshot so the 30-day name-change lockout stays accurate
// without impure Date.now() calls in render. getSnapshot MUST return a cached
// value — returning a fresh Date.now() per call makes useSyncExternalStore see
// a new snapshot on every render and loop until "Maximum update depth exceeded".
let clockSnapshot = Date.now();
function subscribeToClock(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const id = window.setInterval(() => {
    clockSnapshot = Date.now();
    onChange();
  }, 60_000);
  return () => window.clearInterval(id);
}
function getClockSnapshot(): number {
  return clockSnapshot;
}

export default function EditNamePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { fullName, lastNameChange, updateProfile } = useAuth();

  const [name, setName] = useState(fullName);
  const [saving, setSaving] = useState(false);

  // Keep the editable name in sync when the authenticated profile loads or changes
  // (render-phase adjustment, the documented alternative to setState-in-effect).
  const [prevFullName, setPrevFullName] = useState(fullName);
  if (fullName !== prevFullName) {
    setPrevFullName(fullName);
    setName(fullName);
  }

  const nowMs = useSyncExternalStore(subscribeToClock, getClockSnapshot, getClockSnapshot);

  const nextAllowedDate = (() => {
    if (!lastNameChange) return '';
    const next = new Date(new Date(lastNameChange).getTime() + 30 * 24 * 60 * 60 * 1000);
    return next.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  const isLocked = (() => {
    if (!lastNameChange) return false;
    return nowMs - new Date(lastNameChange).getTime() < 30 * 24 * 60 * 60 * 1000;
  })();

  const handleSave = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      toast.error('Please enter a valid display name.', 'Validation Error');
      return;
    }

    if (trimmed === (fullName || '').trim()) {
      router.back();
      return;
    }

    if (isLocked) {
      toast.error(
        `Display name can only be updated once every 30 days. Next change allowed on ${nextAllowedDate}.`,
        'Name Restricted'
      );
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ fullName: trimmed });
      toast.success('Your display name has been updated.', 'Name Updated');
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update your name.';
      toast.error(msg, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      {/* Header: bare back chevron + title */}
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Display Name</h1>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="display-name-input"
          className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block"
        >
          Display Name
        </label>
        <input
          id="display-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          autoFocus
          className="w-full h-12 px-4 text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
        />
        {isLocked && (
          <p className="text-[11px] text-[#94A3B8] pt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span>
              Display name can only be changed once every 30 days. Next change allowed on {nextAllowedDate}.
            </span>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-[#F5F7F6] hover:bg-white disabled:opacity-50 text-[#091512] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <span>Save</span>
        )}
      </button>
    </div>
  );
}
