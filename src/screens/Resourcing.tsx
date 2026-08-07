import { useState } from 'react';
import type { Person } from '../types';
import type { PortfolioView } from '../lib/derive';
import { hoursToDays } from '../lib/derive';
import { Stat } from '../components/Stat';
import { Tabs } from '../components/Tabs';
import { PersonBars } from '../components/PersonBars';
import { monthOptions } from '../lib/dates';
import { MAX_YEAR, WORKING_DAYS_PER_MONTH } from '../types';


/** A share of a full-time month expressed in working days, to one decimal. */
const daysOver = (pct: number) => ((pct / 100) * WORKING_DAYS_PER_MONTH).toFixed(1);

export function Resourcing({
  view,
  onAddPerson,
  onOpenPerson,
  onSetThreshold,
  onSetWindow,
  onSetLeave,
  onSetPublicHoliday,
}: {
  view: PortfolioView;
  onAddPerson: () => void;
  onOpenPerson: (person: Person) => void;
  onSetThreshold: (pct: number) => void;
  onSetWindow: (startMonth: string, months: number) => void;
  onSetLeave: (personId: string, month: string, days: number) => void;
  onSetPublicHoliday: (month: string, days: number) => void;
}) {
  const [showPct, setShowPct] = useState(false);
  const [hoverDriver, setHoverDriver] = useState<string | null>(null);

  const peak = Math.max(0, ...view.demand);
  const peakIndex = view.demand.indexOf(peak);
  const busiest = view.peopleViews.reduce<PortfolioView['peopleViews'][number] | null>(
    (best, p) => (!best || p.peak > best.peak ? p : best),
    null,
  );
  const overMonths = view.peopleViews
    .flatMap((p) =>
      p.committed.map((v, i) =>
        v > p.person.capacity
          ? {
              person: p.person,
              month: view.monthLabels[i],
              over: v - p.person.capacity,
              leaveDays: p.leaveDays[i],
              projects: p.projectNames,
            }
          : null,
      ),
    )
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const managerCount = view.people.filter((p) => p.role === 'Project manager').length;

  return (
    <div>
      <div className="stat-row">
        <Stat
          value={view.people.length}
          label="People"
          sub={`${managerCount} project managers, ${view.people.length - managerCount} specialists`}
        />
        <Stat
          value={peak.toFixed(1)}
          label="People needed at the peak"
          sub={
            peakIndex >= 0
              ? `${view.monthLabels[peakIndex]} — ${(peak - view.capacity).toFixed(1)} more than we have`
              : 'Nothing booked yet'
          }
          color={peak > view.capacity ? 'var(--color-accent-2-700)' : 'var(--color-text)'}
        />
        <Stat
          value={busiest ? `${busiest.peak}%` : '—'}
          label="Busiest person"
          sub={
            busiest
              ? `${busiest.person.name}, ${busiest.person.role.toLowerCase()}, in ${view.monthLabels[busiest.peakMonthIndex] ?? '—'}`
              : 'Nobody booked yet'
          }
          color={busiest && busiest.peak > 100 ? 'var(--color-accent-2-700)' : 'var(--color-text)'}
        />
        <Stat
          value={overMonths.length}
          label="Months booked past full"
          sub="Counting each person separately"
          color="var(--color-accent-700)"
        />
        <Stat
          value={view.roleShortages.length}
          label="Roles short 3 months running"
          sub={
            view.roleShortages.length
              ? view.roleShortages
                  .map((s) => `${s.role} (${s.months[0]}–${s.months[s.months.length - 1]})`)
                  .join(' · ')
              : 'No title is oversubscribed for three months straight'
          }
          color={view.roleShortages.length ? 'var(--color-accent-2-700)' : 'var(--color-text)'}
        />
      </div>

      <Tabs
        storageKey="resourcing"
        tabs={[
          { id: 'people', label: 'Person by person', count: view.people.length, render: () => (<>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Person by person</h3>
          <p className="lede" style={{ margin: 0 }}>
            One bar per month, showing how much of that person&rsquo;s time is already spoken for. Click a name to see how
            that splits across their projects.
          </p>
          <div className="legend" style={{ marginTop: 'var(--space-3)' }}>
            <span>
              <span style={{ width: 14, height: 12, background: 'var(--color-neutral-400)', display: 'block' }} />
              Project work
            </span>
            <span>
              <span style={{ width: 14, height: 12, background: 'var(--color-accent-700)', display: 'block' }} />
              Days off, at the base of each bar
            </span>
            <span>
              <span style={{ width: 16, height: 0, borderTop: '1px dashed var(--color-text)', display: 'block' }} />
              Their full month
            </span>
            <span>
              <span style={{ width: 16, height: 0, borderTop: '1px dotted var(--color-warning)', display: 'block' }} />
              Over-allocation threshold ({view.threshold}%)
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flex: 'none' }}>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: 'block', fontSize: 12, marginBottom: 5, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
              Flag over-allocation above {view.threshold}%
            </span>
            <input
              type="range"
              min={70}
              max={110}
              step={1}
              value={view.threshold}
              style={{ width: 180, accentColor: 'var(--color-accent)' }}
              onChange={(e) => onSetThreshold(Number(e.target.value))}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingBottom: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPct}
              onChange={(e) => setShowPct(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Show %
          </label>
          <WindowControls view={view} onSetWindow={onSetWindow} />
          <button type="button" className="btn btn-secondary" onClick={onAddPerson}>
            Add person
          </button>
        </div>
      </div>

      {view.peopleViews.length === 0 ? (
        <p className="empty">No one on the team yet. Add a person to start booking time.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(408px,1fr))', gap: 'var(--space-8) 64px' }}>
          {view.peopleViews.map((p) => {
            return (
              <div key={p.person.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0 }}>
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => onOpenPerson(p.person)}
                    title={`See ${p.person.name}'s spread across projects`}
                    style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.15 }}
                  >
                    <span className="project-name">{p.person.name}</span>
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--color-accent-700)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4 }}>
                    {p.person.role}
                    {p.person.types.length
                      ? ` · ${p.person.types.map((id) => view.projectTypes.find((t) => t.id === id)?.label ?? id).join(', ')}`
                      : ''}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 8 }}>
                    {p.projectNames.length ? p.projectNames.join(', ') : 'Not booked on anything yet'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      fontSize: 26,
                      marginTop: 10,
                      color:
                        p.peak > p.person.capacity
                          ? 'var(--color-accent-2-700)'
                          : p.peak > (p.person.capacity * view.threshold) / 100
                            ? 'var(--color-accent-700)'
                            : 'var(--color-text)',
                    }}
                  >
                    {p.peak}%
                  </div>
                  <div className="eyebrow">
                    peak commitment · {view.monthLabels[p.peakMonthIndex] ?? '—'}
                    {p.leaveDays.some((d) => d > 0) ? ` · ${p.leaveDays.reduce((n, d) => n + d, 0)}d leave` : ''}
                  </div>
                </div>
                <PersonBars person={p} monthLabels={view.monthLabels} threshold={view.threshold} showPct={showPct} />
              </div>
            );
          })}
        </div>
      )}

      </>) },
          { id: 'demand', label: 'People the work needs', count: `${Math.max(0, ...view.demand).toFixed(1)} peak`, render: () => (
            <DemandChart view={view} />
          ) },
          { id: 'leave', label: 'Annual leave', count: `${view.peopleViews.reduce((n, p) => n + p.leaveDays.reduce((a, b) => a + b, 0), 0)}d`, render: () => (
            <LeaveTable view={view} onSetLeave={onSetLeave} onSetPublicHoliday={onSetPublicHoliday} onSetWindow={onSetWindow} />
          ) },
          { id: 'roles', label: 'Job titles with no cover', count: view.roleShortages.length, render: () => (<>

      <h3 style={{ margin: '0 0 4px' }}>Job titles with no cover</h3>
      <p className="lede">
        A title is short when everyone holding it is booked past their available time, so the overspill cannot be handed
        to a colleague who does the same job. Three months running makes it a hiring problem, not a scheduling one.
      </p>
      {view.roleShortages.length === 0 ? (
        <p className="empty" style={{ marginTop: 'var(--space-4)', maxWidth: 1040 }}>
          No job title is oversubscribed for three consecutive months.
        </p>
      ) : (
        <table className="table" style={{ marginTop: 'var(--space-4)', maxWidth: 1040 }}>
          <thead>
            <tr>
              <th style={{ width: 220 }}>Job title</th>
              <th style={{ width: 90 }}>People</th>
              <th style={{ width: 200 }}>Months</th>
              <th style={{ textAlign: 'right', width: 150 }}>Worst gap</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            {view.roleShortages.map((s) => (
              <tr key={`${s.role}-${s.months[0]}`}>
                <td>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{s.role}</span>
                </td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{s.headcount}</td>
                <td>{s.months.join(', ')}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-2-700)' }}>
                  {s.worstGap.toFixed(2)} people
                </td>
                <td style={{ color: 'var(--color-neutral-700)' }}>
                  {s.headcount === 1
                    ? 'The only person with this title — nobody can take the overspill.'
                    : `All ${s.headcount} are over their available time in the same months.`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      </>) },
          { id: 'overspill', label: 'Where the overspill comes from', count: overMonths.length, render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Where the overspill comes from</h3>
      <p className="lede">
        The oversold months, rolled up under each person. Hover a month&rsquo;s drivers for the project-by-project split.
      </p>
      {overMonths.length === 0 ? (
        <p className="empty" style={{ marginTop: 'var(--space-4)', maxWidth: 1040 }}>
          Nobody is booked past their available time in the next {view.months.length} months.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: 'var(--space-4)', maxWidth: 1040 }}>
          {view.peopleViews
            .filter((p) => p.committed.some((v, i) => v > p.person.capacity && view.months[i]))
            .map((p) => {
              const spread = view.spreadFor(p.person.id);
              const rows = p.committed
                .map((v, i) => ({ i, over: v - p.person.capacity }))
                .filter((r) => r.over > 0);
              const worst = Math.max(...rows.map((r) => r.over));
              return (
                <div key={p.person.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', marginBottom: 6 }}>
                    <button
                      type="button"
                      className="card-link"
                      onClick={() => onOpenPerson(p.person)}
                      style={{ width: 'auto', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18 }}
                    >
                      <span className="project-name">{p.person.name}</span>
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{p.person.role}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-accent-2-700)' }}>
                      {rows.length} month{rows.length === 1 ? '' : 's'} over · worst +{daysOver(worst)} days
                    </span>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>Month</th>
                        <th style={{ textAlign: 'right', width: 90 }}>Over by</th>
                        <th style={{ textAlign: 'right', width: 110 }}>Days over</th>
                        <th style={{ textAlign: 'right', width: 90 }}>FTE</th>
                        <th>Driven by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ i, over }) => {
                        const key = `${p.person.id}-${i}`;
                        const drivers = spread.filter((row) => row.loads[i] > 0);
                        return (
                          <tr key={i}>
                            <td>{view.monthLabels[i]}</td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-2-700)' }}>
                              +{over}%
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-2-700)' }}>
                              {daysOver(over)} days
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>
                              {(over / 100).toFixed(2)}
                            </td>
                            <td
                              style={{ position: 'relative', color: 'var(--color-neutral-700)', cursor: 'help' }}
                              onMouseEnter={() => setHoverDriver(key)}
                              onMouseLeave={() => setHoverDriver(null)}
                            >
                              {drivers.map((d) => d.project.name).join(', ') || '—'}
                              {p.leaveDays[i] > 0 && (
                                <span style={{ color: 'var(--color-accent-700)' }}> · {p.leaveDays[i]}d leave</span>
                              )}
                              {hoverDriver === key && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '100%',
                                    marginTop: 4,
                                    minWidth: 280,
                                    padding: 'var(--space-3)',
                                    background: 'var(--color-bg)',
                                    boxShadow: 'var(--shadow-lg)',
                                    borderRadius: 'var(--radius-md)',
                                    zIndex: 6,
                                    pointerEvents: 'none',
                                  }}
                                >
                                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                                    {p.person.name} · {view.monthLabels[i]}
                                  </div>
                                  {drivers.map((d) => (
                                    <div
                                      key={d.project.id}
                                      style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 13, padding: '2px 0' }}
                                    >
                                      <span>
                                        {d.project.name}
                                        <span style={{ color: 'var(--color-neutral-600)' }}> · {d.project.client}</span>
                                      </span>
                                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {hoursToDays(d.hours[i]).toFixed(1)}d · {d.hours[i]}h
                                      </span>
                                    </div>
                                  ))}
                                  {p.leaveDays[i] > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0', color: 'var(--color-accent-700)' }}>
                                      <span>Annual leave</span>
                                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {p.leaveLoads[i]}% · {p.leaveDays[i]}d
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      paddingTop: 6,
                                      marginTop: 4,
                                      borderTop: '1px solid var(--color-divider)',
                                    }}
                                  >
                                    <span>Committed vs their {p.person.capacity}%</span>
                                    <span style={{ color: 'var(--color-accent-2-700)', fontVariantNumeric: 'tabular-nums' }}>
                                      {p.committed[i]}% · +{daysOver(over)}d
                                    </span>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      )}
      </>) },
        ]}
      />
    </div>
  );
}

