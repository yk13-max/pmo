import { useState } from 'react';
import type { Person } from '../types';
import type { PortfolioView } from '../lib/derive';
import { hoursToDays } from '../lib/derive';
import { Stat } from '../components/Stat';
import { Tabs } from '../components/Tabs';
import { PersonBars } from '../components/PersonBars';
import { WindowControls } from '../components/WindowControls';
import { Drawer } from '../components/Drawer';
import { monthKeyLabel } from '../lib/dates';
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
  // Every person's chart scrolls together, so cards side by side show the same months.
  const [monthScroll, setMonthScroll] = useState(0);

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
      <div className="stat-row one-line">
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
              <span style={{ width: 14, height: 12, background: 'var(--color-accent)', display: 'block' }} />
              Days off, at the base of each bar
            </span>
            <span>
              <span style={{ width: 14, height: 12, background: 'var(--color-accent-500)', display: 'block' }} />
              Other work
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
        <div className="control-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flex: '1 1 100%' }}>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: 'block', fontSize: 13, marginBottom: 5, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
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
          <WindowControls view={view} onSetWindow={onSetWindow} />
          <button type="button" className="btn btn-secondary" onClick={onAddPerson}>
            Add person
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingBottom: 6, cursor: 'pointer', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={showPct}
              onChange={(e) => setShowPct(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Show %
          </label>
        </div>
      </div>

      {view.peopleViews.length === 0 ? (
        <p className="empty">No one on the team yet. Add a person to start booking time.</p>
      ) : (
        <div className="person-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(408px,1fr))', gap: 'var(--space-8) 64px' }}>
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
                  <div style={{ fontSize: 13, color: 'var(--color-accent-700)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4 }}>
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
                <PersonBars
                  person={p}
                  monthLabels={view.monthLabels}
                  threshold={view.threshold}
                  showPct={showPct}
                  scrollLeft={monthScroll}
                  onScrollLeft={setMonthScroll}
                />
              </div>
            );
          })}
        </div>
      )}

      </>) },
          { id: 'demand', label: 'People the work needs', count: `${Math.max(0, ...view.demand).toFixed(1)} peak`, render: () => (
            <DemandChart view={view} onSetWindow={onSetWindow} />
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
                    <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{p.person.role}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-accent-2-700)' }}>
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
                                  className="hover-card driver-card"
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
          { id: 'leave', label: 'Annual leave', count: `${view.peopleViews.reduce((n, p) => n + p.leaveDays.reduce((a, b) => a + b, 0), 0)}d`, render: () => (
            <LeaveTable view={view} onSetLeave={onSetLeave} onSetPublicHoliday={onSetPublicHoliday} onSetWindow={onSetWindow} />
          ) },
        ]}
      />
    </div>
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
        <div className="control-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flex: 'none' }}>
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
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Everyone, shutdowns included</div>
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
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{p.person.role}</div>
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

const DEMAND_H = 280;
const DEMAND_BASE = 230;
const DEMAND_GUTTER = 70;
/* Below this a column is too narrow to read or to click, so the chart grows past its box
   and the strip scrolls instead of cramming a long window into one screen. */
const MIN_SLOT = 76;

