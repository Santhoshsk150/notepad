import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyDOMTheme = (newTheme: Theme) => {
  const root = document.documentElement;
  root.classList.add('no-theme-transition');
  if (newTheme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  try {
    localStorage.setItem('jnc_theme', newTheme);
  } catch {}
  // Remove temporary transition lock immediately on next frame
  requestAnimationFrame(() => {
    root.classList.remove('no-theme-transition');
  });
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('jnc_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch {}
    return 'light'; // Clean, friendly default theme
  });

  useEffect(() => {
    applyDOMTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const nextTheme: Theme = prev === 'dark' ? 'light' : 'dark';
      applyDOMTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    applyDOMTheme(newTheme);
    setThemeState(newTheme);
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
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
