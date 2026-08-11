import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'pmo-tracker:theme';

/** The saved choice, or the machine's own setting the first time anyone visits. */
export function readTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* The attribute goes on the document rather than on the app's own root, so the ground
   behind the page — the strip you see when a short screen is over-scrolled — changes with
   it. The tokens themselves are only redefined inside the shell, which is how the credit
   page stays as it is: it renders instead of the shell, never inside it.

   This is called once from main.tsx before anything renders. Left to an effect it would
   run after the first paint, and the whole site would flash light before turning. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return [theme, toggle];
}
