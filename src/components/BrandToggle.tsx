/* Folds the lockup away. Minimised, the mark shrinks to the size of a line of type and sits
   beside the tagline, and the name comes off — the name is what the menu is for on the first
   visit, and dead weight on the hundredth. It sits beside the theme switch because it is the
   same kind of thing: a preference about the chrome rather than about the work. */
export function BrandToggle({ small, onToggle }: { small: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="brand-toggle no-print"
      onClick={onToggle}
      title={small ? 'Show the full logo' : 'Shrink the logo'}
      aria-label={small ? 'Show the full logo' : 'Shrink the logo'}
      aria-pressed={small}
    >
      {/* Up to fold it away, down to bring it back — the direction the thing itself moves. */}
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
        <path
          d={small ? 'M6.5 10l5.5 5.5 5.5-5.5' : 'M6.5 14L12 8.5l5.5 5.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
