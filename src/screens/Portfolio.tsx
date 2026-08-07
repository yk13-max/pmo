import { useState } from 'react';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { money, ragColor } from '../lib/derive';
import { Spark, Stat } from '../components/Stat';
import { Drawer } from '../components/Drawer';

const RAG_ORDER = { R: 0, A: 1, G: 2 } as const;
const RAG_FILTERS = ['All', 'On track', 'Watch', 'At risk'] as const;

export function Portfolio({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const [showShortfall, setShowShortfall] = useState(false);
  const [type, setType] = useState<string>('All');
  const [rag, setRag] = useState<string>('All');
  const [pm, setPm] = useState<string>('All');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sort, setSort] = useState<'status' | 'priority'>('priority');

  const shown = view.projects
    .filter(
      (p) =>
        (type === 'All' || p.typeLabel === type) &&
        (rag === 'All' || p.ragLabel === rag) &&
        (pm === 'All' || p.pmName === pm),
    )
    .sort((a, b) =>
      sort === 'priority'
        ? a.priority - b.priority || RAG_ORDER[a.rag] - RAG_ORDER[b.rag]
        : RAG_ORDER[a.rag] - RAG_ORDER[b.rag] || b.load - a.load,
    );

  const managers = [...new Set(view.people.filter((p) => p.role === 'Project manager').map((p) => p.name))];
  const notAtRiskPct = view.projects.length
    ? Math.round(((view.projects.length - view.totals.atRisk) / view.projects.length) * 100)
    : 100;
  const hovered = shown.find((p) => p.id === hoverId) ?? null;

  return (
    <div>
      <div className="stat-row one-line">
        <Stat
          value={view.projects.length}
          label="Active projects"
          sub={`${view.totals.customerCount} customer · ${view.totals.internalCount} internal`}
          spark={
            <Spark
              cells={[
                { flex: Math.max(1, view.totals.customerCount), height: 9, bg: 'var(--color-text)', title: 'Customer' },
                { flex: Math.max(1, view.totals.internalCount), height: 9, bg: 'var(--color-neutral-400)', title: 'Internal' },
              ]}
            />
          }
        />
        <Stat
          value={money(view.totals.toBill)}
          label="Left to invoice"
          sub={`${money(view.totals.billed)} of ${money(view.totals.value)} billed`}
          spark={
            <Spark
              cells={[
                { flex: Math.max(1, view.totals.billed), height: 9, bg: 'var(--color-text)', title: 'Invoiced' },
                { flex: Math.max(1, view.totals.toBill), height: 9, bg: 'var(--color-neutral-300)', title: 'Left to invoice' },
              ]}
            />
          }
        />
        <Stat
          value={view.totals.atRisk}
          label="At risk"
          sub="Flagged by the project manager"
          color="var(--color-accent-2-700)"
          hover={
            <>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Projects flagged at risk</div>
              {view.projects.filter((p) => p.rag === 'R').length === 0 ? (
                <div style={{ fontSize: 13 }}>Nothing flagged.</div>
              ) : (
                view.projects
                  .filter((p) => p.rag === 'R')
                  .map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 13, padding: '2px 0' }}>
                      <span>
                        {p.name}
                        <span style={{ color: 'var(--color-neutral-600)' }}> · {p.client}</span>
                      </span>
                      <span style={{ color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>
                        {p.burnLabel} spent · {p.pmName}
                      </span>
                    </div>
                  ))
              )}
            </>
          }
          spark={
            <Spark
              gap={1}
              cells={view.projects.map((p) => ({
                flex: 1,
                height: p.rag === 'R' ? 18 : 9,
                bg: p.rag === 'R' ? 'var(--color-accent-2)' : 'var(--color-neutral-300)',
                title: `${p.name} — ${p.ragLabel}`,
              }))}
            />
          }
        />
        <Stat
          value={view.totals.shortOfPeople}
          label="Short of people"
          sub={`Depend on someone already booked past ${view.threshold}% of their month`}
          color="var(--color-accent-700)"
          onClick={() => setShowShortfall(true)}
          spark={<ShortfallSpark view={view} />}
        />
        <Stat
          value={`${notAtRiskPct}%`}
          label="Not at risk"
          sub={`${view.projects.length - view.totals.atRisk} of ${view.projects.length} projects on track or watching`}
          color={notAtRiskPct >= 80 ? 'var(--color-text)' : 'var(--color-accent-700)'}
          spark={
            <Spark
              cells={[
                { flex: Math.max(1, view.projects.length - view.totals.atRisk), height: 9, bg: 'var(--color-text)', title: 'Not at risk' },
                { flex: Math.max(0.0001, view.totals.atRisk), height: 9, bg: 'var(--color-accent-2)', title: 'At risk' },
              ]}
            />
          }
        />
      </div>

      {showShortfall && <ShortfallDetail view={view} onClose={() => setShowShortfall(false)} onOpenProject={onOpenProject} />}

      <Scatter projects={shown} hovered={hovered} onHover={setHoverId} />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-4) var(--space-8)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <FilterChips label="Type" options={['All', ...view.projectTypes.map((t) => t.label)]} value={type} onChange={setType} />
        <FilterChips label="Status" options={RAG_FILTERS} value={rag} onChange={setRag} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="eyebrow">Rank by</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={sort}
            onChange={(e) => setSort(e.target.value as 'status' | 'priority')}
          >
            <option value="priority">Priority</option>
            <option value="status">Status then load</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="eyebrow">Owner</span>
          <select className="input" style={{ width: 'auto', minWidth: 160 }} value={pm} onChange={(e) => setPm(e.target.value)}>
            {['All', ...managers].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18, fontSize: 12, color: 'var(--color-neutral-700)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-accent)', display: 'block' }} />
            Customer
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 3, height: 14, background: 'var(--color-neutral-400)', display: 'block' }} />
            Internal
          </span>
          <span>
            {shown.length} of {view.projects.length} shown
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="empty">Nothing matches these filters.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(376px,1fr))', gap: 'var(--space-8) 64px' }}>
          {shown.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** What sits behind "Short of people": which projects, and which people are the pinch. */
function ShortfallDetail({
  view,
  onClose,
  onOpenProject,
}: {
  view: PortfolioView;
  onClose: () => void;
  onOpenProject: (id: string) => void;
}) {
  const stretched = view.peopleViews
    .map((pv) => ({
      pv,
      months: pv.committed
        .map((v, i) => (v > (pv.person.capacity * view.threshold) / 100 ? i : -1))
        .filter((i) => i >= 0),
    }))
    .filter((r) => r.months.length);

  const affected = view.projects
    .map((project) => ({
      project,
      people: stretched.filter((r) =>
        r.months.some((i) => (view.allocationsOf(project.id)[`${r.pv.person.id}|${view.months[i]}`] ?? 0) > 0),
      ),
    }))
    .filter((r) => r.people.length);

  return (
    <Drawer title="Short of people" kicker="What is behind the number" onClose={onClose}>
      <p className="lede" style={{ marginBottom: 'var(--space-6)' }}>
        {affected.length} project{affected.length === 1 ? '' : 's'} depend on {stretched.length} person
        {stretched.length === 1 ? '' : 's'} already booked past {view.threshold}% of their own month.
      </p>

      <h4 style={{ margin: '0 0 var(--space-2)' }}>The people</h4>
      <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
        <thead>
          <tr>
            <th>Person</th>
            <th style={{ width: 150 }}>Job title</th>
            <th style={{ width: 90, textAlign: 'right' }}>Peak</th>
            <th>Months past the threshold</th>
          </tr>
        </thead>
        <tbody>
          {stretched.map(({ pv, months }) => (
            <tr key={pv.person.id}>
              <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{pv.person.name}</td>
              <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{pv.person.role}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-2-700)' }}>
                {pv.peak}%
              </td>
              <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                {months.map((i) => view.monthLabels[i]).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ margin: '0 0 var(--space-2)' }}>The projects</h4>
      {affected.length === 0 ? (
        <p className="empty">No project is currently exposed.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th style={{ width: 80 }}>Priority</th>
              <th style={{ width: 90 }}>Status</th>
              <th>Stretched people it relies on</th>
            </tr>
          </thead>
          <tbody>
            {affected.map(({ project, people }) => (
              <tr key={project.id}>
                <td>
                  <button type="button" className="card-link" onClick={() => onOpenProject(project.id)}>
                    <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      {project.name}
                    </span>
                    <span style={{ color: 'var(--color-neutral-600)', fontSize: 12 }}> · {project.client}</span>
                  </button>
                </td>
                <td style={{ fontSize: 13 }}>P{project.priority}</td>
                <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{project.ragLabel}</td>
                <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  {people.map((r) => r.pv.person.name).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Drawer>
  );
}

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span className="eyebrow">{label}</span>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ShortfallSpark({ view }: { view: PortfolioView }) {
  const gaps = view.months.map((_, i) => Math.max(0, Math.max(0, ...view.peopleViews.map((p) => p.loads[i])) - 100));
  const worst = Math.max(0, ...gaps);
  return (
    <Spark
      cells={gaps.map((g, i) => ({
        flex: 1,
        height: Math.max(2, Math.round((g / 50) * 22)),
        bg: g > 0 && g === worst ? 'var(--color-accent)' : 'var(--color-neutral-400)',
        title: `${view.monthLabels[i]} — ${g > 0 ? `${g}% over a full week` : 'within capacity'}`,
      }))}
    />
  );
}

const CHART_W = 1040;
const CHART_H = 340;

function Scatter({
  projects,
  hovered,
  onHover,
}: {
  projects: ProjectView[];
  hovered: ProjectView | null;
  onHover: (id: string | null) => void;
}) {
  const maxBudget = Math.max(1, ...projects.map((p) => p.budget));
  const x = (pct: number) => 70 + (pct / 100) * 950;
  const y = (budget: number) => 300 - Math.sqrt(budget / maxBudget) * 266;
  // Sized against the heaviest project in view so bubbles stay legible whatever the range.
  const maxLoad = Math.max(1, ...projects.map((p) => p.load));
  const radius = (load: number) => 5 + (load / maxLoad) * 8;

  const xTicks = [0, 25, 50, 75, 100];
  const xMinor = [12.5, 37.5, 62.5, 87.5];
  const yTicks = [0, Math.round(maxBudget / 4), Math.round(maxBudget / 2), maxBudget];
  const yMinor = [maxBudget / 8, (maxBudget * 3) / 8, (maxBudget * 5) / 8, (maxBudget * 7) / 8];

  /* Callouts are limited to what a delivery lead would stop on: anything at risk, plus
     priority 1-2. Labels are placed only where they will not collide with one already
     placed, so a crowded corner stays readable. */
  const callouts: { p: ProjectView; x: number; y: number; text: string; anchor: 'start' | 'end' }[] = [];
  const placed: { x: number; y: number; w: number }[] = [];
  [...projects]
    .filter((p) => p.rag === 'R' || p.priority <= 2)
    .sort((a, b) => a.priority - b.priority || b.budget - a.budget)
    .forEach((p) => {
      const cx = x(p.pct);
      const cy = y(p.budget);
      const text =
        p.rag === 'R' && p.burn > 90
          ? `${p.name} · ${p.burnLabel} spent`
          : p.rag === 'R'
            ? `${p.name} · at risk`
            : p.cust && p.value > p.billed
              ? `${p.name} · ${p.toBillLabel} to bill`
              : `${p.name} · P${p.priority}`;
      const w = text.length * 6.2 + 24;
      const anchor: 'start' | 'end' = cx > 720 ? 'end' : 'start';
      const left = anchor === 'start' ? cx : cx - w;
      const clash = placed.some((k) => Math.abs(k.y - cy) < 15 && left < k.x + k.w && k.x < left + w);
      if (clash) return;
      placed.push({ x: left, y: cy, w });
      callouts.push({ p, x: cx, y: cy, text, anchor });
    });

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <h3 style={{ marginBottom: 4 }}>Every project on one chart</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Read left to right for how far a project has got, bottom to top for how big its budget is. Big and top-right means
        expensive work that is nearly done; red means the project manager has flagged a problem.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 14 }}>
            Approved budget →
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
              role="img"
              aria-label="Every project by how far through its current phase it is against its approved budget"
            >
              <rect x={70} y={34} width={950} height={266} fill="none" stroke="var(--color-neutral-200)" strokeWidth={1} />
              {xMinor.map((t) => (
                <line key={`xm-${t}`} x1={x(t)} y1={34} x2={x(t)} y2={300} stroke="var(--color-neutral-200)" strokeWidth={0.5} />
              ))}
              {yMinor.map((t) => (
                <line key={`ym-${t}`} x1={70} y1={y(t)} x2={1020} y2={y(t)} stroke="var(--color-neutral-200)" strokeWidth={0.5} />
              ))}
              {xTicks.map((t) => (
                <line key={t} x1={x(t)} y1={34} x2={x(t)} y2={300} stroke="var(--color-neutral-300)" strokeWidth={1} />
              ))}
              {yTicks.map((t) => (
                <line key={t} x1={70} y1={y(t)} x2={1020} y2={y(t)} stroke="var(--color-neutral-300)" strokeWidth={1} />
              ))}
              {projects.map((p) => (
                <circle
                  key={p.id}
                  cx={x(p.pct)}
                  cy={y(p.budget)}
                  r={radius(p.load) + (hovered?.id === p.id ? 4 : 0)}
                  fill={p.cust ? ragColor(p.rag) : 'none'}
                  stroke={ragColor(p.rag)}
                  strokeWidth={1.5}
                  opacity={p.cust ? 0.82 : 1}
                />
              ))}
              {projects.map((p) => (
                <circle
                  key={`hit-${p.id}`}
                  cx={x(p.pct)}
                  cy={y(p.budget)}
                  r={radius(p.load) + 9}
                  fill="transparent"
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                  onMouseEnter={() => onHover(p.id)}
                  onMouseLeave={() => onHover(null)}
                />
              ))}
            </svg>
            {!hovered &&
              callouts.map((c) => (
                <span
                  key={`co-${c.p.id}`}
                  style={{
                    position: 'absolute',
                    left: `${(c.x / CHART_W) * 100}%`,
                    top: `${(c.y / CHART_H) * 100}%`,
                    transform: c.anchor === 'start' ? 'translate(14px,-50%)' : 'translate(-100%,-50%)',
                    marginLeft: c.anchor === 'end' ? -14 : 0,
                    fontSize: 11,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    color: c.p.rag === 'R' ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)',
                    background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)',
                    padding: '1px 4px',
                    borderRadius: 2,
                    pointerEvents: 'none',
                  }}
                >
                  {c.text}
                </span>
              ))}
            {xTicks.map((t) => (
              <span
                key={t}
                style={{
                  position: 'absolute',
                  left: `${(x(t) / CHART_W) * 100}%`,
                  top: `${(310 / CHART_H) * 100}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 13,
                  color: 'var(--color-neutral-700)',
                }}
              >
                {t}%
              </span>
            ))}
            {yTicks.map((t) => (
              <span
                key={t}
                style={{
                  position: 'absolute',
                  left: `${(62 / CHART_W) * 100}%`,
                  top: `${(y(t) / CHART_H) * 100}%`,
                  transform: 'translate(-100%,-50%)',
                  fontSize: 13,
                  color: 'var(--color-neutral-700)',
                }}
              >
                {t ? money(t) : ''}
              </span>
            ))}
            {hovered && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(x(hovered.pct) / CHART_W) * 100}%`,
                  top: `${((y(hovered.budget) - 18) / CHART_H) * 100}%`,
                  transform: 'translate(-50%,-100%)',
                  minWidth: 236,
                  padding: 'var(--space-3)',
                  background: 'var(--color-surface)',
                  boxShadow: 'var(--shadow-md)',
                  borderRadius: 'var(--radius-md)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
                  {hovered.client}
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.15, marginTop: 3 }}>
                  {hovered.name}
                </div>
                <div style={{ fontSize: 14, marginTop: 8 }}>
                  {hovered.cust
                    ? `${hovered.valueLabel} agreed · ${hovered.billedLabel} invoiced`
                    : `${hovered.budgetLabel} budget · ${hovered.actualLabel} spent`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 4 }}>
                  {hovered.phaseName} · {hovered.phaseStep}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                  {hovered.loadDaysLabel} this month · {hovered.ragLabel}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 6 }}>
                  {hovered.typeLabel} · {hovered.facingLabel} · {hovered.pmName}
                </div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, marginTop: 'var(--space-2)' }}>How far through the current phase →</div>
        </div>
      </div>
      <div className="legend" style={{ marginTop: 'var(--space-3)' }}>
        <span>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-neutral-500)', display: 'block' }} />
          Customer project
        </span>
        <span>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--color-neutral-500)', display: 'block' }} />
          Internal project
        </span>
        <span>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--color-accent-2)', display: 'block' }} />
          At risk
        </span>
        <span>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--color-warning)', display: 'block' }} />
          Watch
        </span>
        <span>Bigger circle = draws more of the team</span>
        <span>Labels mark at-risk and priority 1&ndash;2 work</span>
        <span>Hover a circle for the project&rsquo;s details</span>
      </div>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: ProjectView; onOpen: () => void }) {
  return (
    <article style={{ position: 'relative', padding: '2px 0 2px var(--space-4)' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, display: 'block', background: project.stripe }} />
      <button type="button" className="card-link" onClick={onOpen} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, width: '100%' }}>
          <span style={{ fontSize: 10, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            {project.client}
          </span>
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              title={`Priority ${project.priority} — ${project.priorityLabel}`}
              style={{
                fontSize: 10,
                letterSpacing: '.08em',
                padding: '1px 6px',
                borderRadius: 2,
                background: project.priority <= 2 ? 'var(--color-accent-2-100)' : 'var(--color-neutral-200)',
                color: project.priority <= 2 ? 'var(--color-accent-2-800)' : 'var(--color-neutral-800)',
              }}
            >
              P{project.priority}
            </span>
            <span style={{ fontSize: 10, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
              {project.typeShort}
            </span>
          </span>
        </div>
        <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, lineHeight: 1.1, letterSpacing: '-.015em' }}>
          {project.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', gap: 4, height: 6 }}>
            {project.pips.map((q, i) => (
              <span key={i} style={{ display: 'block', flex: 1, background: q.bg }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--color-neutral-700)' }}>
            <span>{project.phaseName}</span>
            <span style={{ flex: 'none' }}>{project.phaseStep}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: 'var(--color-neutral-600)' }}>Next</span> {project.milestone}{' '}
          <span style={{ color: 'var(--color-neutral-600)' }}>· {project.msDateLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', width: '100%', marginTop: 'var(--space-1)' }}>
          <div>
            <div className="eyebrow">{project.moneyLabel}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, marginTop: 3 }}>{project.moneyMain}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{project.moneySub}</div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div className="eyebrow">Team draw this month</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: project.loadColor }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: project.loadInk }}>
                {project.loadDaysLabel}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
              {project.loadSharePct.toFixed(1)}% of the portfolio
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{project.pmName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--color-neutral-700)', width: '100%' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: project.ragColor }} />
          {project.ragLabel}
          <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-600)' }}>{project.facingLabel}</span>
        </div>
      </button>
    </article>
  );
}
