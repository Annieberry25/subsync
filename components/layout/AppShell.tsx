'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { ToastProvider } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { UserSettingsProvider } from '@/lib/contexts/user-settings-context';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isAuthPage) {
    return (
      <ThemeProvider>
        <UserSettingsProvider>
          <ToastProvider>
            <div className="min-h-screen bg-[#101215] text-white antialiased font-sans flex items-center justify-center p-4">
              {children}
              <ToastContainer />
            </div>
          </ToastProvider>
        </UserSettingsProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <UserSettingsProvider>
        <ToastProvider>
          <div className="flex min-h-screen bg-[#101215] text-white antialiased font-sans">
            {/* Sidebar */}
            <Sidebar
              isMobileOpen={mobileMenuOpen}
              onMobileClose={() => setMobileMenuOpen(false)}
            />

            {/* Main Content Viewport */}
            <div className="flex-1 flex flex-col min-w-0">
              <Header
                onMobileMenuToggle={() => setMobileMenuOpen(true)}
              />
              <main className="flex-1 px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4 lg:pt-5 pb-12 sm:pb-8 overflow-y-auto w-full max-w-full overflow-x-hidden">
                <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
                  {children}
                </div>
              </main>
            </div>

            <ToastContainer />
          </div>
        </ToastProvider>
      </UserSettingsProvider>
    </ThemeProvider>
  );
}
