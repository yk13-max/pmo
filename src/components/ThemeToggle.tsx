import type { Theme } from '../lib/theme';

/* A half-filled disc: the same shape either way round, filled on the side the theme is
   going to. It sits with the page's other buttons rather than floating over the corner,
   so it cannot land on top of anything, and it is drawn quietly enough to be found only
   when looked for. */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const to = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle no-print"
      onClick={onToggle}
      title={`Switch to the ${to} theme`}
      aria-label={`Switch to the ${to} theme`}
      aria-pressed={theme === 'dark'}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {/* The lit half. Which side it is on says which way the switch goes. */}
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </svg>
    </button>
  );
}
