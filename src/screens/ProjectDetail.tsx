import { useState } from 'react';
import type { Project } from '../types';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { hoursToDays } from '../lib/derive';
import { Tabs } from '../components/Tabs';
import { Stripe } from '../components/Stripe';
import { WindowControls } from '../components/WindowControls';
import { INVOICE_STAGES, PRIORITY_LABEL } from '../types';
import { fromISO, shortDateYear, toISO } from '../lib/dates';
import { usePortfolio } from '../store/portfolio';
import { invoicesOf } from '../lib/invoices';
import { InvoiceList } from '../components/InvoiceList';

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
  const { portfolio, setBaselined, rebaseline, setActualsShown, setActualDate } = usePortfolio();

  if (!project) {
    return <p className="empty">No projects yet. Add the first one from the Data screen.</p>;
  }

  /* Baselining and actuals: the plan as it was agreed, and what actually happened, both off
     until asked for. A project without either reads exactly as it always did — most work
     does not need measuring against a frozen plan, and a screen carrying two extra dates
     per phase for the sake of the ones that do would be worse for everybody. */
  const baseline = project.showBaseline ? project.baseline : undefined;
  const actuals = Boolean(project.showActuals);
  const actualDates = project.actualDates ?? [];
  /** Working days between two dates, positive when the second is later. */
  const slip = (from: string, to: string) =>
    Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86400000);
  const slipLabel = (days: number) => (days === 0 ? 'on the day' : days > 0 ? `${days}d late` : `${-days}d early`);
  const slipInk = (days: number) =>
    days > 0 ? 'var(--color-accent-2-700)' : days < 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-600)';
  /* The end being compared has to be read the same way on both sides. A dated last phase
     stands in for the typed end everywhere, and the view has already done that to the
     current one — so the baseline's last gate is what it is measured against, and its typed
     end only where it never had one. */
  const baseEnd = baseline ? baseline.phaseDates[project.phases.length - 1] || baseline.endDate : '';
  const endSlip = baseline ? slip(baseEnd, project.endDate) : 0;
  /** The invoices listed against this project, and the tasks one of them could wait on. */
  const listed = invoicesOf(portfolio, project.id);
  const projectTasks = portfolio.tasks.filter((t) => t.projectId === project.id);

  // Grouped by the kind of work, which is what the picker is scanned by.
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
            {view.families.map((family) => {
              /* Work on hold is listed with the rest: it has left the portfolio, but this
                 screen is a project's own record and a paused project still has one — and
                 leaving it out would mean opening it by name showed somebody else's. It
                 says what it is, and sorts after the running work of its own kind. */
              const mine = [
                ...view.projects.filter((p) => p.family === family.id),
                ...view.inactiveProjects.filter((p) => p.family === family.id),
              ];
              return mine.length ? (
                <optgroup key={family.id} label={family.label}>
                  {mine.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.facingLabel.toLowerCase()} · {p.client}
                      {p.inactive ? ' · on hold' : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(project)}>
          Edit project
        </button>
      </div>

      <div style={{ position: 'relative', paddingLeft: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Stripe project={project} absolute />
        {/* The number the business knows it by, where it has one, ahead of the client on
            the line above the name — it is how the project is asked for. */}
        <div className="kicker">
          {project.number ? `${project.number} · ` : ''}
          {project.client}
        </div>
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
      {/* Both off until asked for. Baselining freezes the plan as agreed and reads everything
          since against it; actuals is where the dates it really hit get typed in. */}
      <div
        className="no-print control-row"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(project.showBaseline)}
            onChange={(e) => setBaselined(project.id, e.target.checked)}
            style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
          />
          Baseline
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={actuals}
            onChange={(e) => setActualsShown(project.id, e.target.checked)}
            style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
          />
          Actuals
        </label>
        {baseline && (
          <>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
              Baselined {shortDateYear(baseline.takenAt)} · finish{' '}
              <strong style={{ color: slipInk(endSlip) }}>{slipLabel(endSlip)}</strong>
              {baseline.budget !== project.budget && ` · budget ${project.budget > baseline.budget ? 'up' : 'down'}`}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              title="Agree the plan as it stands now as the new baseline. What was there is replaced."
              onClick={() => {
                if (window.confirm(`Re-baseline ${project.name} to the plan as it stands now? The agreed plan it is being measured against is replaced.`))
                  rebaseline(project.id);
              }}
            >
              Re-baseline
            </button>
          </>
        )}
      </div>
      {/* A grid rather than a row of columns, so the four lines of every phase — bar, name,
          date, where it has got to — sit on the same four rows across the strip. A name that
          takes two lines then pushes every date down together instead of only its own. Two
          more rows appear when the plan is being read against its baseline, or against what
          actually happened, so those line up across the strip too. */}
      <div
        className="phase-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${project.phases.length}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${4 + (baseline ? 1 : 0) + (actuals ? 1 : 0)}, auto)`,
          gap: '8px var(--space-2)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {project.phases.map((name, i) => (
          <div
            key={name}
            style={{
              display: 'grid',
              gridTemplateRows: 'subgrid',
              gridRow: `span ${4 + (baseline ? 1 : 0) + (actuals ? 1 : 0)}`,
              gap: 8,
              minWidth: 0,
            }}
          >
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
            {/* What the gate was when the plan was agreed, and how far the current one has
                moved from it. Nothing to compare where the baseline never had a date. */}
            {baseline && (
              <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', alignSelf: 'end' }}>
                {baseline.phaseDates[i] ? (
                  <>
                    <span className="eyebrow" style={{ display: 'block' }}>Baseline</span>
                    {shortDateYear(baseline.phaseDates[i])}
                    {project.phaseDates[i] && (
                      <span style={{ color: slipInk(slip(baseline.phaseDates[i], project.phaseDates[i])) }}>
                        {' · '}
                        {slipLabel(slip(baseline.phaseDates[i], project.phaseDates[i]))}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="eyebrow" style={{ display: 'block' }}>Baseline</span>—
                  </>
                )}
              </span>
            )}
            {/* Typed here rather than in the edit pane: it is a fact recorded as the project
                runs, one phase at a time, and this is the screen it is read on. It saves as
                it is typed, the way the plan does. */}
            {actuals && (
              <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', alignSelf: 'end' }}>
                <span className="eyebrow" style={{ display: 'block' }}>Actual</span>
                <input
                  className="input no-print"
                  type="date"
                  value={actualDates[i] ?? ''}
                  aria-label={`When ${name} actually completed`}
                  style={{ fontSize: 12, padding: '2px 4px', height: 26, width: '100%', minWidth: 0 }}
                  onChange={(e) => setActualDate(project.id, i, e.target.value)}
                />
                <span className="print-only">{actualDates[i] ? shortDateYear(actualDates[i]) : '—'}</span>
                {actualDates[i] && project.phaseDates[i] && (
                  <span style={{ display: 'block', color: slipInk(slip(project.phaseDates[i], actualDates[i])) }}>
                    {slipLabel(slip(project.phaseDates[i], actualDates[i]))} against plan
                  </span>
                )}
              </span>
            )}
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
          {/* The invoices listed against this project, where any have been. They are the
              better record — one line per invoice actually expected, each with what it is
              worth and what it waits on — so where they exist they lead, and the four
              standing stages below become the older, coarser reading. */}
          {listed.length > 0 && (
            <InvoiceList project={project} invoices={listed} tasks={projectTasks} />
          )}
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
          {
            /* The written half of a project, and the only half nothing here can derive. It
               reads on its own tab because it is prose among figures: what the project
               delivers, what it has achieved, and what could still go wrong. The count is
               the risks, since that is the part of it anybody comes looking for. */
            id: 'review',
            label: 'For the review',
            count: (project.risks ?? []).length,
            render: () => <ReviewNarrative project={project} onEdit={onEdit} />,
          },
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

/* What the review asks for in words: the product, what has been achieved, and the risks with
   what is being done about them. It is read here and written on the project form — the same
   arrangement as every other field on this screen, and the reason the empty state points at
   the Edit button rather than offering a box to type in.

   The review pack prints this straight onto each project's slide, so what is written here is
   what goes in front of the meeting. That is worth saying on the page, because it changes how
   carefully somebody writes it. */
function ReviewNarrative({ project, onEdit }: { project: ProjectView; onEdit: (project: Project) => void }) {
  // One accomplishment per line, blank lines thrown away — the same reading the deck takes.
  const wins = (project.accomplishments ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const risks = project.risks ?? [];
  const anything = Boolean(project.productDescription) || wins.length > 0 || risks.length > 0;

  return (
    <>
      <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>For the review</h3>
          <p className="lede" style={{ margin: 0, maxWidth: '70ch' }}>
            The three things a review asks for that no figure can answer. They are printed onto this project&rsquo;s slide
            in the review pack exactly as they are written here.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" style={{ flex: 'none' }} onClick={() => onEdit(project)}>
          {anything ? 'Edit the wording' : 'Write it'}
        </button>
      </div>

      <h4 style={{ margin: '0 0 var(--space-2)' }}>Description of final product</h4>
      {project.productDescription ? (
        <p style={{ margin: '0 0 var(--space-6)', maxWidth: '70ch', fontSize: 16, textWrap: 'pretty', whiteSpace: 'pre-wrap' }}>
          {project.productDescription}
        </p>
      ) : (
        <p className="empty" style={{ marginBottom: 'var(--space-6)' }}>
          Nothing written yet. A sentence or two on what this project actually delivers.
        </p>
      )}

      <h4 style={{ margin: '0 0 var(--space-2)' }}>Key accomplishments to date</h4>
      {wins.length ? (
        <ul style={{ margin: '0 0 var(--space-6)', paddingLeft: '1.2em', maxWidth: '70ch', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wins.map((w, i) => (
            <li key={i} style={{ fontSize: 16, textWrap: 'pretty' }}>
              {w}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty" style={{ marginBottom: 'var(--space-6)' }}>
          Nothing listed yet. One line per thing achieved; they are printed as bullets.
        </p>
      )}

      <h4 style={{ margin: '0 0 var(--space-2)' }}>Risks and mitigations</h4>
      {risks.length ? (
        <table className="table" style={{ maxWidth: 1000 }}>
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Risk</th>
              <th style={{ width: '36%' }}>Mitigation or plan</th>
              <th>Assistance required</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id}>
                <td>
                  {/* Critical is the pack's red chip, and it is said the same way here so
                      the screen and the slide cannot disagree about which risk it is. */}
                  {r.critical && (
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 3,
                        marginRight: 8,
                        background: 'var(--color-accent-2)',
                        color: 'var(--color-surface)',
                      }}
                    >
                      Critical
                    </span>
                  )}
                  {r.risk || <span style={{ color: 'var(--color-neutral-600)' }}>—</span>}
                </td>
                <td>{r.mitigation || <span style={{ color: 'var(--color-neutral-600)' }}>—</span>}</td>
                <td>{r.assistance || <span style={{ color: 'var(--color-neutral-600)' }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">
          Risks and their mitigations, and whether you require support. Do not wait until the next PRC to raise a
          critical risk.
        </p>
      )}
    </>
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
  /* How full each person's month is across everything they carry, not just this project —
     the same reading the resourcing screen gives, brought here so a month that is a problem
     for the person shows as one while their booking on this project is being looked at. The
     months line up because this grid and the resourcing window are the same set. */
  const state = (personId: string, i: number): 'over' | 'watch' | 'clear' => {
    const pv = view.peopleViews.find((p) => p.person.id === personId);
    if (!pv) return 'clear';
    const total = pv.committed[i] ?? 0;
    if (total > pv.person.capacity) return 'over';
    return total >= (pv.person.capacity * view.threshold) / 100 ? 'watch' : 'clear';
  };
  const anyFlagged = team.some((r) => span.months.some((_, i) => state(r.person.id, i) !== 'clear'));

  return (
    <>
      {/* The same window control as the resourcing screen, and the same window behind it:
          set the months here and they follow you there. */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Who is working on it</h3>
          <p className="lede" style={{ margin: 0 }}>
            Share of each person&rsquo;s working week committed to this project, month by month. A column is coloured by
            how full that person&rsquo;s month is across everything they carry, not just this project. Hover a month for
            the hours behind it.
            {hoursOutside > 0 && (
              <>
                {' '}
                Another {hoursToDays(hoursOutside).toFixed(1)} days is booked outside these months — the project runs to{' '}
                {shortDateYear(project.endDate)}. Widen the window to bring it into view.
              </>
            )}
          </p>
          {anyFlagged && (
            <div className="legend" style={{ marginTop: 'var(--space-3)' }}>
              <span>
                <span style={{ width: 14, height: 12, background: 'color-mix(in srgb, var(--color-accent-2) 30%, var(--color-bg))', display: 'block' }} />
                Booked past a full month
              </span>
              <span>
                <span
                  style={{ width: 14, height: 12, background: 'color-mix(in srgb, var(--color-warning) 26%, var(--color-bg))', display: 'block' }}
                />
                At or above {view.threshold}% of it
              </span>
            </div>
          )}
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
                const how = state(row.person.id, i);
                return (
                  <div
                    key={i}
                    onMouseEnter={(e) => {
                      const at = e.currentTarget.getBoundingClientRect();
                      setHover({ key, left: at.left + at.width / 2, top: at.top, bottom: at.bottom });
                    }}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      height: 12,
                      /* The track carries the state of the person's whole month, so a column
                         is coloured even where their booking on this project is small. */
                      background:
                        how === 'over'
                          ? 'color-mix(in srgb, var(--color-accent-2) 30%, var(--color-bg))'
                          : how === 'watch'
                            ? 'color-mix(in srgb, var(--color-warning) 26%, var(--color-bg))'
                            : 'var(--color-neutral-200)',
                      position: 'relative',
                      cursor: hours ? 'help' : 'default',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.min(100, v)}%`,
                        background:
                          how === 'over'
                            ? 'var(--color-accent-2)'
                            : how === 'watch'
                              ? 'var(--color-warning)'
                              : 'var(--color-text)',
                      }}
                    />
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
                        {/* Everything they carry that month, which is what the colour of the
                            track is reporting. */}
                        <DetailRow
                          label="All their work that month"
                          value={`${view.peopleViews.find((p) => p.person.id === row.person.id)?.committed[i] ?? v}%`}
                        />
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
