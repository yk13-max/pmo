const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM` for the month a date falls in. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** `14 Aug` — the compact form used on cards. */
export function shortDate(iso: string): string {
  const d = fromISO(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]}`;
}

/** `Aug '26` — used on timeline and resourcing axes. */
export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

export function shortMonth(monthKeyStr: string): string {
  const m = Number(monthKeyStr.split('-')[1]);
  return MONTH_NAMES[m - 1];
}

export function quarterLabel(d: Date): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`;
}

/** The six months the resourcing screens plan across, starting this month. */
export function planningMonths(today: Date, count = 6): string[] {
  const start = startOfMonth(today);
  return Array.from({ length: count }, (_, i) => monthKey(addMonths(start, i)));
}

/** ISO-8601 week number, for the sidebar's "Week 32" line. */
export function weekNumber(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 4 - (t.getDay() || 7));
  const yearStart = new Date(t.getFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Whole months from `a` to `b`, rounded to the nearest month and never below 1. */
export function monthSpan(a: Date, b: Date): number {
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(1, months + (b.getDate() >= a.getDate() ? 0 : -1));
}
