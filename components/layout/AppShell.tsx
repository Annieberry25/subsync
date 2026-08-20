'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { ToastProvider } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { UserSettingsProvider } from '@/lib/contexts/user-settings-context';
import { InboxProvider } from '@/lib/contexts/inbox-context';
import { AskSubHaltModal } from '@/components/ai/ask-subhalt-modal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullPage = pathname === '/login' || pathname === '/signup' || pathname === '/plans';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askInitialQuestion, setAskInitialQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleOpenAsk = (e: CustomEvent<{ question?: string }> | Event) => {
      const q = (e as CustomEvent)?.detail?.question;
      setAskInitialQuestion(q);
      setIsAskModalOpen(true);
    };

    window.addEventListener('subsync_open_ask_modal', handleOpenAsk as EventListener);
    return () => {
      window.removeEventListener('subsync_open_ask_modal', handleOpenAsk as EventListener);
    };
  }, []);

  return (
    <ThemeProvider>
      <UserSettingsProvider>
        <InboxProvider>
          <ToastProvider>
            {isFullPage ? (
              <div className="min-h-screen bg-[#000000] text-white antialiased font-sans">
                {children}
                <ToastContainer />
              </div>
            ) : (
              <div className="flex min-h-screen bg-[#000000] text-white antialiased font-sans">
                {/* Sidebar */}
                <Sidebar
                  isMobileOpen={mobileMenuOpen}
                  onMobileClose={() => setMobileMenuOpen(false)}
                />

                {/* Main Content Viewport */}
                <div className="flex-1 flex flex-col min-w-0">
                  <Header
                    onMobileMenuToggle={() => setMobileMenuOpen(true)}
                    onOpenAskSubHalt={() => {
                      setAskInitialQuestion(undefined);
                      setIsAskModalOpen(true);
                    }}
                  />
                  <main className="flex-1 px-3 sm:px-6 lg:px-8 pt-6 sm:pt-7 lg:pt-8 pb-12 sm:pb-8 overflow-y-auto w-full max-w-full overflow-x-hidden">
                    <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
                      {children}
                    </div>
                  </main>
                </div>

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
