'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { ToastProvider } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast';
import { ThemeProvider } from '@/lib/hooks/use-theme';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isAuthPage) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <div className="min-h-screen bg-env-main text-env-body antialiased font-sans flex items-center justify-center p-4 transition-colors duration-300">
            {children}
            <ToastContainer />
          </div>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex min-h-screen pt-2 sm:pt-3 bg-env-main text-env-body antialiased font-sans transition-colors duration-300">
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
            <main className="flex-1 px-4 sm:px-6 md:px-8 pt-1.5 sm:pt-2.5 md:pt-3 pb-4 sm:pb-6 md:pb-8 overflow-y-auto">
              <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                {children}
              </div>
            </main>
          </div>

          <ToastContainer />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
