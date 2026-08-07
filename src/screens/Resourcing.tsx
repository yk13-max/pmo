import { useState } from 'react';
import type { Person } from '../types';
import type { PortfolioView } from '../lib/derive';
import { Stat } from '../components/Stat';

const BAR_W = 200;
const BAR_H = 60;
const BAR_TOP = 46;
const BASELINE = 58;
/** Bars are drawn against a 150% ceiling, so a full week sits two thirds up. */
const CEILING = 150;

const slotW = (count: number) => (BAR_W - 8) / Math.max(count, 1);
const barW = (count: number) => Math.min(24, slotW(count) - 6);
const barX = (i: number, count: number) => 4 + i * slotW(count) + (slotW(count) - barW(count)) / 2;

export function Resourcing({
  view,
  onAddPerson,
  onEditPerson,
  onSetThreshold,
}: {
  view: PortfolioView;
  onAddPerson: () => void;
  onEditPerson: (person: Person) => void;
  onSetThreshold: (pct: number) => void;
}) {
  const [hoverBar, setHoverBar] = useState<string | null>(null);

  const peak = Math.max(0, ...view.demand);
  const peakIndex = view.demand.indexOf(peak);
  const busiest = view.peopleViews.reduce<PortfolioView['peopleViews'][number] | null>(
    (best, p) => (!best || p.peak > best.peak ? p : best),
    null,
  );
  const overMonths = view.peopleViews.flatMap((p) =>
    p.loads.map((v, i) => (v > 100 ? { person: p.person, month: view.monthLabels[i], over: v - 100, projects: p.projectNames } : null)),
  ).filter((r): r is NonNullable<typeof r> => r !== null);

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
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Person by person</h3>
          <p className="lede" style={{ margin: 0 }}>
            One bar per month, showing how much of that person&rsquo;s time is already promised. The dotted line is a full
            week — bars above it are impossible, not merely busy.
          </p>
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
            const capY = BASELINE - (100 / CEILING) * BAR_TOP;
            return (
              <div key={p.person.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-6)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => onEditPerson(p.person)}
                    style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.15 }}
                  >
                    <span className="project-name">{p.person.name}</span>
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--color-accent-700)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4 }}>
                    {p.person.role}
                    {p.person.discipline ? ` · ${p.person.discipline}` : ''}
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
                        p.peak > 100
                          ? 'var(--color-accent-2-700)'
                          : p.peak > view.threshold
                            ? 'var(--color-accent-700)'
                            : 'var(--color-text)',
                    }}
                  >
                    {p.peak}%
                  </div>
                  <div className="eyebrow">peak load · {view.monthLabels[p.peakMonthIndex] ?? '—'}</div>
                </div>
                <div style={{ flex: 'none', width: BAR_W, position: 'relative' }}>
                  <svg
                    viewBox={`0 0 ${BAR_W} ${BAR_H}`}
                    style={{ width: BAR_W, height: BAR_H, display: 'block' }}
                    role="img"
                    aria-label={`How much of ${p.person.name}'s time is promised each month`}
                  >
                    <line x1={0} y1={capY} x2={BAR_W} y2={capY} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={0} y1={BASELINE} x2={BAR_W} y2={BASELINE} stroke="var(--color-neutral-400)" strokeWidth={1} />
                    {p.loads.map((v, i) => {
                      const h = (Math.min(v, CEILING) / CEILING) * BAR_TOP;
                      return (
                        <rect
                          key={i}
                          x={barX(i, p.loads.length)}
                          y={BASELINE - h}
                          width={barW(p.loads.length)}
                          height={h}
                          fill={
                            v > 100
                              ? 'var(--color-accent-2)'
                              : v > view.threshold
                                ? 'var(--color-warning)'
                                : 'var(--color-neutral-400)'
                          }
                        />
                      );
                    })}
                    {p.loads.map((_, i) => (
                      <rect
                        key={`hit-${i}`}
                        x={barX(i, p.loads.length)}
                        y={0}
                        width={barW(p.loads.length)}
                        height={BASELINE}
                        fill="transparent"
                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onMouseEnter={() => setHoverBar(`${p.person.id}-${i}`)}
                        onMouseLeave={() => setHoverBar(null)}
                      />
                    ))}
                  </svg>
                  {p.loads.map((v, i) => {
                    if (hoverBar !== `${p.person.id}-${i}`) return null;
                    const h = (Math.min(v, CEILING) / CEILING) * BAR_TOP;
                    return (
                      <span
                        key={`tip-${i}`}
                        style={{
                          position: 'absolute',
                          left: barX(i, p.loads.length) + barW(p.loads.length) / 2,
                          top: BASELINE - h - 21,
                          transform: 'translateX(-50%)',
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 600,
                          fontSize: 13,
                          background: 'var(--color-bg)',
                          boxShadow: 'var(--shadow-sm)',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-md)',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      >
                        {v}%
                      </span>
                    );
                  })}
                  <div style={{ display: 'flex', paddingLeft: 4, marginTop: 5 }}>
                    {view.monthLabels.map((m) => (
                      <span
                        key={m}
                        style={{
                          width: slotW(view.monthLabels.length),
                          textAlign: 'center',
                          fontSize: 12,
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DemandChart view={view} />

      <h3 style={{ margin: 'var(--space-8) 0 4px' }}>Where the overspill comes from</h3>
      <p className="lede">The oversold months, and the projects driving them.</p>
      {overMonths.length === 0 ? (
        <p className="empty" style={{ marginTop: 'var(--space-4)', maxWidth: 1040 }}>
          Nobody is booked past a full week in the next {view.months.length} months.
        </p>
      ) : (
        <table className="table" style={{ marginTop: 'var(--space-4)', maxWidth: 1040 }}>
          <thead>
            <tr>
              <th style={{ width: 200 }}>Person</th>
              <th style={{ width: 96 }}>Month</th>
              <th style={{ textAlign: 'right', width: 130 }}>Over capacity</th>
              <th>Driven by</th>
            </tr>
          </thead>
          <tbody>
            {overMonths.map((row, i) => (
              <tr key={i}>
                <td>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{row.person.name}</span>
                </td>
                <td>{row.month}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-2-700)' }}>
                  +{row.over}% · {(row.over / 100).toFixed(2)} FTE
                </td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{row.projects.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const DEMAND_W = 1040;
const DEMAND_H = 280;
const DEMAND_BASE = 230;

function DemandChart({ view }: { view: PortfolioView }) {
  const cap = view.capacity;
  const ceiling = Math.max(1, Math.max(cap, ...view.demand) * 1.15);
  const scale = (v: number) => (v / ceiling) * 200;
  const slot = 950 / Math.max(1, view.months.length);
  const paleW = slot * 0.71;
  const darkW = slot * 0.37;

  return (
    <div style={{ margin: 'var(--space-8) 0' }}>
      <h3 style={{ marginBottom: 4 }}>How many people the work needs</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        The pale column is the {view.people.length} people we have. The dark column is how many the promised work needs.
        Red is the shortfall — work with nobody free to do it.
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
                const dh = scale(Math.min(d, cap));
                const oh = scale(Math.max(0, d - cap));
                return (
                  <g key={m}>
                    <rect x={left + (slot - paleW) / 2} y={DEMAND_BASE - scale(cap)} width={paleW} height={scale(cap)} fill="var(--color-neutral-200)" />
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
          <span style={{ width: 16, height: 0, borderTop: '1px dashed var(--color-text)', display: 'block' }} />
          Everyone, fully booked
        </span>
      </div>
    </div>
  );
}