function DemandChart({
  view,
  onSetWindow,
}: {
  view: PortfolioView;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const cap = view.capacity;
  const ceiling = Math.max(1, Math.max(cap, ...view.demand, ...view.capacityByMonth) * 1.15);
  const scale = (v: number) => (v / ceiling) * 200;
  const count = Math.max(1, view.months.length);
  const slot = Math.max(MIN_SLOT, 950 / count);
  const W = DEMAND_GUTTER + slot * count + 20;
  const paleW = slot * 0.71;
  const darkW = slot * 0.37;

  return (
    <div style={{ margin: 'var(--space-8) 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>How many people the work needs</h3>
          <p className="lede" style={{ margin: 0 }}>
            The pale column is the {view.people.length} people we have, with the time already gone at its base — days off
            in navy, meetings and admin in the lighter blue. The dark column is how many the promised work needs. Red is
            the shortfall. Click a month for the full breakdown; a long window scrolls sideways.
          </p>
        </div>
        <div className="control-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flex: 'none' }}>
          <WindowControls view={view} onSetWindow={onSetWindow} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 14 }}>
            Number of people →
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          <div style={{ position: 'relative', minWidth: W }}>
            <svg
              viewBox={`0 0 ${W} ${DEMAND_H}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              role="img"
              aria-label="How many people the promised work needs each month against the people available"
            >
              <line
                x1={DEMAND_GUTTER}
                y1={DEMAND_BASE - scale(cap)}
                x2={W - 20}
                y2={DEMAND_BASE - scale(cap)}
                stroke="var(--color-text)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <line x1={DEMAND_GUTTER} y1={DEMAND_BASE} x2={W - 20} y2={DEMAND_BASE} stroke="var(--color-neutral-400)" strokeWidth={1} />
              {view.months.map((m, i) => {
                const left = DEMAND_GUTTER + i * slot;
                const d = view.demand[i];
                // Available capacity dips with leave booked and with time spent off-project.
                const avail = view.capacityByMonth[i];
                const dh = scale(Math.min(d, avail));
                const oh = scale(Math.max(0, d - avail));
                /* Time already gone comes off the bottom of the month, as it does on the
                   person charts: days off first, then meetings and admin. */
                const hLeave = Math.max(0, scale(cap) - scale(avail) - scale(view.overhead));
                const hOver = Math.min(scale(view.overhead), Math.max(0, scale(cap) - scale(avail)));
                return (
                  <g key={m}>
                    <rect x={left + (slot - paleW) / 2} y={DEMAND_BASE - scale(cap)} width={paleW} height={scale(cap)} fill="var(--color-neutral-200)" />
                    <rect
                      x={left + (slot - paleW) / 2}
                      y={DEMAND_BASE - hLeave}
                      width={paleW}
                      height={hLeave}
                      fill="var(--color-accent)"
                    />
                    <rect
                      x={left + (slot - paleW) / 2}
                      y={DEMAND_BASE - hLeave - hOver}
                      width={paleW}
                      height={hOver}
                      fill="var(--color-accent-500)"
                    />
                    <rect x={left + (slot - darkW) / 2} y={DEMAND_BASE - dh} width={darkW} height={dh} fill="var(--color-text)" />
                    <rect x={left + (slot - darkW) / 2} y={DEMAND_BASE - dh - oh} width={darkW} height={oh} fill="var(--color-accent-2)" />
                    {/* The whole column is the target, so a thin bar is still easy to hit. */}
                    <rect
                      x={left}
                      y={0}
                      width={slot}
                      height={DEMAND_BASE}
                      fill={picked === i ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setPicked(picked === i ? null : i)}
                    >
                      <title>{`${view.monthLabels[i]} — click for the breakdown`}</title>
                    </rect>
                  </g>
                );
              })}
            </svg>
            <span
              style={{
                position: 'absolute',
                left: `${((DEMAND_GUTTER - 8) / W) * 100}%`,
                top: `${(DEMAND_BASE / DEMAND_H) * 100}%`,
                transform: 'translate(-100%,-50%)',
                fontSize: 13,
                color: 'var(--color-neutral-700)',
              }}
            >
              0
            </span>
            {view.months.map((m, i) => {
              const mid = DEMAND_GUTTER + i * slot + slot / 2;
              const d = view.demand[i];
              const top = DEMAND_BASE - scale(d) - 22;
              // Long windows leave no room for "people" beside every figure.
              const compact = slot < 110;
              return (
                <span key={`v-${m}`}>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${(mid / W) * 100}%`,
                      top: `${(top / DEMAND_H) * 100}%`,
                      transform: 'translateX(-50%)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      fontSize: compact ? 13 : 15,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    {d.toFixed(1)}
                    {compact ? '' : ' people'}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${(mid / W) * 100}%`,
                      top: `${(240 / DEMAND_H) * 100}%`,
                      transform: 'translateX(-50%)',
                      fontSize: 14,
                      color: picked === i ? 'var(--color-accent)' : 'var(--color-neutral-700)',
                      fontWeight: picked === i ? 600 : 400,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
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

      {/* Centred over the page rather than tucked under the chart, so the detail arrives
          where the eye already is and does not depend on how far down the chart sits. */}
      {picked !== null && (
        <Drawer
          title={monthKeyLabel(view.months[picked])}
          kicker="What this month is made of"
          onClose={() => setPicked(null)}
        >
          <MonthBreakdown view={view} index={picked} />
        </Drawer>
      )}
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
          <span style={{ width: 14, height: 12, background: 'var(--color-accent)', display: 'block' }} />
          Away on leave
        </span>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-accent-500)', display: 'block' }} />
          Other work
        </span>
        <span>
          <span style={{ width: 16, height: 0, borderTop: '1px dashed var(--color-text)', display: 'block' }} />
          Everyone, fully booked
        </span>
      </div>
    </div>
  );
}

/* Everything behind one column of the demand chart: where the month's capacity went, what
   the promised work asks for, and who carries it. */
function MonthBreakdown({ view, index }: { view: PortfolioView; index: number }) {
  const cap = view.capacity;
  const leave = view.peopleViews.reduce((n, p) => n + p.leaveLoads[index], 0) / 100;
  const avail = view.capacityByMonth[index];
  const need = view.demand[index];
  const gap = need - avail;
  const people = (v: number) => `${v.toFixed(2)} people`;
  const asDays = (pctOfMonth: number) => `${((pctOfMonth / 100) * WORKING_DAYS_PER_MONTH).toFixed(1)}d`;

  return (
    <div>
      <p
        className="lede"
        style={{ marginBottom: 'var(--space-6)', color: gap > 0 ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)' }}
      >
        {gap > 0
          ? `${people(gap)} short of what the promised work needs.`
          : `${people(-gap)} spare after everything promised.`}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6) 48px', marginBottom: 'var(--space-6)' }}>
        <Figure label="People we have" value={people(cap)} sub={`${view.people.length} on the team`} />
        <Figure label="Away on leave" value={`− ${people(leave)}`} sub="Own leave plus public holidays" />
        <Figure label="Other work" value={`− ${people(view.overhead)}`} sub="Meetings, admin, training" />
        <Figure label="Left to book" value={people(avail)} sub="What projects can actually draw on" />
        <Figure
          label="The work needs"
          value={people(need)}
          sub={`${((need / (avail || 1)) * 100).toFixed(0)}% of what is left`}
          color={gap > 0 ? 'var(--color-accent-2-700)' : undefined}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Person</th>
            {/* Trimmed so the names keep a line to themselves in the centred dialog. */}
            <th style={{ textAlign: 'right', width: 88 }}>Their month</th>
            <th style={{ textAlign: 'right', width: 82 }}>Days off</th>
            <th style={{ textAlign: 'right', width: 86 }}>Other work</th>
            <th style={{ textAlign: 'right', width: 96 }}>Project work</th>
            <th style={{ textAlign: 'right', width: 96 }}>Committed</th>
            <th style={{ width: 112 }}>Left to book</th>
          </tr>
        </thead>
        <tbody>
          {view.peopleViews.map((p) => {
            const free = p.person.capacity - p.committed[index];
            return (
              <tr key={p.person.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{p.person.name}</span>
                  <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}> · {p.person.role}</span>
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{asDays(p.person.capacity)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent)' }}>
                  {p.leaveDays[index] ? `${p.leaveDays[index]}d` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-600)' }}>
                  {/* What actually fits this month, so the row adds up to what is committed. */}
                  {p.overheadLoads[index] ? asDays(p.overheadLoads[index]) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {p.loads[index] ? asDays(p.loads[index]) : '—'}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: p.committed[index] > p.person.capacity ? 'var(--color-accent-2-700)' : 'var(--color-text)',
                  }}
                  /* Days throughout, so a part-timer's total reads against their own month
                     rather than against a full-time one. */
                  title={`${p.committed[index]}% of a full-time month`}
                >
                  {asDays(p.committed[index])}
                </td>
                <td style={{ fontSize: 13, color: free < 0 ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)' }}>
                  {free < 0 ? `${asDays(-free)} over` : `${asDays(free)} free`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Figure({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, color: color ?? 'var(--color-text)' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
