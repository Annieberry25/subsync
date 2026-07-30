'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'ivory' | 'sand';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subsync-theme') as Theme | null;
      if (saved === 'dark' || saved === 'ivory' || saved === 'sand') {
        return saved;
      }
    }
    return 'dark';
  });

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;

    // Temporarily add .theme-switching to disable color/background/border/shadow transitions during the swap
    root.classList.add('theme-switching');

    const isDark = newTheme === 'dark';
    const isIvory = newTheme === 'ivory';
    const isSand = newTheme === 'sand';

    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.classList.toggle('theme-ivory', isIvory);
    root.classList.toggle('theme-sand', isSand);

    // Force browser reflow to apply new theme colors instantaneously in 1 frame
    void root.offsetHeight;

    // Remove .theme-switching on next animation frame to preserve normal hover/interaction animations
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('subsync-theme', newTheme);
    applyTheme(newTheme);
  };

  const cycleTheme = () => {
    const themeOrder: Theme[] = ['dark', 'ivory', 'sand'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
