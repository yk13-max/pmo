import { useMemo, useState } from 'react';
import type { ProjectView } from '../lib/derive';
import type { PortfolioView } from '../lib/derive';
import { RAG_ORDER } from '../lib/derive';
import { SortHeaders, useSortedRows, type Dir, type SortColumn } from './SortHeaders';

type Column = SortColumn<ProjectView>;

/* Money columns sort on the base-currency figure so a mixed-currency portfolio ranks
   honestly; the cells still show what each client is billed. */
const COLUMNS: Column[] = [
  { id: 'name', label: 'Project', sortBy: (p) => p.name.toLowerCase() },
  { id: 'type', label: 'Type', width: 70, sortBy: (p) => p.typeShort },
  { id: 'facing', label: 'For', width: 100, sortBy: (p) => p.facingLabel },
  { id: 'owner', label: 'Owner', width: 110, sortBy: (p) => p.pmName.toLowerCase() },
  { id: 'priority', label: 'Priority', width: 90, sortBy: (p) => p.priority },
  { id: 'phase', label: 'Phase', width: 150, sortBy: (p) => p.phase },
  { id: 'pct', label: 'Done', width: 70, align: 'right', sortBy: (p) => p.pct, firstDir: 'desc' },
  { id: 'budget', label: 'Budget', width: 90, align: 'right', sortBy: (p) => p.budget, firstDir: 'desc' },
  { id: 'actual', label: 'Spent', width: 90, align: 'right', sortBy: (p) => p.actual, firstDir: 'desc' },
  { id: 'value', label: 'Agreed', width: 90, align: 'right', sortBy: (p) => p.valueBase, firstDir: 'desc' },
  { id: 'billed', label: 'Invoiced', width: 90, align: 'right', sortBy: (p) => p.billedBase, firstDir: 'desc' },
  { id: 'draw', label: 'Draw this month', width: 132, align: 'right', sortBy: (p) => p.loadHours, firstDir: 'desc' },
  { id: 'rag', label: 'Status', width: 100, sortBy: (p) => RAG_ORDER[p.rag] },
  { id: 'actions', label: '', width: 120 },
];

export interface Filters {
  search: string;
  type: string;
  facing: string;
  owner: string;
  rag: string;
}

const EMPTY: Filters = { search: '', type: 'All', facing: 'All', owner: 'All', rag: 'All' };

export function useProjectsTable(projects: ProjectView[]) {
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const kept = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (!needle ||
          p.name.toLowerCase().includes(needle) ||
          p.client.toLowerCase().includes(needle) ||
          p.pmName.toLowerCase().includes(needle) ||
          p.milestone.toLowerCase().includes(needle)) &&
        (filters.type === 'All' || p.typeShort === filters.type) &&
        (filters.facing === 'All' || p.facingLabel === filters.facing) &&
        (filters.owner === 'All' || p.pmName === filters.owner) &&
        (filters.rag === 'All' || p.ragLabel === filters.rag),
    );
  }, [projects, filters]);

  const { rows, sort, setSort } = useSortedRows(kept, COLUMNS, { id: 'name', dir: 'asc' }, (p) => p.name);

  return { rows, filters, setFilters, sort, setSort, filtered: rows.length !== projects.length };
}

export function ProjectFilters({
  view,
  filters,
  setFilters,
  shown,
  total,
}: {
  view: PortfolioView;
  filters: Filters;
  setFilters: (f: Filters) => void;
  shown: number;
  total: number;
}) {
  const owners = [...new Set(view.projects.map((p) => p.pmName))].sort();
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const clear = () => setFilters(EMPTY);
  const on = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div className="field" style={{ margin: 0 }}>
        <label className="eyebrow" htmlFor="pt-search" style={{ display: 'block', marginBottom: 5 }}>
          Search
        </label>
        <input
          id="pt-search"
          className="input"
          type="search"
          placeholder="Project, client, owner or milestone"
          style={{ width: 280 }}
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>
      <Picker label="Type" value={filters.type} onChange={(v) => set({ type: v })} options={view.projectTypes.map((t) => t.id)} />
      <Picker label="For" value={filters.facing} onChange={(v) => set({ facing: v })} options={['Customer', 'Internal']} />
      <Picker label="Owner" value={filters.owner} onChange={(v) => set({ owner: v })} options={owners} width={150} />
      <Picker label="Status" value={filters.rag} onChange={(v) => set({ rag: v })} options={['On track', 'Watch', 'At risk']} />
      <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', paddingBottom: 9 }}>
        {shown} of {total} shown
      </span>
      {on && (
        <button type="button" className="btn btn-ghost" style={{ marginBottom: 2 }} onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
  width = 120,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  width?: number;
}) {
  const id = `pt-filter-${label.toLowerCase()}`;
  return (
    <div className="field" style={{ margin: 0 }}>
      <label className="eyebrow" htmlFor={id} style={{ display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      <select id={id} className="input" style={{ width }} value={value} onChange={(e) => onChange(e.target.value)}>
        {['All', ...options].map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The project list's header row, over the shared sorting behaviour. */
export function ProjectHeaders({
  sort,
  setSort,
}: {
  sort: { id: string; dir: Dir };
  setSort: (s: { id: string; dir: Dir }) => void;
}) {
  return <SortHeaders columns={COLUMNS} sort={sort} setSort={setSort} />;
}
