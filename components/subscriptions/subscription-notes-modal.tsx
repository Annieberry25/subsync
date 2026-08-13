'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Loader2, Save } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { cleanNotesUserText, parseAccountLinks, formatNotesWithAccountLinks, updateSubscription } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface SubscriptionNotesModalProps {
  subscription: SubscriptionRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SubscriptionNotesModal({
  subscription,
  isOpen,
  onClose,
  onSaved,
}: SubscriptionNotesModalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (subscription) {
      setNotes(cleanNotesUserText(subscription.notes));
    } else {
      setNotes('');
    }
  }, [subscription]);

  if (!isOpen || !subscription) return null;

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const links = parseAccountLinks(subscription);
      const formattedNotes = formatNotesWithAccountLinks(notes, links);

      const { error } = await updateSubscription(subscription.id, {
        notes: formattedNotes,
      });

      if (error) throw error;

      toast.success(`Notes updated for ${subscription.name}.`, 'Notes Saved');
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save notes.';
      toast.error(msg, 'Save Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notes-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0F1111] border border-[#1A1D1D] rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 id="notes-modal-title" className="text-lg sm:text-xl font-bold text-[#F5F7F6] tracking-tight">
                Notes — {subscription.name}
              </h2>
              <p className="text-xs text-[#94A3B8]">Add custom notes, plan specifics, or reminder details</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notes modal"
            className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Editor Form */}
        <form onSubmit={handleSaveNotes} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Subscription Notes
            </label>
            <textarea
              rows={6}
              placeholder="Enter your notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-4 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-[#1A1D1D] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-full bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#091512]" />
                  <span>Save Notes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
