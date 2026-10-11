'use client';

import { ShieldCheck, FileText } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { LegalDocumentBody } from '@/components/legal/document-body';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | null;
}

/**
 * The signed-in Legal sheet.
 *
 * Renders the shared document body so this and the public `/privacy` and
 * `/terms` pages always show identical copy.
 */
export function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  if (!isOpen || !type) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const Icon = isPrivacy ? ShieldCheck : FileText;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[#14B8A6]" />
          {title}
        </span>
      }
    >
      <LegalDocumentBody type={type} />
    </Sheet>
  );
}

export default LegalModal;
