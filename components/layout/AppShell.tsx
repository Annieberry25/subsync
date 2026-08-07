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
          <div className="min-h-screen bg-[#101215] text-white antialiased font-sans flex items-center justify-center p-4">
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
            <main className="flex-1 px-4 md:px-6 lg:px-8 pt-3 md:pt-4 lg:pt-5 pb-8 overflow-y-auto">
              <div className="max-w-7xl mx-auto space-y-6">
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

