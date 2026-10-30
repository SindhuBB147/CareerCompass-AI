import { useEffect, useState } from 'react';

const THEME_KEY = 'cc_admin_theme';
const SIDEBAR_KEY = 'cc_admin_sidebar_collapsed';

export function useAdminTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    if (stored) {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true');
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  return { theme, toggleTheme, sidebarCollapsed, toggleSidebar };
}
