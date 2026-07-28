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
  const [theme, setThemeState] = useState<Theme>('dark');

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light', 'theme-ivory', 'theme-sand');

    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'ivory') {
      root.classList.add('light', 'theme-ivory');
    } else if (newTheme === 'sand') {
      root.classList.add('light', 'theme-sand');
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('subsync-theme') as Theme | null;
    if (savedTheme && (savedTheme === 'dark' || savedTheme === 'ivory' || savedTheme === 'sand')) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Default to dark Midnight theme
      setThemeState('dark');
      applyTheme('dark');
    }
  }, [applyTheme]);

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
