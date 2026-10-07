'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Forward,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Info,
  Lock,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';

interface GmailStatus {
  connected: boolean;
  email?: string;
  lastScanAt?: string | null;
  lastScanCount?: number | null;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * Settings → Integrations. Both Plus features are surfaced as management
 * cards without leaking implementation details: a not-configured deployment
 * reads as "not configured on this deployment" rather than an env reference.
 */
export function IntegrationsSettingsPanel() {
  const { isPlus } = useUserSettings();
  const { toast } = useToast();
  const { addInboxItem } = useInbox();

  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailConfigError, setGmailConfigError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const [forwardingAddress, setForwardingAddress] = useState<string | null>(null);
  const [forwardingLoading, setForwardingLoading] = useState(true);
  const [forwardingNotConfigured, setForwardingNotConfigured] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadGmailStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/status');
      if (!res.ok) throw new Error('Status request failed.');
      setGmailStatus((await res.json()) as GmailStatus);
    } catch {
      setGmailStatus(null);
    } finally {
      setGmailLoading(false);
    }
  }, []);

  const loadForwardingAddress = useCallback(async () => {
    try {
      const res = await fetch('/api/emails/forwarding-address');
      if (res.status === 503) {
        setForwardingNotConfigured(true);
        return;
      }
      if (!res.ok) throw new Error('Address request failed.');
      const data = (await res.json()) as { address: string };
      setForwardingAddress(data.address);
    } catch {
      setForwardingNotConfigured(true);
    } finally {
      setForwardingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlus) return;
    // Deferred to a microtask: the loaders set loading state synchronously,
    // which would otherwise cascade a re-render on mount.
    queueMicrotask(() => {
      void loadGmailStatus();
      void loadForwardingAddress();
    });
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [isPlus, loadGmailStatus, loadForwardingAddress]);

  if (!isPlus) {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Integrations</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Connect Gmail or forward receipts to keep subscriptions fresh automatically</p>
        </div>
        <div className="rounded-xl bg-[#0F1111] border border-[#1A1D1D] p-6 text-center space-y-3">
          <Lock className="w-5 h-5 text-[#94A3B8] mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#F5F7F6]">Integrations are a Plus feature</h3>
            <p className="text-xs text-[#94A3B8]">
              Unlock Gmail receipt discovery and email forwarding on the Plus plan.
            </p>
          </div>
          <Link
            href="/plans?from=%2Fsettings%3Fsection%3Dintegrations"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors cursor-pointer"
          >
            Upgrade to Plus
          </Link>
        </div>
      </section>
    );
  }

  const handleConnectGmail = async () => {
    try {
      const res = await fetch('/api/gmail/auth');
      if (res.status === 500) {
        const body = await readJson(res);
        setGmailConfigError(
          (body.error as string) ?? 'Gmail is not configured on this deployment yet.'
        );
        return;
      }
      if (!res.ok) throw new Error('Auth request failed.');
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.assign(data.url);
    } catch {
      toast.error('Could not start the Gmail connection flow.', 'Error');
    }
  };

  const handleScanNow = async () => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const res = await fetch('/api/gmail/scan', { method: 'POST' });
      if (res.status === 401) {
        toast.error('Your session expired. Please sign in again.', 'Error');
        return;
      }
      const data = await readJson(res);
      if (!res.ok) {
        toast.error((data.error as string) ?? 'Gmail scan failed.', 'Scan Failed');
        return;
      }
      const discovered = Array.isArray(data.discovered) ? data.discovered : [];
      toast.success(
        `Scan complete — found ${discovered.length} subscription receipt(s).`,
        'Scan Complete'
      );
      await loadGmailStatus();
    } catch {
      toast.error('Gmail scan failed. Please try again.', 'Error');
    } finally {
      setScanBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/gmail/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Disconnect request failed.');
      setGmailStatus({ connected: false });
      setConfirmDisconnect(false);
      toast.success('Gmail disconnected.', 'Disconnected');
    } catch {
      toast.error('Could not disconnect Gmail.', 'Error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!forwardingAddress) return;
    try {
      await navigator.clipboard.writeText(forwardingAddress);
    } catch {
      // Clipboard can be blocked; the toast still confirms the address to copy.
    }
    setCopied(true);
    toast.success('Forwarding address copied to clipboard.', 'Copied');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleTestForwardedReceipt = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await fetch('/api/emails/test', { method: 'POST' });
      if (res.status === 503) {
        setForwardingNotConfigured(true);
        toast.error('Email forwarding is not configured on this deployment yet.', 'Error');
        return;
      }
      if (res.status === 401) {
        toast.error('Your session expired. Please sign in again.', 'Error');
        return;
      }
      const data = (await readJson(res)) as {
        status?: string;
        error?: string;
        name?: string;
      };
      if (data.status === 'rate_limited') {
        toast.error(data.error ?? 'Too many forwarded receipts in a short period.', 'Slow Down');
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Test receipt failed.', 'Error');
        return;
      }
      if (data.status === 'duplicate') {
        toast.info('This subscription is already tracked.', 'Already Tracked');
        return;
      }
      if (data.status === 'limit_reached') {
        toast.error('You have reached your monthly forwarded-receipt limit.', 'Limit Reached');
        return;
      }
      if (data.status === 'invalid') {
        toast.error('The test receipt could not be parsed.', 'Error');
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
    } catch {
      toast.error('Could not reach the forwarding test endpoint.', 'Error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Integrations</h2>
        <p className="text-xs text-[#94A3B8] mt-0.5">Connect Gmail or forward receipts to keep subscriptions fresh automatically</p>
      </div>

      {/* Gmail Connect */}
      <div className="rounded-xl bg-[#0F1111] border border-[#1A1D1D] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1A1D1D] border border-[#27272A] flex items-center justify-center text-[#F5F7F6] shrink-0">
              <Mail className="w-4 h-4 text-[#14B8A6]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#F5F7F6]">Gmail Connect</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Discover subscription receipts directly from your Gmail inbox.
              </p>
            </div>
          </div>
          {gmailStatus?.connected && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30 text-[11px] font-semibold shrink-0">
              Connected
            </span>
          )}
        </div>

        {gmailConfigError && (
          <div className="p-3 rounded-lg bg-[#121414] border border-[#D9363E]/30 text-[11px] text-[#94A3B8]">
            <span className="text-[#D9363E] font-semibold block mb-1">
              Not configured on this deployment
            </span>
            {gmailConfigError}
          </div>
        )}

        {gmailLoading ? (
          <p className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14B8A6]" />
            Checking connection…
          </p>
        ) : gmailStatus?.connected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#94A3B8]">
              <span className="flex items-center gap-1.5 min-w-0">
                <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                <span className="truncate">{gmailStatus.email}</span>
              </span>
              {gmailStatus.lastScanAt && (
                <span>
                  Last scan: {formatWhen(gmailStatus.lastScanAt)}
                  {gmailStatus.lastScanCount != null ? ` · ${gmailStatus.lastScanCount} found` : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleScanNow}
                disabled={scanBusy}
                className="h-9 px-3.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {scanBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{scanBusy ? 'Scanning…' : 'Scan now'}</span>
              </button>
              {confirmDisconnect ? (
                <>
                  <span className="text-[11px] text-[#94A3B8]">Disconnect Gmail?</span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="h-9 px-3.5 rounded-xl bg-[#D9363E]/10 hover:bg-[#D9363E]/20 text-[#D9363E] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="h-9 px-3.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
                  >
                    Keep connected
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="h-9 px-3.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#D9363E] border border-[#1A1D1D] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[#94A3B8] max-w-[46ch]">
              Authorize read access to scan your inbox for billing emails and quickly add the
              subscriptions it finds.
            </p>
            <button
              type="button"
              onClick={handleConnectGmail}
              className="h-9 px-4 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              Connect Gmail
            </button>
          </div>
        )}
      </div>

      {/* Email Forwarding */}
      <div className="rounded-xl bg-[#0F1111] border border-[#1A1D1D] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1A1D1D] border border-[#27272A] flex items-center justify-center text-[#F5F7F6] shrink-0">
            <Forward className="w-4 h-4 text-[#14B8A6]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F5F7F6]">Email Forwarding</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Manually forward any receipt or invoice to your personal SubHalt address.
            </p>
          </div>
        </div>

        {forwardingLoading ? (
          <p className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14B8A6]" />
            Checking forwarding address…
          </p>
        ) : forwardingNotConfigured ? (
          <div className="p-3 rounded-lg bg-[#121414] border border-[#1A1D1D] text-[11px] text-[#94A3B8]">
            <span className="font-semibold text-[#F5F7F6] block mb-0.5">
              Not configured on this deployment yet
            </span>
            An inbound email domain must be configured before receipt forwarding is available.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={forwardingAddress ?? ''}
                className="flex-1 bg-[#121414] border border-[#1A1D1D] rounded-xl px-3.5 py-2.5 text-xs text-[#14B8A6] font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyAddress}
                disabled={!forwardingAddress}
                className="h-10 px-3 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#F5F7F6] block">Test the flow</span>
                <span className="text-[11px] text-[#94A3B8]">
                  Send a sample receipt through the real pipeline
                </span>
              </div>
              <button
                type="button"
                onClick={handleTestForwardedReceipt}
                disabled={testing || !forwardingAddress}
                className="h-9 px-4 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {testing ? 'Processing…' : 'Send Test Receipt'}
              </button>
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-[#94A3B8]">
              <Info className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-px" />
              Any receipt or invoice forwarded to this address is parsed and added to your list
              automatically.
            </p>
          </>
        )}
      </div>
    </section>
  );
}