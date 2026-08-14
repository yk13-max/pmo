import { useState } from 'react';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { money, ragColor, typeColour } from '../lib/derive';
import { Spark, Stat } from '../components/Stat';
import { Stripe, StripeSwatch } from '../components/Stripe';
import { PhaseBar } from '../components/PhaseBar';
import { Drawer } from '../components/Drawer';
import type { ProjectTypeDef } from '../types';

/** The two readings of the horizontal axis, in the order the toggle offers them. */
const X_MODES = ['Whole project', 'Current phase'] as const;
type XMode = (typeof X_MODES)[number];

const RAG_ORDER = { R: 0, A: 1, G: 2 } as const;
const RAG_FILTERS = ['All', 'On track', 'Watch', 'At risk'] as const;

export function Portfolio({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const [showShortfall, setShowShortfall] = useState(false);
  /* The kind of work, and — once a kind is chosen and there is more than one way of running
     it — which way. Picking a different kind clears the category, because a category belongs
     to one family and would otherwise leave nothing on the chart. */
  const [family, setFamily] = useState<string>('All');
  const [category, setCategory] = useState<string>('All');
  const [rag, setRag] = useState<string>('All');
  const [pm, setPm] = useState<string>('All');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sort, setSort] = useState<'status' | 'priority'>('priority');
  const [xMode, setXMode] = useState<XMode>(X_MODES[0]);
  const [showNames, setShowNames] = useState(false);

  const shown = view.projects
    .filter(
      (p) =>
        (family === 'All' || p.family === family) &&
        (category === 'All' || p.type === category) &&
        (rag === 'All' || p.ragLabel === rag) &&
        (pm === 'All' || p.pmName === pm),
    )
    .sort((a, b) =>
      sort === 'priority'
        ? a.priority - b.priority || RAG_ORDER[a.rag] - RAG_ORDER[b.rag]
        : RAG_ORDER[a.rag] - RAG_ORDER[b.rag] || b.load - a.load,
    );

  const managers = [...new Set(view.people.filter((p) => p.role === 'Project manager').map((p) => p.name))];
  const categories = family === 'All' ? [] : view.categoriesOf(family);
  /* The phase scale can only be drawn when everything on the chart follows the same set of
     phases — otherwise "phase 3" means a different thing from one dot to the next. That is
     true whenever one category is left standing, whether it was chosen or whether it is
     simply the only one its family has. */
  const onShow = [...new Set(shown.map((p) => p.type))];
  const single = onShow.length === 1 ? view.projectTypes.find((t) => t.id === onShow[0]) : undefined;
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

      <Scatter
        projects={shown}
        single={single}
        familyLabel={view.families.find((f) => f.id === single?.family)?.label ?? ''}
        colour={typeColour(view.families.findIndex((f) => f.id === single?.family))}
        xMode={xMode}
        onXMode={setXMode}
        showNames={showNames}
        onShowNames={setShowNames}
        hovered={hovered}
        onHover={setHoverId}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-4) var(--space-8)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <FilterChips
          label="Type"
          options={['All', ...view.families.map((f) => f.label)]}
          value={view.families.find((f) => f.id === family)?.label ?? 'All'}
          onChange={(label) => {
            setFamily(label === 'All' ? 'All' : (view.families.find((f) => f.label === label)?.id ?? 'All'));
            setCategory('All');
          }}
        />
        {/* Only worth asking once a kind of work is chosen and it is run more than one way.
            Narrowing to one is also what lets the chart draw its phase scale. */}
        {categories.length > 1 && (
          <FilterChips
            label="Category"
            options={['All', ...categories.map((c) => c.label)]}
            value={categories.find((c) => c.id === category)?.label ?? 'All'}
            onChange={(label) =>
              setCategory(label === 'All' ? 'All' : (categories.find((c) => c.label === label)?.id ?? 'All'))
            }
          />
        )}
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
        {/* Both halves of the stripe, named: the kind of work on top, who it is for beneath.
            The colour belongs to the kind, so every way of running it reads the same. */}
        <div className="legend" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, color: 'var(--color-neutral-700)' }}>
          {view.families.map((f, i) => (
            <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <StripeSwatch type={typeColour(i)} facing="var(--color-neutral-200)" />
              {f.label}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <StripeSwatch type="var(--color-neutral-200)" facing="var(--color-text)" />
            Customer
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <StripeSwatch type="var(--color-neutral-200)" facing="var(--color-neutral-300)" />
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
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(376px,1fr))', gap: 'var(--space-6) 64px' }}>
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
                    <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}> · {project.client}</span>
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
    <div className="chip-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
/** The gutter left of the plot: room for the money labels, and for the delivery type's
    name when a phase scale is on show and it needs writing out in full. */
const PLOT_LEFT = 70;
/** Room the money labels take, in pixels — what the axis title stands clear of. */
const Y_LABEL_W = 46;
const PLOT_RIGHT = 1020;
/** Height of the plot box itself. Everything above and below is measured from it. */
const PLOT_H = 407;
/** Room for one phase scale, and for the percentage labels under the plot. */
const BAND_H = 104;
/** The line above the phase labels that names the delivery type. */
const TYPE_ROW = 22;
const TICK_ROW = 26;

/* Round money for the budget axis. Two things keep it relevant: the values come off a
   1-2-5 ladder so they read as money rather than as arithmetic, and the ladder is clipped
   to the budgets actually on the chart — a tick below the smallest project labels empty
   space. The scale is a square root, so anything landing too close to the tick below it is
   dropped as well, which stops the top of the axis crowding. */
function budgetTicks(min: number, max: number, y: (v: number) => number): number[] {
  const ladder: number[] = [];
  for (let e = 0; e <= 9; e += 1) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= min && v <= max) ladder.push(v);
    }
  }
  const kept: number[] = [];
  // Walked from the top down, so the largest values are the ones that survive.
  [...ladder].reverse().forEach((v) => {
    if (!kept.length || Math.abs(y(v) - y(kept[kept.length - 1])) >= 34) kept.push(v);
  });
  return [0, ...kept.reverse()];
}

