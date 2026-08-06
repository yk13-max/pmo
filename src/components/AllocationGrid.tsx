import type { Person } from '../types';

export function AllocationGrid({
  people,
  months,
  monthLabels,
  value,
  threshold,
  otherLoads,
  onChange,
}: {
  people: Person[];
  months: string[];
  monthLabels: string[];
  /** `${personId}|${month}` → % of that person's week on this project. */
  value: Record<string, number>;
  threshold: number;
  /** Each person's load from every *other* project, so warnings track unsaved edits. */
  otherLoads: Record<string, number[]>;
  onChange: (personId: string, month: string, pct: number) => void;
}) {
  if (!people.length) {
    return <p className="lede">Add people on the Resourcing screen before booking time to this project.</p>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="alloc-table">
        <thead>
          <tr>
            <th style={{ minWidth: 140 }}>Person</th>
            {monthLabels.map((m) => (
              <th key={m} style={{ textAlign: 'right' }}>
                {m}
              </th>
            ))}
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const rowTotal = months.reduce((n, m) => n + (value[`${person.id}|${m}`] ?? 0), 0);
            return (
              <tr key={person.id}>
                <td>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{person.role}</div>
                </td>
                {months.map((month, i) => {
                  const pct = value[`${person.id}|${month}`] ?? 0;
                  const total = (otherLoads[person.id]?.[i] ?? 0) + pct;
                  const over = total > 100;
                  return (
                    <td key={month}>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        aria-label={`${person.name}, ${monthLabels[i]}`}
                        title={over ? `${person.name} is booked to ${total}% across all projects in ${monthLabels[i]}` : undefined}
                        style={over ? { borderColor: 'var(--color-accent-2-600)' } : undefined}
                        value={pct === 0 ? '' : pct}
                        placeholder="0"
                        onChange={(e) => onChange(person.id, month, clamp(e.target.value))}
                      />
                    </td>
                  );
                })}
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rowTotal}%</td>
              </tr>
            );
          })}
          <tr>
            <td style={{ fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
              Everyone, all projects
            </td>
            {months.map((month, i) => {
              const total = people.reduce(
                (n, p) => n + (otherLoads[p.id]?.[i] ?? 0) + (value[`${p.id}|${month}`] ?? 0),
                0,
              );
              return (
                <td key={month} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--color-neutral-700)' }}>
                  {total}%
                </td>
              );
            })}
            <td />
          </tr>
        </tbody>
      </table>
      <p className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
        Percentages are of each person&rsquo;s working week. A box turns magenta when that person is booked past 100% across
        the whole portfolio; over-allocation is flagged from {threshold}%.
      </p>
    </div>
  );
}

function clamp(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}
