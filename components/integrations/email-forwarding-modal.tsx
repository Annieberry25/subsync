'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Forward, Copy, Check, Info, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useInbox } from '@/lib/contexts/inbox-context';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';

interface EmailForwardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
  onRequireUpgrade?: () => void;
}

export function EmailForwardingModal({ isOpen, onClose, onBack, onSuccess, onRequireUpgrade }: EmailForwardingModalProps) {
  const { addInboxItem } = useInbox();
  const { toast } = useToast();
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const loadAddress = useCallback(async () => {
    const res = await fetch('/api/emails/forwarding-address');
    if (res.status === 503) {
      setNotConfigured(true);
      return;
    }
    if (!res.ok) {
      toast.error('Could not load your forwarding address.', 'Error');
      return;
    }
    const data = (await res.json()) as { address: string };
    setAddress(data.address);
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    Promise.resolve()
      .then(() => {
        setLoadingAddress(true);
        return loadAddress();
      })
      .finally(() => setLoadingAddress(false));
  }, [isOpen, loadAddress]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Forwarding address copied to clipboard.', 'Copied');
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleTestForwardedReceipt = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/emails/test', { method: 'POST' });
      if (res.status === 503) {
        setNotConfigured(true);
        toast.error('Email forwarding is not configured yet.', 'Error');
        return;
      }
      if (res.status === 401) {
        toast.error('Your session expired. Please sign in again.', 'Error');
        return;
      }
      const data = (await res.json()) as { status?: string; error?: string; name?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Test receipt failed.', 'Error');
        return;
      }
      if (data.status === 'duplicate') {
        toast.info('This subscription was already detected.', 'Already Tracked');
        return;
      }
      if (data.status === 'limit_reached') {
        onClose();
        onRequireUpgrade?.();
        return;
      }
      if (data.name) {
        addInboxItem({
          type: 'plan_update',
          title: 'Forwarded Receipt Processed',
          description: `SubHalt received and extracted "${data.name}" from your forwarded email.`,
          subscriptionName: data.name,
          actionType: 'view',
          actionLabel: 'View Subscription',
        });
      }
      toast.success('Test receipt extracted and saved!', 'Receipt Processed');
      onSuccess?.();
      onClose();
    } catch {
      toast.error('Could not reach the forwarding test endpoint.', 'Error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
            <Forward className="w-4 h-4" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
              Receipt Email Forwarding
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              Manual Receipt Forwarding Address
            </span>
          </span>
        </span>
      }
      headerAction={
        onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Add Subscription menu"
            className="w-11 h-11 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : null
      }
      footer={
        <div className="flex justify-end gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      }
    >
        {/* Modal Body */}
        <div className="space-y-5">
          {/* Distinction Callout Banner */}
          <div className="p-4 rounded-xl bg-[#121414] border border-[#14B8A6]/30 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-[#F5F7F6]">
              <Info className="w-4 h-4 text-[#14B8A6] shrink-0" />
              <span>Connect Gmail ≠ Email Forwarding</span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F5F7F6]">Connect Gmail</strong> lets SubHalt discover relevant billing emails through authorized access.
              <br />
              <strong className="text-[#F5F7F6]">Email Forwarding</strong> allows you to manually forward any receipt or invoice to your custom SubHalt receiving address.
            </p>
          </div>

          {notConfigured ? (
            <div className="p-4 rounded-xl bg-[#0F1111] border border-[#1A1D1D] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-xs text-[#F5F7F6]">
                <Info className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span>Email Forwarding is not configured yet</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                An inbound email domain and webhook must be configured on this SubHalt deployment before
                you can use manual receipt forwarding. Reach out to your administrator.
              </p>
            </div>
          ) : (
            <>
              {/* Forwarding Address Box */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#F5F7F6] block">
                  Your Personal SubHalt Receiving Address:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={address ?? (loadingAddress ? 'Loading…' : '')}
                    className="flex-1 bg-[#121414] border border-[#1A1D1D] rounded-xl px-3.5 py-2.5 text-xs text-[#14B8A6] font-mono select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!address}
                    className="px-3 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Test flow button */}
              <div className="p-4 rounded-xl bg-[#0F1111] border border-[#1A1D1D] flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-[#F5F7F6] block">
                    Test Forwarding Flow
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">
                    Send a sample receipt through the real pipeline
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTestForwardedReceipt}
                  disabled={testing || !address}
                  className="px-3.5 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testing ? <span>Processing...</span> : <span>Send Test Receipt</span>}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                <span>Any receipt or invoice forwarded to your address is parsed and added to your list automatically.</span>
              </div>
            </>
          )}

        </div>
    </Sheet>
  );
}