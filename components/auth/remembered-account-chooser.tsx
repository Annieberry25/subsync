'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { RememberedAccount } from '@/lib/auth/remembered-accounts';
import { Button } from '@/components/ui/button';
import { BrandWordmark } from '@/components/ui/brand-logo';

interface RememberedAccountChooserProps {
  accounts: RememberedAccount[];
  onSelectAccount: (account: RememberedAccount) => void;
  onRemoveAccount?: (email: string) => void;
  /** Opens the full sign-in form, which is where the providers live. */
  onUseAnotherAccount: () => void;
}

export function RememberedAccountChooser({
  accounts,
  onSelectAccount,
  onRemoveAccount: _onRemoveAccount,
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
        <BrandWordmark height={30} priority />
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
            className="w-full group p-3 sm:p-3.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] hover:border-[#2A2F2F] flex items-center justify-between gap-3 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-[#2A2F2F]"
          >
            <div className="flex items-center gap-3 min-w-0">
              {account.avatarUrl ? (
                <Image
                  src={account.avatarUrl}
                  alt={getLabel(account)}
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover border border-[#1A1D1D] shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1A1D1D] border border-[#2A2F2F] text-[#F5F7F6] font-bold text-xs flex items-center justify-center shrink-0">
                  {getInitials(account)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-[#F5F7F6] truncate group-hover:text-[#94A3B8] transition-colors">
                  {getLabel(account)}
                </p>
                <p className="text-[11px] sm:text-xs text-[#94A3B8] truncate">
                  {account.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        ))}
      </div>

      {/*
       * No provider buttons here, deliberately.
       *
       * This screen answers one question: which saved account are you? It listed
       * the providers underneath as well, and that muddied it — the same Google
       * destination was one tap away in two places, and picking the button instead
       * of the account skipped the lookup that decides how that account must
       * authenticate, which is how a Google account ended up being shown a
       * password form.
       *
       * Choosing an account goes through Google, with Google's own picker, because
       * that is how the account signs in. Anyone else taps the button below, which
       * opens the full form where the providers live.
       */}
      <Button
        variant="secondary"
        size="md"
        onClick={onUseAnotherAccount}
        className="w-full mt-6 text-xs sm:text-sm font-semibold h-10 sm:h-10.5 rounded-full"
      >
        Sign in with another account
      </Button>

      {/* 7. Sign-up footer */}
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
