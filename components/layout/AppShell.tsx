'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileDock from './MobileDock';
import MoreSheet from './MoreSheet';
import ContextualFab from './ContextualFab';
import { ToastProvider } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { UserSettingsProvider } from '@/lib/contexts/user-settings-context';
import { InboxProvider } from '@/lib/contexts/inbox-context';
import { AskSubHaltModal } from '@/components/ai/ask-subhalt-modal';
import { isFullPageRoute } from '@/lib/nav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullPage = isFullPageRoute(pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  /**
   * The More sheet is keyed to the route it was opened on rather than holding
   * a boolean. Navigating away therefore closes it for free, and it also closes
   * when a redirect or another sheet changes the route, which an
   * `onClick`->`onClose` handler alone would miss.
   */
  const [moreOpenFor, setMoreOpenFor] = useState<string | null>(null);
  const isMoreOpen = moreOpenFor === pathname;
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askInitialQuestion, setAskInitialQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleOpenAsk = (e: CustomEvent<{ question?: string }> | Event) => {
      const q = (e as CustomEvent)?.detail?.question;
      setAskInitialQuestion(q);
      setIsAskModalOpen(true);
    };

    window.addEventListener('subhalt_open_ask_modal', handleOpenAsk as EventListener);
    return () => {
      window.removeEventListener('subhalt_open_ask_modal', handleOpenAsk as EventListener);
    };
  }, []);

  return (
    <ThemeProvider>
      <UserSettingsProvider>
        <InboxProvider>
          <ToastProvider>
            {isFullPage ? (
              <div className="min-h-[100dvh] bg-[#000000] text-white antialiased font-sans">
                {children}
                <ToastContainer />
              </div>
            ) : (
              <div className="flex min-h-[100dvh] bg-[#000000] text-white antialiased font-sans">
                {/* Sidebar */}
                <Sidebar
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
                />

                {/* Main Content Viewport */}
                <div className="flex-1 flex flex-col min-w-0">
                  <Header
                    onOpenAskSubHalt={() => {
                      setAskInitialQuestion(undefined);
                      setIsAskModalOpen(true);
                    }}
                  />
                  {/*
                    The document is the scroll container, not `main`. A nested
                    `overflow-y-auto` here would break iOS Safari address-bar
                    collapse and pull-to-refresh, and would stop `position:
                    sticky` table headers from resolving against the viewport.
                    `overflow-x-clip` still contains wide content without
                    creating a second scroll axis.

                    The bottom padding reserves room for the dock, which is
                    fixed and would otherwise sit over the last row of content.
                  */}
                  <main
                    id="main-content"
                    className="flex-1 px-(--spacing-gutter) pt-6 sm:pt-7 lg:pt-8 pb-[calc(var(--spacing-dock)+var(--spacing-safe-b)+5.5rem)] lg:pb-8 overflow-x-clip w-full max-w-full"
                  >
                    <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
                      {children}
                    </div>
                  </main>
                </div>

                <MobileDock onOpenMore={() => setMoreOpenFor(pathname)} moreOpen={isMoreOpen} />
                <MoreSheet open={isMoreOpen} onClose={() => setMoreOpenFor(null)} />
                <ContextualFab />

                <AskSubHaltModal
                  isOpen={isAskModalOpen}
                  onClose={() => setIsAskModalOpen(false)}
                  initialQuestion={askInitialQuestion}
                  onSelectSubscription={(sub) => {
                    router.push(`/subscriptions?highlight=${encodeURIComponent(sub.id)}&detail=true`);
                  }}
                />

                <ToastContainer />
              </div>
            )}
          </ToastProvider>
        </InboxProvider>
      </UserSettingsProvider>
    </ThemeProvider>
  );
}
