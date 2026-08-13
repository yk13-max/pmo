import { useState } from 'react';
import type { Project } from '../types';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { hoursToDays } from '../lib/derive';
import { Tabs } from '../components/Tabs';
import { Stripe } from '../components/Stripe';
import { WindowControls } from '../components/WindowControls';
import { INVOICE_STAGES, PRIORITY_LABEL, STERILE_TYPE } from '../types';
import { shortDateYear, toISO } from '../lib/dates';

export function ProjectDetail({
  view,
  project,
  onSelect,
  onEdit,
  onSetWindow,
}: {
  view: PortfolioView;
  project: ProjectView | null;
  onSelect: (id: string) => void;
  onEdit: (project: Project) => void;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  if (!project) {
    return <p className="empty">No projects yet. Add the first one from the Data screen.</p>;
  }

  const cdmo = view.projects.filter((p) => p.type === 'CDMO');
  const cs = view.projects.filter((p) => p.type === 'CS');
  /* The grid shows the window the controls are set to and nothing else — "for 6 months"
     has to mean six columns. Bookings can still be entered right up to the project's own
     end in the edit pane; anything landing outside the window is counted below and the
     control beside the grid widens the view to reach it. */
  const span = { months: view.months, labels: view.monthLabels };
  const team = view.allocationsFor(project.id, span.months);
  const everything = view.allocationsFor(project.id, view.monthsFor(project).months);
  const hoursOutside =
    everything.reduce((n, r) => n + r.totalHours, 0) - team.reduce((n, r) => n + r.totalHours, 0);

  /* Invoices are not apportioned — what each one is worth is agreed project by project. A
     stage counts as raised once its date has passed. */
  const invoices = INVOICE_STAGES.map((label, i) => {
    const date = project.invoiceDates[i];
    const invoiced = Boolean(date) && date <= toISO(view.today);
    return {
      label,
      // Stages can straddle years, so the month alone would read out of order.
      date: date ? shortDateYear(date) : 'No date set',
      status: invoiced ? 'Raised' : 'Not yet due',
      ink: invoiced ? 'var(--color-text)' : 'var(--color-neutral-600)',
      dot: invoiced ? 'var(--color-accent)' : 'var(--color-neutral-300)',
    };
  });

  const notes: string[] = [];
  if (project.rag === 'R') notes.push('The project manager has flagged this at risk. It needs a decision this week.');
  if (project.burn > 95) notes.push(`Nearly all of the budget is spent — ${project.burnLabel} of it. More work means a new approval.`);
  if (team.some((t) => Math.max(...t.loads) > 0 && view.peopleViews.find((pv) => pv.person.id === t.person.id)?.committed.some((v, i) => v > t.person.capacity && t.loads[i] > 0)))
    notes.push('Someone booked on this project is over their available time in a month it needs them. Something has to give.');
  if (!team.length) notes.push('Nobody is booked on this project yet. Add allocations so it shows up in resourcing.');
  if (!notes.length) notes.push('Nothing outstanding. On plan, inside budget, and fully staffed.');

  return (
    <div className="printable">
      <div className="no-print control-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="picker" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label className="eyebrow" htmlFor="pd-project">
            Project
          </label>
          <select
            id="pd-project"
            className="input"
            style={{ width: 'auto', minWidth: 320 }}
            value={project.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            <optgroup label="CDMO">
              {cdmo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.facingLabel.toLowerCase()} · {p.client}
                </option>
              ))}
            </optgroup>
            <optgroup label="Client Solutions">
              {cs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.facingLabel.toLowerCase()} · {p.client}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(project)}>
          Edit project
        </button>
      </div>

      <div style={{ position: 'relative', paddingLeft: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Stripe project={project} absolute />
        <div className="kicker">{project.client}</div>
        <div className="doc-title" style={{ marginTop: 6 }}>
          {project.name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', fontSize: 14, color: 'var(--color-neutral-700)', marginTop: 'var(--space-3)' }}>
          <span>{project.typeLabel}</span>
          <span
            style={{
              fontSize: 12,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 3,
              background: project.priority <= 2 ? 'var(--color-accent-2-100)' : 'var(--color-neutral-200)',
              color: project.priority <= 2 ? 'var(--color-accent-2-800)' : 'var(--color-neutral-800)',
            }}
          >
            P{project.priority} {PRIORITY_LABEL[project.priority]}
          </span>
          <span>{project.facingLabel}</span>
          {project.type === STERILE_TYPE && <span>{project.sterileLabel}</span>}
          <span>Run by {project.pmName}</span>
          <span>
            {project.startLabel} → {project.endLabel}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.ragColor, display: 'block' }} />
            {project.ragLabel}
          </span>
        </div>
      </div>

      <Tabs
        storageKey="detail"
        renderAll
        tabs={[
          { id: 'progress', label: 'Progress & money', render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Where it has got to</h3>
      <p className="lede" style={{ margin: 0 }}>
        Currently in {project.phaseName} — phase {project.phaseStep}, {project.pct}% through it, and {project.overallPct}%
        through the project overall.
      </p>
      {/* The one thing to act on gets its own line, in the page's own weight rather than the
          lede's, so it is not read as the tail of the sentence above. */}
      <p style={{ margin: 'var(--space-2) 0 var(--space-4)', fontWeight: 600 }}>
        Next due: {project.milestone} on {project.msDateLabel}
      </p>
      {/* A grid rather than a row of columns, so the four lines of every phase — bar, name,
          date, where it has got to — sit on the same four rows across the strip. A name that
          takes two lines then pushes every date down together instead of only its own. */}
      <div
        className="phase-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${project.phases.length}, minmax(0, 1fr))`,
          gridTemplateRows: 'auto auto auto auto',
          gap: '8px var(--space-2)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {project.phases.map((name, i) => (
          <div key={name} style={{ display: 'grid', gridTemplateRows: 'subgrid', gridRow: 'span 4', gap: 8, minWidth: 0 }}>
            {/* Each phase's own bar, part-filled for the one in hand. */}
            <span style={{ position: 'relative', display: 'block', height: 6, background: 'var(--color-neutral-300)' }}>
              {project.pips[i]?.fill > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${project.pips[i].fill}%`,
                    background: project.pips[i].bg,
                    display: 'block',
                  }}
                />
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, lineHeight: 1.2, textWrap: 'pretty', alignSelf: 'start' }}>{name}</span>
            {/* Always drawn, even with no date on the gate: an empty line here is what keeps
                the row below it level with the rest. The year is carried because a project
                can run across three of them. */}
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', alignSelf: 'end' }}>
              {project.phaseDates[i] ? shortDateYear(project.phaseDates[i]) : '—'}
            </span>
            <span
              style={{
                fontSize: 12,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                alignSelf: 'end',
                color: i === project.phase ? 'var(--color-accent-700)' : 'var(--color-neutral-600)',
              }}
            >
              {i < project.phase ? 'Completed' : i === project.phase ? 'In progress' : 'Not started'}
            </span>
          </div>
        ))}
      </div>

      <div className="stat-row">
        <div>
          <div className="stat-value">{project.cust ? project.billedLabel : project.actualLabel}</div>
          <div className="stat-label">{project.cust ? 'Invoiced so far' : 'Drawn from the pool'}</div>
          <div className="stat-sub">
            {project.cust ? `of ${project.valueLabel} agreed with the client` : `of ${project.budgetLabel} approved`}
          </div>
        </div>
        <div>
          <div className="stat-value">{project.actualLabel}</div>
          <div className="stat-label">Spent so far</div>
          <div className="stat-sub">
            {project.burnLabel} of the {project.budgetLabel} budget · {project.remainLabel} left
          </div>
        </div>
        <div>
          <div className="stat-value" style={{ color: project.loadInk }}>
            {project.loadDaysLabel}
          </div>
          <div className="stat-label">Team draw this month</div>
          <div className="stat-sub">
            {project.loadSharePct.toFixed(1)}% of the portfolio&rsquo;s draw, across the {team.length || 'no'} people
            below
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-neutral-700)', marginBottom: 6 }}>
          <span>Budget spent</span>
          <span>
            {project.actualLabel} of {project.budgetLabel}
          </span>
        </div>
        <div style={{ height: 14, background: 'var(--color-neutral-200)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, project.burn)}%`, background: 'var(--color-text)' }} />
        </div>
      </div>

      </>) },
          ...(project.cust
            ? [{ id: 'invoicing', label: 'When the client pays', count: project.toBillLabel, render: () => (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h3 style={{ margin: '0 0 4px' }}>When the client pays</h3>
          <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
            The agreed {project.valueLabel} is billed in {project.currency} across these stages. What each one is worth
            is agreed with the client, so only the dates are tracked here. {project.billedLabel} has gone out;{' '}
            {project.toBillLabel} is still to come.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 640 }}>
            {invoices.map((iv) => (
              <div key={iv.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: iv.dot, display: 'block', flex: 'none' }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: iv.ink }}>{iv.label}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{iv.date}</span>
                <span style={{ marginLeft: 'auto', width: 110, textAlign: 'right', fontSize: 13, color: 'var(--color-neutral-600)' }}>
                  {iv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) }]
            : []),
          { id: 'team', label: 'Who is working on it', count: team.length, render: () => (
            <TeamGrid
          view={view}
          team={team}
          span={span}
          project={project}
          hoursOutside={hoursOutside}
          onSetWindow={onSetWindow}
        />
          ) },
          { id: 'watch', label: 'What to watch', count: notes.length, render: () => (<>
      <h3 style={{ margin: '0 0 var(--space-3)' }}>What to watch</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '64ch' }}>
        {notes.map((n) => (
          <p key={n} style={{ margin: 0, fontSize: 16, textWrap: 'pretty' }}>
            {n}
          </p>
        ))}
      </div>
      </>) },
        ]}
      />
    </div>
  );
}