/** The planning window, shared by every tab that lets you type into a month. */
function WindowControls({
  view,
  onSetWindow,
}: {
  view: PortfolioView;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  const labelStyle = {
    display: 'block',
    fontSize: 12,
    marginBottom: 5,
    color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
  } as const;
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
          style={{ width: 'auto', minWidth: 96 }}
          value={view.months.length}
          onChange={(e) => onSetWindow(view.months[0], Number(e.target.value))}
        >
          {[3, 6, 12, 18, 24].map((n) => (
            <option key={n} value={n}>
              {n} months
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/** Days off, month by month. The top row is the public holidays everybody takes, entered
    once here rather than seven times below. */
function LeaveTable({
  view,
  onSetLeave,
  onSetPublicHoliday,
  onSetWindow,
}: {
  view: PortfolioView;
  onSetLeave: (personId: string, month: string, days: number) => void;
  onSetPublicHoliday: (month: string, days: number) => void;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  const clamp = (v: string) => Math.max(0, Math.min(WORKING_DAYS_PER_MONTH, Math.round(Number(v) || 0)));
  const holidayTotal = view.publicHolidays.reduce((a, b) => a + b, 0);
  // Wide enough that the columns keep their width and the wrapper scrolls instead of squashing.
  const minWidth = 180 + view.months.length * 76 + 90;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Annual leave</h3>
          <p className="lede" style={{ margin: 0 }}>
            Days off per month. Public holidays are entered once and apply to everyone; the rows below are what each
            person books themselves. Both feed straight into the graphs and available capacity.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flex: 'none' }}>
          <WindowControls view={view} onSetWindow={onSetWindow} />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="alloc-table" style={{ minWidth }}>
          <thead>
            <tr>
              <th style={{ width: 180 }}>Person</th>
              {view.monthLabels.map((m, i) => (
                <th key={view.months[i]} className="month-col">
                  {m}
                </th>
              ))}
              <th className="month-col" style={{ width: 90 }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: 'var(--color-accent-100)' }}>
              <td>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Public holidays</div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>Everyone, shutdowns included</div>
              </td>
              {view.months.map((month, i) => (
                <td key={month} className="month-col">
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    max={WORKING_DAYS_PER_MONTH}
                    aria-label={`Public holidays in ${view.monthLabels[i]}`}
                    value={view.publicHolidays[i] || ''}
                    placeholder="0"
                    onChange={(e) => onSetPublicHoliday(month, clamp(e.target.value))}
                  />
                </td>
              ))}
              <td className="month-col" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {holidayTotal}d
              </td>
            </tr>
            {view.peopleViews.map((p) => (
              <tr key={p.person.id}>
                <td>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{p.person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{p.person.role}</div>
                </td>
                {view.months.map((month, i) => (
                  <td key={month} className="month-col">
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      max={WORKING_DAYS_PER_MONTH}
                      aria-label={`${p.person.name} leave in ${view.monthLabels[i]}`}
                      title={
                        view.publicHolidays[i]
                          ? `Plus ${view.publicHolidays[i]}d of public holiday — ${p.leaveDays[i]}d off in total`
                          : undefined
                      }
                      value={p.ownLeaveDays[i] || ''}
                      placeholder="0"
                      onChange={(e) => onSetLeave(p.person.id, month, clamp(e.target.value))}
                    />
                  </td>
                ))}
                <td className="month-col" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.leaveDays.reduce((a, b) => a + b, 0)}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
        {WORKING_DAYS_PER_MONTH} working days is a full month. Totals include each person&rsquo;s share of the public
        holidays. Change the window above to book leave further out — planning runs to {MAX_YEAR}.
      </p>
    </>
  );
}

const DEMAND_W = 1040;
const DEMAND_H = 280;
const DEMAND_BASE = 230;

function DemandChart({ view }: { view: PortfolioView }) {
  const cap = view.capacity;
  const ceiling = Math.max(1, Math.max(cap, ...view.demand, ...view.capacityByMonth) * 1.15);
  const scale = (v: number) => (v / ceiling) * 200;
  const slot = 950 / Math.max(1, view.months.length);
  const paleW = slot * 0.71;
  const darkW = slot * 0.37;

  return (
    <div style={{ margin: 'var(--space-8) 0' }}>
      <h3 style={{ marginBottom: 4 }}>How many people the work needs</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        The pale column is the {view.people.length} people we have, with the navy band at its base the time away on leave.
        The dark column is how many the promised work needs. Red is the shortfall — work with nobody free to do it.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 14 }}>
            Number of people →
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg
              viewBox={`0 0 ${DEMAND_W} ${DEMAND_H}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              role="img"
              aria-label="How many people the promised work needs each month against the people available"
            >
              <line
                x1={70}
                y1={DEMAND_BASE - scale(cap)}
                x2={1020}
                y2={DEMAND_BASE - scale(cap)}
                stroke="var(--color-text)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <line x1={70} y1={DEMAND_BASE} x2={1020} y2={DEMAND_BASE} stroke="var(--color-neutral-400)" strokeWidth={1} />
              {view.months.map((m, i) => {
                const left = 70 + i * slot;
                const d = view.demand[i];
                // Available capacity dips in months with leave booked.
                const avail = view.capacityByMonth[i];
                const dh = scale(Math.min(d, avail));
                const oh = scale(Math.max(0, d - avail));
                return (
                  <g key={m}>
                    <rect x={left + (slot - paleW) / 2} y={DEMAND_BASE - scale(cap)} width={paleW} height={scale(cap)} fill="var(--color-neutral-200)" />
                    {/* Leave comes off the bottom of the month, as it does on the person charts. */}
                    <rect
                      x={left + (slot - paleW) / 2}
                      y={DEMAND_BASE - Math.max(0, scale(cap) - scale(avail))}
                      width={paleW}
                      height={Math.max(0, scale(cap) - scale(avail))}
                      fill="var(--color-accent-700)"
                    />
                    <rect x={left + (slot - darkW) / 2} y={DEMAND_BASE - dh} width={darkW} height={dh} fill="var(--color-text)" />
                    <rect x={left + (slot - darkW) / 2} y={DEMAND_BASE - dh - oh} width={darkW} height={oh} fill="var(--color-accent-2)" />
                  </g>
                );
              })}
            </svg>
            <span
              style={{
                position: 'absolute',
                left: `${(62 / DEMAND_W) * 100}%`,
                top: `${(DEMAND_BASE / DEMAND_H) * 100}%`,
                transform: 'translate(-100%,-50%)',
                fontSize: 13,
                color: 'var(--color-neutral-700)',
              }}
            >
              0
            </span>
            {view.months.map((m, i) => {
              const mid = 70 + i * slot + slot / 2;
              const d = view.demand[i];
              const top = DEMAND_BASE - scale(d) - 22;
              return (
                <span key={`v-${m}`}>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${(mid / DEMAND_W) * 100}%`,
                      top: `${(top / DEMAND_H) * 100}%`,
                      transform: 'translateX(-50%)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      fontSize: 15,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.toFixed(1)} people
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${(mid / DEMAND_W) * 100}%`,
                      top: `${(240 / DEMAND_H) * 100}%`,
                      transform: 'translateX(-50%)',
                      fontSize: 14,
                      color: 'var(--color-neutral-700)',
                    }}
                  >
                    {view.monthLabels[i]}
                  </span>
                </span>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, marginTop: 'var(--space-2)' }}>Month</div>
        </div>
      </div>
      <div className="legend" style={{ marginTop: 'var(--space-2)' }}>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-neutral-200)', display: 'block' }} />
          People we have
        </span>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-text)', display: 'block' }} />
          People the work needs
        </span>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-accent-2)', display: 'block' }} />
          Shortfall
        </span>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-accent-700)', display: 'block' }} />
          Away on leave
        </span>
        <span>
          <span style={{ width: 16, height: 0, borderTop: '1px dashed var(--color-text)', display: 'block' }} />
          Everyone, fully booked
        </span>
      </div>
    </div>
  );
}
