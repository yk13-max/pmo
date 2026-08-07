import { useState } from 'react';
import type { Person } from '../types';
import type { PortfolioView } from '../lib/derive';
import { Stat } from '../components/Stat';
import { Tabs } from '../components/Tabs';
import { monthOptions } from '../lib/dates';
import { MAX_YEAR, WORKING_DAYS_PER_MONTH } from '../types';

/* The mini graphs are drawn in a 0-100 user space and stretched to whatever room the
   person's card gives them, so they fill their area on any screen width. Each person's
   vertical scale runs to their own peak commitment — the top edge IS their peak — with a
   floor of 100 so the full-week line never falls off the top for someone under-committed. */
const VB_W = 100;
const VB_H = 100;
const BASELINE = 92;
const PLOT_TOP = 8;

const slotW = (count: number) => VB_W / Math.max(count, 1);
const barW = (count: number) => slotW(count) * 0.62;
const barX = (i: number, count: number) => i * slotW(count) + (slotW(count) - barW(count)) / 2;
const scaleFor = (peak: number) => Math.max(peak, 100);
const barHeight = (pct: number, peak: number) => (Math.min(pct, scaleFor(peak)) / scaleFor(peak)) * (BASELINE - PLOT_TOP);
const lineY = (pct: number, peak: number) => BASELINE - barHeight(pct, peak);

/** A share of a full-time month expressed in working days, to one decimal. */
const daysOver = (pct: number) => ((pct / 100) * WORKING_DAYS_PER_MONTH).toFixed(1);

export function Resourcing({
  view,
  onAddPerson,
  onOpenPerson,
  onSetThreshold,
  onSetWindow,
}: {
  view: PortfolioView;
  onAddPerson: () => void;
  onOpenPerson: (person: Person) => void;
  onSetThreshold: (pct: number) => void;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  const [hoverBar, setHoverBar] = useState<string | null>(null);
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
              <span style={{ width: 14, height: 12, background: 'var(--color-accent-300)', display: 'block' }} />
              Annual leave
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
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: 'block', fontSize: 12, marginBottom: 5, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
              Plan from
            </span>
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
            <span style={{ display: 'block', fontSize: 12, marginBottom: 5, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
              For
            </span>
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
                <div style={{ position: 'relative' }}>
                  <svg
                    viewBox={`0 0 ${VB_W} ${VB_H}`}
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: 104, display: 'block' }}
                    role="img"
                    aria-label={`How much of ${p.person.name}'s time is promised each month, peaking at ${p.peak}%`}
                  >
                    <line x1={0} y1={BASELINE} x2={VB_W} y2={BASELINE} stroke="var(--color-neutral-400)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
                    {p.loads.map((work, i) => {
                      const total = p.committed[i];
                      const full = p.person.capacity;
                      const hTotal = barHeight(total, p.peak);
                      const hWork = barHeight(work, p.peak);
                      return (
                        <g key={i}>
                          <rect
                            x={barX(i, p.loads.length)}
                            y={BASELINE - hWork}
                            width={barW(p.loads.length)}
                            height={hWork}
                            fill={
                              total > full
                                ? 'var(--color-accent-2)'
                                : total > (full * view.threshold) / 100
                                  ? 'var(--color-warning)'
                                  : 'var(--color-neutral-400)'
                            }
                          />
                          {hTotal > hWork && (
                            <rect
                              x={barX(i, p.loads.length)}
                              y={BASELINE - hTotal}
                              width={barW(p.loads.length)}
                              height={hTotal - hWork}
                              fill="var(--color-accent-300)"
                            />
                          )}
                        </g>
                      );
                    })}
                    {p.loads.map((_, i) => (
                      <rect
                        key={`hit-${i}`}
                        x={i * slotW(p.loads.length)}
                        y={0}
                        width={slotW(p.loads.length)}
                        height={BASELINE}
                        fill="transparent"
                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onMouseEnter={() => setHoverBar(`${p.person.id}-${i}`)}
                        onMouseLeave={() => setHoverBar(null)}
                      />
                    ))}
                    {/* Drawn last so the guides read over the bars rather than behind them. */}
                    <line
                      x1={0}
                      y1={lineY((p.person.capacity * view.threshold) / 100, p.peak)}
                      x2={VB_W}
                      y2={lineY((p.person.capacity * view.threshold) / 100, p.peak)}
                      stroke="var(--color-warning)"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                    <line
                      x1={0}
                      y1={lineY(p.person.capacity, p.peak)}
                      x2={VB_W}
                      y2={lineY(p.person.capacity, p.peak)}
                      stroke="var(--color-text)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  </svg>
                  {p.loads.map((work, i) => {
                    if (!showPct && hoverBar !== `${p.person.id}-${i}`) return null;
                    const isHover = hoverBar === `${p.person.id}-${i}`;
                    const h = barHeight(p.committed[i], p.peak);
                    return (
                      <span
                        key={`tip-${i}`}
                        style={{
                          position: 'absolute',
                          left: `${((i + 0.5) / p.loads.length) * 100}%`,
                          top: ((BASELINE - h) / VB_H) * 104 - 21,
                          transform: 'translateX(-50%)',
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 600,
                          fontSize: isHover ? 13 : 11,
                          background: isHover ? 'var(--color-bg)' : 'transparent',
                          boxShadow: isHover ? 'var(--shadow-sm)' : 'none',
                          padding: isHover ? '1px 5px' : 0,
                          borderRadius: 'var(--radius-md)',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          color: isHover ? 'var(--color-text)' : 'var(--color-neutral-700)',
                          zIndex: 2,
                        }}
                      >
                        {p.committed[i]}%{isHover && p.leaveDays[i] ? ` · ${work}% work + ${p.leaveDays[i]}d leave` : ''}
                      </span>
                    );
                  })}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${view.monthLabels.length}, 1fr)`, marginTop: 5 }}>
                    {view.monthLabels.map((m) => (
                      <span key={m} style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-neutral-700)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--color-neutral-600)', marginTop: 2 }}>
                    top of chart = {scaleFor(p.peak)}%
                    {p.person.capacity !== 100 && ` · full month for them = ${p.person.capacity}%`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>) },
          { id: 'demand', label: 'People the work needs', count: `${Math.max(0, ...view.demand).toFixed(1)} peak`, render: () => (
            <DemandChart view={view} />
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
                                        {d.loads[i]}% · {daysOver(d.loads[i])}d
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
        The pale column is the {view.people.length} people we have, with the tinted part away on leave. The dark column is
        how many the promised work needs. Red is the shortfall — work with nobody free to do it.
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
                    <rect
                      x={left + (slot - paleW) / 2}
                      y={DEMAND_BASE - scale(cap)}
                      width={paleW}
                      height={Math.max(0, scale(cap) - scale(avail))}
                      fill="var(--color-accent-300)"
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
          <span style={{ width: 14, height: 12, background: 'var(--color-accent-300)', display: 'block' }} />
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
