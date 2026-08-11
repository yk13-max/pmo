import { useCallback, useEffect, useState } from 'react';
import type { ScreenId } from '../App';

// `about` is reachable by address but never by the menu, which is the point of it.
const SCREENS: ScreenId[] = ['portfolio', 'resources', 'financials', 'timeline', 'detail', 'planning', 'alerts', 'data', 'about'];

export interface Route {
  screen: ScreenId;
  /** Which project the detail screen is showing, so back returns to the same one. */
  projectId: string | null;
}

export function parseHash(hash: string): Route | null {
  const [, screen, projectId] = hash.replace(/^#\/?/, '/').split('/');
  if (!SCREENS.includes(screen as ScreenId)) return null;
  return { screen: screen as ScreenId, projectId: projectId ? decodeURIComponent(projectId) : null };
}

export function toHash({ screen, projectId }: Route): string {
  // Only the detail screen is about one project, so only it carries an id in the address.
  return screen === 'detail' && projectId ? `#/${screen}/${encodeURIComponent(projectId)}` : `#/${screen}`;
}

/* The address bar is the single source of truth for which screen is on show, so the
   browser's own back and forward move between the areas you have been in. Every
   navigation writes a hash; the hashchange that follows — whether from a click or from
   the back button — is what actually changes the screen. */
export function useRoute(initial: Route): [Route, (next: Partial<Route>) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash) ?? initial);

  useEffect(() => {
    // A first visit with no hash gets one, without adding an entry to go back through.
    if (!parseHash(window.location.hash)) {
      window.history.replaceState(null, '', toHash(route));
    }
    const onChange = () => {
      const next = parseHash(window.location.hash);
      if (next) setRoute(next);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
    // Runs once: after mount the hash leads and this listener follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((next: Partial<Route>) => {
    setRoute((prev) => {
      const merged = { ...prev, ...next };
      const hash = toHash(merged);
      // Re-selecting the screen you are on should not stack up history entries.
      if (hash !== window.location.hash) window.location.hash = hash;
      return merged;
    });
  }, []);

  return [route, go];
}