/* Each person's commitment to this project, month by month. Hovering a month opens the
   detail behind the bar: the hours booked, and — the figure the tab is really asking for —
   how much of everything the project draws that month is theirs. */
/** Roughly how tall the hover panel is, used only to decide which side of the cell it
    goes on. Being a little out just means it flips a row earlier than it had to. */
const TIP_HEIGHT = 190;
/** How wide it is drawn, kept inside the window on a phone. */
const TIP_WIDTH = 230;

function TeamGrid({
  view,
  team,
  span,
  project,
  hoursOutside,
  onSetWindow,
}: {
  view: PortfolioView;
  team: ReturnType<PortfolioView['allocationsFor']>;
  /** The months on show — the window the controls are set to. */
  span: { months: string[]; labels: string[] };
  project: ProjectView;
  /** Hours booked on this project that fall outside those months. */
  hoursOutside: number;
  onSetWindow: (startMonth: string, months: number) => void;
}) {
  /* Which cell is hovered, and where it is on screen. The panel is placed against the
     window rather than the cell, because the grid scrolls sideways and a scrolling box
     clips anything hanging out of it — which is what hid the panel on the lower rows. */
  const [hover, setHover] = useState<{ key: string; left: number; top: number; bottom: number } | null>(null);
  const tipWidth = Math.min(TIP_WIDTH, window.innerWidth - 20);
  /* Each month keeps enough room for its own label whatever the span: a project running
     three years has as many columns as it has months, and squeezing those into a fixed
     width turned the headings into a smear and the bars into slivers. Past the width
     below, the grid scrolls sideways instead of shrinking. */
  const cols = `180px repeat(${span.months.length}, minmax(var(--month-min), 1fr)) 70px`;
  // What the whole team draws each month, so each person's share of it can be worked out.
  const monthTotals = span.months.map((_, i) => team.reduce((n, r) => n + r.hours[i], 0));

  return (
    <>
      {/* The same window control as the resourcing screen, and the same window behind it:
          set the months here and they follow you there. */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Who is working on it</h3>
          <p className="lede" style={{ margin: 0 }}>
            Share of each person&rsquo;s working week committed to this project, month by month. Hover a month for the
            hours behind it.
            {hoursOutside > 0 && (
              <>
                {' '}
                Another {hoursToDays(hoursOutside).toFixed(1)} days is booked outside these months — the project runs to{' '}
                {shortDateYear(project.endDate)}. Widen the window to bring it into view.
              </>
            )}
          </p>
        </div>
        <div className="control-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flex: 'none' }}>
          <WindowControls view={view} onSetWindow={onSetWindow} />
        </div>
      </div>
      {team.length === 0 ? (
        <p className="empty" style={{ maxWidth: 640, marginBottom: 'var(--space-8)' }}>
          Nobody booked yet. Open “Edit project” to book people onto it.
        </p>
      ) : (
        <div className="team-scroll" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 'min-content' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 'var(--space-2)', alignItems: 'end' }}>
            <span style={{ position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 1 }} />
            {span.labels.map((m) => (
              /* Clipped rather than allowed to run into its neighbour: on paper the columns
                 are squeezed to fit the page, and a truncated month reads better than two
                 of them printed on top of each other. */
              <span key={m} style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'center', overflow: 'hidden' }}>
                {m}
              </span>
            ))}
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'right' }}>Total</span>
          </div>
          {team.map((row) => (
            <div
              key={row.person.id}
              style={{ display: 'grid', gridTemplateColumns: cols, gap: 'var(--space-2)', alignItems: 'center' }}
            >
              <div style={{ position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>{row.person.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{row.person.role}</div>
              </div>
              {row.loads.map((v, i) => {
                const key = `${row.person.id}-${i}`;
                const hours = row.hours[i];
                const share = monthTotals[i] ? (hours / monthTotals[i]) * 100 : 0;
                return (
                  <div
                    key={i}
                    onMouseEnter={(e) => {
                      const at = e.currentTarget.getBoundingClientRect();
                      setHover({ key, left: at.left + at.width / 2, top: at.top, bottom: at.bottom });
                    }}
                    onMouseLeave={() => setHover(null)}
                    style={{ height: 12, background: 'var(--color-neutral-200)', position: 'relative', cursor: hours ? 'help' : 'default' }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, v)}%`, background: 'var(--color-text)' }} />
                    {hover?.key === key && (
                      <div
                        style={{
                          position: 'fixed',
                          /* Centred on the cell, but never past either edge of the window —
                             on a phone a cell near the end of the row would otherwise put
                             half the panel off the screen. */
                          left: Math.min(
                            Math.max(hover.left, tipWidth / 2 + 10),
                            window.innerWidth - tipWidth / 2 - 10,
                          ),
                          /* Below the cell normally; above it when the cell is low enough
                             that the panel would run off the bottom of the window. */
                          ...(hover.bottom + TIP_HEIGHT > window.innerHeight
                            ? { top: hover.top - TIP_HEIGHT - 6 }
                            : { top: hover.bottom + 6 }),
                          transform: 'translateX(-50%)',
                          width: tipWidth,
                          padding: 'var(--space-3)',
                          background: 'var(--color-bg)',
                          boxShadow: 'var(--shadow-lg)',
                          borderRadius: 'var(--radius-md)',
                          zIndex: 20,
                          pointerEvents: 'none',
                        }}
                      >
                        <div className="eyebrow" style={{ marginBottom: 6 }}>
                          {row.person.name} · {span.labels[i]}
                        </div>
                        <DetailRow label="Hours booked" value={`${hours}h`} />
                        <DetailRow label="In days" value={`${hoursToDays(hours).toFixed(1)}d`} />
                        <DetailRow label="Of their month" value={`${v}%`} />
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 'var(--space-4)',
                            alignItems: 'baseline',
                            paddingTop: 7,
                            marginTop: 5,
                            borderTop: '1px solid var(--color-divider)',
                          }}
                        >
                          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                            Of the {hoursToDays(monthTotals[i]).toFixed(1)}d this project draws
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-heading)',
                              fontWeight: 600,
                              fontSize: 19,
                              color: 'var(--color-accent)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', textAlign: 'right' }}>
                {hoursToDays(row.totalHours).toFixed(1)}d
              </div>
            </div>
          ))}
        </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 13, padding: '2px 0' }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
