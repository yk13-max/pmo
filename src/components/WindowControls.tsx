import type { PortfolioView } from '../lib/derive';
import { MAX_YEAR } from '../types';
import { monthKeyLabel, monthOptions, planningMonths } from '../lib/dates';

/** The longest window offered, so a stray end date cannot ask for a thousand columns. */
const MAX_WINDOW = 120;
/** What the tracker opens on: this month and the five after it. */
export const DEFAULT_MONTHS = 6;

/* The planning window, shared by every screen that shows months side by side. One window
   serves them all, so moving it on one screen moves it on the rest. */
export function WindowControls({
  view,
  onSetWindow,
}: {
  view: PortfolioView;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  const labelStyle = {
    display: 'block',
    fontSize: 13,
    marginBottom: 5,
    color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
  } as const;
  const thisMonth = planningMonths(new Date())[0];
  const atDefault = view.months[0] === thisMonth && view.months.length === DEFAULT_MONTHS;

  return (
    <>
      <label className="field" style={{ margin: 0 }}>
        <span style={labelStyle}>Plan from</span>
        <select
          className="input"
          style={{ width: 'auto', minWidth: 110 }}
          value={view.months[0]}
          onChange={(e) => onSetWindow(e.target.value, view.months.length)}
        >
          {monthOptions(new Date().getFullYear() - 1, MAX_YEAR).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span style={labelStyle}>For</span>
        <select
          className="input"
          style={{ width: 'auto', minWidth: 110 }}
          value={view.months.length}
          onChange={(e) => onSetWindow(view.months[0], Number(e.target.value))}
        >
          {/* The current length is always offered, even when it came from a button. */}
          {[...new Set([3, DEFAULT_MONTHS, 12, 18, 24, 36, 48, 60, view.months.length])]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n} months
              </option>
            ))}
        </select>
      </label>
      {/* The way back to the usual view, from wherever the window has wandered. */}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ marginBottom: 2, whiteSpace: 'nowrap' }}
        disabled={atDefault}
        title={
          atDefault
            ? 'Already showing this month and the next five'
            : 'Back to this month and the next five'
        }
        onClick={() => onSetWindow(thisMonth, DEFAULT_MONTHS)}
      >
        This month + {DEFAULT_MONTHS - 1}
      </button>
      {/* A soft limit rather than a hard one: nothing stops a longer window, but this is how
          far out there is actually work to look at. */}
      {view.lastEndMonth && view.monthsToLastEnd > view.months.length && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginBottom: 2, whiteSpace: 'nowrap' }}
          title={`The last project runs to ${monthKeyLabel(view.lastEndMonth)}`}
          onClick={() => onSetWindow(view.months[0], Math.min(MAX_WINDOW, view.monthsToLastEnd))}
        >
          Show to {monthKeyLabel(view.lastEndMonth)}
        </button>
      )}
    </>
  );
}
