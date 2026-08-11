import { useMemo, useState } from 'react';

export type Dir = 'asc' | 'desc';

export interface SortColumn<T> {
  id: string;
  label: string;
  width?: number;
  align?: 'right';
  /** What this column sorts on. Omitted for columns that do not sort, like an actions cell. */
  sortBy?: (row: T) => string | number;
  /** Which way round the first click sorts — biggest first reads better for money. */
  firstDir?: Dir;
}

/* One sortable table, used by the project list on Data and the customer table on
   Financials. They show different columns of different things, so what is shared is the
   behaviour — click to sort, click again to reverse, ties broken the same way every time —
   rather than the columns themselves. */
export function useSortedRows<T>(
  rows: T[],
  columns: SortColumn<T>[],
  initial: { id: string; dir: Dir },
  /** Read when two rows sort equal, so the order never jitters between renders. */
  tiebreak: (row: T) => string,
) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const by = columns.find((c) => c.id === sort.id)?.sortBy;
    if (!by) return rows;
    const flip = sort.dir === 'asc' ? 1 : -1;
    // Sorted on a copy: the caller's array is theirs.
    return [...rows].sort((a, b) => {
      const x = by(a);
      const y = by(b);
      if (x === y) return tiebreak(a).localeCompare(tiebreak(b));
      return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y)) * flip;
    });
    // `columns` and `tiebreak` are module constants at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  return { rows: sorted, sort, setSort };
}

/** The header row. Clicking a title sorts by it; clicking again reverses. */
export function SortHeaders<T>({
  columns,
  sort,
  setSort,
}: {
  columns: SortColumn<T>[];
  sort: { id: string; dir: Dir };
  setSort: (s: { id: string; dir: Dir }) => void;
}) {
  return (
    <tr>
      {columns.map((c) => {
        const active = sort.id === c.id;
        if (!c.sortBy) return <th key={c.id} style={{ width: c.width }} />;
        return (
          <th
            key={c.id}
            style={{ width: c.width, textAlign: c.align, padding: 0 }}
            aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button
              type="button"
              className="sort-header"
              style={{ justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}
              onClick={() =>
                setSort({ id: c.id, dir: active ? (sort.dir === 'asc' ? 'desc' : 'asc') : (c.firstDir ?? 'asc') })
              }
            >
              {c.label}
              <span aria-hidden style={{ opacity: active ? 1 : 0.25 }}>
                {active && sort.dir === 'desc' ? '▾' : '▴'}
              </span>
            </button>
          </th>
        );
      })}
    </tr>
  );
}
