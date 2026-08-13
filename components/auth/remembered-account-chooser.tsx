'use client';

import Link from 'next/link';
import { X, ChevronRight, Zap } from 'lucide-react';
import { RememberedAccount } from '@/lib/auth/remembered-accounts';
import { Button } from '@/components/ui/button';

interface RememberedAccountChooserProps {
  accounts: RememberedAccount[];
  onSelectAccount: (account: RememberedAccount) => void;
  onRemoveAccount: (email: string) => void;
  onUseAnotherAccount: () => void;
}

export function RememberedAccountChooser({
  accounts,
  onSelectAccount,
  onRemoveAccount,
  onUseAnotherAccount,
}: RememberedAccountChooserProps) {
  const getInitials = (account: RememberedAccount) => {
    const nameStr = account.displayName || account.username || account.email;
    if (!nameStr) return 'U';
    const parts = nameStr.split('@')[0].split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const getLabel = (account: RememberedAccount) => {
    if (account.displayName) return account.displayName;
    if (account.username) return `@${account.username}`;
    return account.email.split('@')[0];
  };

  return (
    <div>
      {/* 1. Logo/brand */}
      <div className="flex flex-col items-center justify-center space-y-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-center text-[#14B8A6] shrink-0 shadow-sm">
          <Zap className="w-5 h-5 fill-current text-[#14B8A6]" />
        </div>
        <span className="text-base font-bold text-[#F5F7F6] tracking-tight">SubSync</span>
      </div>

      {/* 2. Header text */}
      <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight text-center">
        Welcome back
      </h1>
      <p className="text-xs sm:text-sm text-[#94A3B8] text-center mt-1.5 mb-7">
        Choose an account to continue
      </p>

      {/* 3. Account List */}
      <div className="space-y-2.5">
        {accounts.map((account) => (
          <div
            key={account.email}
            onClick={() => onSelectAccount(account)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectAccount(account);
              }
            }}
            className="w-full group p-3 sm:p-3.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] hover:border-[#14B8A6]/40 flex items-center justify-between gap-3 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              {account.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.avatarUrl}
                  alt={getLabel(account)}
                  className="w-9 h-9 rounded-full object-cover border border-[#1A1D1D] shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#14B8A6]/15 border border-[#14B8A6]/30 text-[#14B8A6] font-bold text-xs flex items-center justify-center shrink-0">
                  {getInitials(account)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-[#F5F7F6] truncate group-hover:text-[#14B8A6] transition-colors">
                  {getLabel(account)}
                </p>
                <p className="text-[11px] sm:text-xs text-[#94A3B8] truncate">
                  {account.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-0.5 transition-all" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAccount(account.email);
                }}
                aria-label={`Remove ${account.email} from saved accounts`}
                title="Remove account from device"
                className="p-1 rounded-full text-[#94A3B8] hover:text-[#D9363E] hover:bg-[#D9363E]/10 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 4. OR divider */}
      <div className="flex items-center gap-3 my-7 py-0.5">
        <div className="flex-1 h-px bg-[#1A1D1D]" />
        <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">OR</span>
        <div className="flex-1 h-px bg-[#1A1D1D]" />
      </div>

      {/* 5. Log in to another account */}
      <Button
        variant="secondary"
        size="md"
        onClick={onUseAnotherAccount}
        className="w-full text-xs sm:text-sm font-semibold h-10 sm:h-10.5 rounded-full"
      >
        Log in to another account
      </Button>

      {/* 6. Sign-up footer */}
      <div className="text-center mt-7 pt-1">
        <p className="text-xs text-[#94A3B8]">
          Don&apos;t have an account?{' '}
          <Link
            id="nav-to-signup-from-chooser"
            href="/signup"
            className="text-[#14B8A6] hover:underline font-semibold cursor-pointer"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
