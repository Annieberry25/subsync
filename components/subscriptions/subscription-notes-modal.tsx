'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { cleanNotesUserText, parseAccountLinks, formatNotesWithAccountLinks, updateSubscription } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';

interface SubscriptionNotesModalProps {
  subscription: SubscriptionRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const NOTES_FORM_ID = 'subscription-notes-form';

export default function SubscriptionNotesModal({
  subscription,
  isOpen,
  onClose,
  onSaved,
}: SubscriptionNotesModalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset notes when a different subscription is opened (render-phase adjustment).
  const [prevSubId, setPrevSubId] = useState<string | null>(subscription?.id ?? null);
  if ((subscription?.id ?? null) !== prevSubId) {
    setPrevSubId(subscription?.id ?? null);
    setNotes(subscription ? cleanNotesUserText(subscription.notes) : '');
  }

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
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="md"
          title={`Notes: ${subscription.name}`}
      description="Add custom notes, plan specifics, or reminder details."
      bodyClassName="flex items-start"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#1A1D1D] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form={NOTES_FORM_ID}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#091512]" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Notes</span>
            )}
          </button>
        </div>
      }
    >
      <div className="w-full">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        {/* Editor Form. Actions live in the Sheet footer and submit via `form`. */}
        <form id={NOTES_FORM_ID} onSubmit={handleSaveNotes} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="subscription-notes-input"
              className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block"
            >
              Subscription Notes
            </label>
            <textarea
              id="subscription-notes-input"
              rows={6}
              placeholder="Enter your notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-4 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none leading-relaxed min-h-[40dvh]"
            />
          </div>
        </form>
      </div>
    </Sheet>
  );
}