function Scatter({
  projects,
  single,
  familyLabel,
  colour,
  xMode,
  onXMode,
  showNames,
  onShowNames,
  hovered,
  onHover,
}: {
  projects: ProjectView[];
  /** The one category every project on the chart follows, where there is one. */
  single: ProjectTypeDef | undefined;
  /** The kind of work that category belongs to, for the line above the phases. */
  familyLabel: string;
  colour: string;
  xMode: XMode;
  onXMode: (mode: XMode) => void;
  /** Name every project on the plot, not just the ones worth stopping on. */
  showNames: boolean;
  onShowNames: (on: boolean) => void;
  hovered: ProjectView | null;
  onHover: (id: string | null) => void;
}) {
  /* Two readings of "how far along": across the whole project, or within the phase it is
     in now. The second answers "is this phase nearly done", which the first hides. */
  const overall = xMode === X_MODES[0];
  const xValue = (p: ProjectView) => (overall ? p.overallPct : p.pct);
  const axisTitle = overall ? 'How far through the whole project →' : 'How far through the current phase →';
  /* The horizontal scale is progress through a whole project, so one category's phases
     divide it evenly — which is what turns a bare percentage into "it is in validation".
     They can only be drawn when every project on the chart follows that same category:
     phases of one way of running the work say nothing about a project run another way, and
     a phase number would be comparing two different things.

     The scale only lines up under the whole-project reading. Against phase progress the
     axis means something different for every project, so there is nothing to name. */
  const selected = overall ? single : undefined;
  const phaseColour = selected ? colour : '';
  const phases = selected?.phases ?? [];

  const plotTop = phases.length ? BAND_H : 10;
  const plotBottom = plotTop + PLOT_H;
  const chartH = plotBottom + TICK_ROW + 6;

  const budgets = projects.map((p) => p.budget).filter((v) => v > 0);
  const maxBudget = Math.max(1, ...budgets);
  const minBudget = budgets.length ? Math.min(...budgets) : 1;
  /* The plot starts in the same place whether or not the phase scale is on show: the
     type's name sits above the phase labels rather than out to their left, so turning the
     scale on no longer shunts the whole chart sideways. */
  const plotLeft = PLOT_LEFT;
  const x = (pct: number) => plotLeft + (pct / 100) * (PLOT_RIGHT - plotLeft);
  const y = (budget: number) => plotBottom - Math.sqrt(budget / maxBudget) * PLOT_H;
  // Sized against the heaviest project in view so bubbles stay legible whatever the range.
  const maxLoad = Math.max(1, ...projects.map((p) => p.load));
  const radius = (load: number) => 5 + (load / maxLoad) * 8;

  const xTicks = [0, 25, 50, 75, 100];
  const xMinor = [12.5, 37.5, 62.5, 87.5];
  const yTicks = budgetTicks(minBudget, maxBudget, y);

  /* Two ways to label the plot. Left alone it calls out only what a delivery lead would
     stop on — anything at risk, plus priority 1-2 — and says why. Switched to names it
     labels every project with its name alone, so the chart can be read as a map.
     Either way a label is placed only where it will not collide with one already there,
     biggest budget first, so a crowded corner stays readable. */
  const callouts: { p: ProjectView; x: number; y: number; text: string; anchor: 'start' | 'end' }[] = [];
  const placed: { x: number; y: number; w: number }[] = [];
  (showNames
    ? [...projects].sort((a, b) => b.budget - a.budget)
    : [...projects]
        .filter((p) => p.rag === 'R' || p.priority <= 2)
        .sort((a, b) => a.priority - b.priority || b.budget - a.budget)
  ).forEach((p) => {
    const cx = x(xValue(p));
    const cy = y(p.budget);
    const text = showNames
      ? p.name
      : p.rag === 'R' && p.burn > 90
        ? `${p.name} · ${p.burnLabel} spent`
        : p.rag === 'R'
          ? `${p.name} · at risk`
          : p.cust && p.value > p.billed
            ? `${p.name} · ${p.toBillLabel} to bill`
            : `${p.name} · P${p.priority}`;
    // Roughly how wide the label will render at 12px, in the chart's own units.
    const w = text.length * 6.8 + 24;
    const anchor: 'start' | 'end' = cx > 720 ? 'end' : 'start';
    const left = anchor === 'start' ? cx : cx - w;
    const clash = placed.some((k) => Math.abs(k.y - cy) < 15 && left < k.x + k.w && k.x < left + w);
    if (clash) return;
    placed.push({ x: left, y: cy, w });
    callouts.push({ p, x: cx, y: cy, text, anchor });
  });

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-6)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Every project on one chart</h3>
          <p className="lede" style={{ margin: 0 }}>
            Read left to right for{' '}
            {overall
              ? 'how far a project has got overall'
              : 'how far through its current phase a project is, whichever phase that is'}
            , bottom to top for how big its budget is. Big and top-right means expensive work that is nearly done; red
            means the project manager has flagged a problem.
          </p>
        </div>
        {/* Its own full-width line under the lede: the chips sit where they always have, on
            the left, and only the tick is pushed over to the chart's right edge. */}
        <div className="control-row" style={{ flex: '1 1 100%', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          <FilterChips label="Read across as" options={X_MODES} value={xMode} onChange={(v) => onXMode(v as XMode)} />
          <label className="names-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={showNames}
              onChange={(e) => onShowNames(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Name every project
          </label>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
            <svg
              viewBox={`0 0 ${CHART_W} ${chartH}`}
              style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
              role="img"
              aria-label={`Every project by ${axisTitle.replace(/ →$/, '').toLowerCase()} against its approved budget`}
            >
              <rect
                x={plotLeft}
                y={plotTop}
                width={PLOT_RIGHT - plotLeft}
                height={plotBottom - plotTop}
                fill="none"
                stroke="var(--color-neutral-200)"
                strokeWidth={1}
              />
              {/* Every other phase carries the faintest wash of the type's colour, so the
                  phases read as distinct stretches of the chart and not just as ticks. */}
              {phases.map((name, i) =>
                i % 2 === 1 ? (
                  <rect
                    key={`band-${name}`}
                    x={x((i / phases.length) * 100)}
                    y={plotTop}
                    width={(PLOT_RIGHT - plotLeft) / phases.length}
                    height={plotBottom - plotTop}
                    fill={phaseColour}
                    opacity={0.045}
                  />
                ) : null,
              )}
              {xMinor.map((t) => (
                <line key={`xm-${t}`} x1={x(t)} y1={plotTop} x2={x(t)} y2={plotBottom} stroke="var(--color-neutral-200)" strokeWidth={0.5} />
              ))}
              {xTicks.map((t) => (
                <line key={t} x1={x(t)} y1={plotTop} x2={x(t)} y2={plotBottom} stroke="var(--color-neutral-300)" strokeWidth={1} />
              ))}
              {yTicks.map((t) => (
                <line key={t} x1={plotLeft} y1={y(t)} x2={PLOT_RIGHT} y2={y(t)} stroke="var(--color-neutral-300)" strokeWidth={1} />
              ))}

              {/* Where one phase gives way to the next, carried the full height so the
                  boundary is readable wherever a circle sits. */}
              {phases.slice(1).map((name, i) => {
                const at = ((i + 1) / phases.length) * 100;
                return (
                  <line
                    key={`edge-${name}`}
                    x1={x(at)}
                    y1={plotTop - 12}
                    x2={x(at)}
                    y2={plotBottom}
                    stroke={phaseColour}
                    strokeWidth={1}
                    opacity={0.4}
                  />
                );
              })}
              {projects.map((p) => (
                <circle
                  key={p.id}
                  cx={x(xValue(p))}
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
                  cx={x(xValue(p))}
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
                  className="chart-callout"
                  style={{
                    position: 'absolute',
                    left: `${(c.x / CHART_W) * 100}%`,
                    top: `${(c.y / chartH) * 100}%`,
                    transform: c.anchor === 'start' ? 'translate(14px,-50%)' : 'translate(-100%,-50%)',
                    marginLeft: c.anchor === 'end' ? -14 : 0,
                    fontSize: 12,
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
            {selected && (
              <PhaseAxis
                type={selected}
                familyLabel={familyLabel}
                colour={phaseColour}
                x={x}
                top={4}
                height={plotTop - 18}
                left={x(0)}
                chartH={chartH}
              />
            )}
            {xTicks.map((t) => (
              <span
                key={t}
                style={{
                  position: 'absolute',
                  left: `${(x(t) / CHART_W) * 100}%`,
                  top: `${((plotBottom + 8) / chartH) * 100}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 13,
                  color: 'var(--color-neutral-700)',
                }}
              >
                {t}%
              </span>
            ))}
            {/* The title sits just outside the money labels rather than at the far edge of
                the row, so no empty band opens between the two when the gutter widens to
                hold a delivery type's name. */}
            <span
              style={{
                position: 'absolute',
                left: `calc(${((plotLeft - 8) / CHART_W) * 100}% - ${Y_LABEL_W}px)`,
                top: `${((plotTop + PLOT_H / 2) / chartH) * 100}%`,
                transform: 'translate(-100%,-50%)',
                fontSize: 14,
              }}
            >
              <span style={{ display: 'block', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                Approved budget →
              </span>
            </span>
            {yTicks.map((t) => (
              <span
                key={t}
                style={{
                  position: 'absolute',
                  left: `${((plotLeft - 8) / CHART_W) * 100}%`,
                  top: `${(y(t) / chartH) * 100}%`,
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
                className="chart-tip"
                style={{
                  position: 'absolute',
                  left: `${(x(xValue(hovered)) / CHART_W) * 100}%`,
                  top: `${((y(hovered.budget) - 18) / chartH) * 100}%`,
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
                <div style={{ fontSize: 12, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
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
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>
                  {hovered.phaseName} · {hovered.phaseStep}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  {hovered.loadDaysLabel} this month · {hovered.ragLabel}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
                  {hovered.typeLabel} · {hovered.facingLabel} · {hovered.pmName}
                </div>
              </div>
            )}
      </div>
      <div style={{ textAlign: 'center', fontSize: 14, marginTop: 'var(--space-2)' }}>{axisTitle}</div>
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
        <span>
          {showNames
            ? 'Every project named, bar those a neighbour’s label would sit on top of'
            : 'Labels mark at-risk and priority 1–2 work'}
        </span>
        <span>Hover a circle for the project&rsquo;s details</span>
      </div>
    </div>
  );
}

/* A rule under each card separates the rows. Nothing vertical: the columns are already far
   apart, and a full grid of boxes would read as a table this is not. */
function ProjectCard({ project, onOpen }: { project: ProjectView; onOpen: () => void }) {
  return (
    <article
      style={{
        position: 'relative',
        padding: '2px 0 var(--space-6) var(--space-4)',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      <Stripe project={project} absolute />
      <button type="button" className="card-link" onClick={onOpen} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%' }}>
          <span style={{ fontSize: 12, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            {project.client}
          </span>
          {/* Priority and type on one line, with whose project it is directly beneath —
              the three things you check before opening the card. */}
          <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                title={`Priority ${project.priority} — ${project.priorityLabel}`}
                style={{
                  fontSize: 12,
                  letterSpacing: '.08em',
                  padding: '1px 6px',
                  borderRadius: 2,
                  background: project.priority <= 2 ? 'var(--color-accent-2-100)' : 'var(--color-neutral-200)',
                  color: project.priority <= 2 ? 'var(--color-accent-2-800)' : 'var(--color-neutral-800)',
                }}
              >
                P{project.priority}
              </span>
              <span style={{ fontSize: 12, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
                {project.typeShort}
              </span>
            </span>
            <span
              title={`Run by ${project.pmName}`}
              style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, color: 'var(--color-neutral-800)', whiteSpace: 'nowrap' }}
            >
              {project.pmName}
            </span>
          </span>
        </div>
        <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, lineHeight: 1.1, letterSpacing: '-.015em' }}>
          {project.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <PhaseBar project={project} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--color-neutral-700)' }}>
            <span>{project.phaseName}</span>
            <span style={{ flex: 'none' }}>{project.phaseStep}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: 'var(--color-neutral-600)' }}>Next</span> {project.milestone}{' '}
          <span style={{ color: 'var(--color-neutral-600)' }}>· {project.msDateLabel}</span>
        </div>
        <div className="card-money" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', width: '100%', marginTop: 'var(--space-1)' }}>
          <div>
            <div className="eyebrow">{project.moneyLabel}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, marginTop: 3 }}>{project.moneyMain}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{project.moneySub}</div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div className="eyebrow">Team draw this month</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: project.loadColor }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: project.loadInk }}>
                {project.loadDaysLabel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
              {project.loadSharePct.toFixed(1)}% of the portfolio
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--color-neutral-700)', width: '100%' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: project.ragColor }} />
          {project.ragLabel}
          <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-600)' }}>{project.facingLabel}</span>
        </div>
      </button>
    </article>
  );
}

/* One delivery type's phases laid along the horizontal scale. Because that scale is
   progress through a whole project, each phase takes an equal share of it — so a circle's
   position reads straight off as the phase it is in. */
function PhaseAxis({
  type,
  familyLabel,
  colour,
  x,
  top,
  height,
  left,
  chartH,
}: {
  type: ProjectTypeDef | undefined;
  /** The kind of work the category belongs to, said first. */
  familyLabel: string;
  colour: string;
  /** The same scale the plot uses, so the bands line up with the grid. */
  x: (pct: number) => number;
  top: number;
  height: number;
  /** Where the plot starts, so the type's name lines up with the first phase. */
  left: number;
  /** The canvas height the band is placed against; it changes with the bands on show. */
  chartH: number;
}) {
  if (!type?.phases.length) return null;
  const n = type.phases.length;
  return (
    <>
      {/* The type is named on its own line above the phase labels, starting where the plot
          starts. Out in a left-hand gutter it would push the whole plot across; here it
          reads as the heading of the row of phases beneath it and costs nothing sideways. */}
      <span
        style={{
          position: 'absolute',
          left: `${(left / CHART_W) * 100}%`,
          top: `${(top / chartH) * 100}%`,
          height: `${(TYPE_ROW / chartH) * 100}%`,
          display: 'flex',
          alignItems: 'center',
          fontSize: 12,
          lineHeight: 1.25,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          fontWeight: 600,
          color: colour,
        }}
      >
        {/* Both, because the phases below belong to one way of running one kind of work,
            and the scale means nothing without knowing which. */}
        {familyLabel} · {type.label}
      </span>
      {type.phases.map((name, i) => (
        <span
          key={name}
          title={`${familyLabel} · ${type.label} · phase ${i + 1} of ${n}: ${name}`}
          style={{
            position: 'absolute',
            left: `${(x((i / n) * 100) / CHART_W) * 100}%`,
            width: `${(((x(100) - x(0)) / n) / CHART_W) * 100}%`,
            top: `${((top + TYPE_ROW) / chartH) * 100}%`,
            height: `${((height - TYPE_ROW) / chartH) * 100}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2,
            padding: '0 4px',
            fontSize: 12,
            lineHeight: 1.25,
            textAlign: 'center',
            textWrap: 'balance',
            color: colour,
            overflow: 'hidden',
          }}
        >
          {/* The number carries the order when a name is too long to read at a glance,
              and matches the phase count shown on every card and detail page. */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 12,
              width: 18,
              height: 18,
              lineHeight: '18px',
              borderRadius: '50%',
              background: colour,
              color: 'var(--color-bg)',
              flex: 'none',
            }}
          >
            {i + 1}
          </span>
          <span>{name}</span>
        </span>
      ))}
    </>
  );
}
