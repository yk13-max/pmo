import type { Person } from '../types';
import { WORKING_HOURS_PER_DAY } from '../types';
import { hoursToDays } from '../lib/derive';

/** Hours to a readable number of days — the unit every figure is reported in. */
const asDays = (hours: number) => hoursToDays(hours).toFixed(1);

export function AllocationGrid({
  people,
  months,
  monthLabels,
  value,
  threshold,
  otherLoads,
  /** Ids of people whose project types do not cover this project. */
  ineligible,
  typeLabel,
  onChange,
}: {
  people: Person[];
  months: string[];
  monthLabels: string[];
  /** `${personId}|${month}` → hours booked on this project. */
  value: Record<string, number>;
  threshold: number;
  /** Each person's hours from every *other* project, so warnings track unsaved edits. */
  otherLoads: Record<string, number[]>;
  ineligible: Set<string>;
  typeLabel: string;
  onChange: (personId: string, month: string, hours: number) => void;
}) {
  if (!people.length) {
    return <p className="lede">Add people on the Resourcing screen before booking time to this project.</p>;
  }
  /** A full month for this person, in hours — what their bookings are judged against. */
  const monthHours = (person: Person) => person.workingDays * WORKING_HOURS_PER_DAY;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="alloc-table">
        <thead>
          <tr>
            <th style={{ minWidth: 140 }}>Person</th>
            {monthLabels.map((m, i) => (
              <th key={months[i]} className="month-col">
                {m}
              </th>
            ))}
            <th className="month-col" style={{ width: 90 }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const rowTotal = months.reduce((n, m) => n + (value[`${person.id}|${m}`] ?? 0), 0);
            const barred = ineligible.has(person.id);
            const full = monthHours(person);
            return (
              <tr key={person.id} style={barred ? { opacity: 0.55 } : undefined}>
                <td>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{person.role}</div>
                  {barred && (
                    <div style={{ fontSize: 11, color: 'var(--color-accent-2-700)' }}>
                      Does not work on {typeLabel}
                    </div>
                  )}
                </td>
                {months.map((month, i) => {
                  const hours = value[`${person.id}|${month}`] ?? 0;
                  const total = (otherLoads[person.id]?.[i] ?? 0) + hours;
                  const over = total > full;
                  return (
                    <td key={month} className="month-col">
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={full}
                        step={0.5}
                        disabled={barred}
                        aria-label={`${person.name}, ${monthLabels[i]}, hours`}
                        title={
                          barred
                            ? `${person.name} is not assigned to ${typeLabel} projects`
                            : over
                              ? `${person.name} is booked ${asDays(total)} days across all projects in ${monthLabels[i]}, past their ${asDays(full)}`
                              : hours
                                ? `${asDays(hours)} days`
                                : undefined
                        }
                        style={over ? { borderColor: 'var(--color-accent-2-600)' } : undefined}
                        value={hours === 0 ? '' : hours}
                        placeholder="0"
                        onChange={(e) => onChange(person.id, month, clamp(e.target.value, full))}
                      />
                    </td>
                  );
                })}
                <td className="month-col" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {asDays(rowTotal)}d
                </td>
              </tr>
            );
          })}
          <tr>
            <td style={{ fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
              This project, total days drawn each month
            </td>
            {months.map((month) => {
              const total = people.reduce((n, p) => n + (value[`${p.id}|${month}`] ?? 0), 0);
              return (
                <td
                  key={month}
                  className="month-col"
                  style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--color-neutral-700)' }}
                >
                  {asDays(total)}d
                </td>
              );
            })}
            <td className="month-col" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600 }}>
              {asDays(months.reduce((n, m) => n + people.reduce((s, p) => s + (value[`${p.id}|${m}`] ?? 0), 0), 0))}d
            </td>
          </tr>
        </tbody>
      </table>
      <p className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
        Time is booked in hours, at {WORKING_HOURS_PER_DAY} hours to the day, and reported back in days. A box turns red
        when that person is booked past a full month across the whole portfolio; over-allocation is flagged from{' '}
        {threshold}%. People whose project types do not include {typeLabel} cannot be booked here — change their types on
        the Data screen first.
      </p>
    </div>
  );
}

function clamp(raw: string, max: number): number {
  // Half an hour is the finest booking anyone needs, and it keeps the stored figures tidy.
  const n = Math.round(Number(raw) * 2) / 2;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}
