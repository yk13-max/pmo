import { useEffect, useMemo, useState } from 'react';
import type { PortfolioView, ProjectView } from '../lib/derive';
import type { ConstraintType, Person, Project, Task } from '../types';
import { CONSTRAINTS, WORKING_HOURS_PER_DAY } from '../types';
import { usePortfolio } from '../store/portfolio';
import { schedule, depsToText, parseDeps, nextWorkingDay, type Scheduled } from '../lib/schedule';
import { fromISO, shortDate, shortDateYear, toISO } from '../lib/dates';
import { PRINT_CHART_WIDTH, printGantt } from '../lib/printGantt';
import { ColHead, usePlanColumns, type Widths } from '../components/PlanColumns';

/** How much of the chart one day takes, at each way of looking at it. */
const ZOOMS = [
  { id: 'Days', px: 22 },
  { id: 'Weeks', px: 7.5 },
  { id: 'Months', px: 2.6 },
  { id: 'Quarters', px: 1.1 },
] as const;
type Zoom = (typeof ZOOMS)[number]['id'];

const ROW = 34;
const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Days between two dates. Positive means later than it was meant to be. */
const slip = (from: string, to: string) => Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / DAY_MS);
/** Late is the colour of a problem, early the colour of a note, on the day neither. */
const slipInk = (d: number) =>
  d > 0 ? 'var(--color-accent-2-700)' : d < 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-600)';

type Row =
  | { kind: 'phase'; key: string; phase: number; name: string; start: string | null; end: string | null }
  | { kind: 'task'; key: string; number: number; task: Task; at: Scheduled | undefined };

export function Planning({
  view,
  projectId,
  onSelectProject,
  embedded = false,
}: {
  view: PortfolioView;
  /* One project is under the pencil at a time. The choice is held by the app rather than
     here, so the header's Edit project detail button knows which one it would open. */
  projectId: string | null;
  onSelectProject: (id: string) => void;
  /* Inside a project's own edit pane rather than on the Planning screen. The plan is the
     same plan and every control on it still works; what goes is the project picker, since
     the pane is already open on one project and is not the place to wander off to another. */
  embedded?: boolean;
}) {
  const { portfolio, saveTask, deleteTask, saveProject, baselinePlan, setPlanBaselineShown, setPlanActualsShown } =
    usePortfolio();
  const chosen = projectId ?? view.projects[0]?.id ?? '';
  const [zoom, setZoom] = useState<Zoom>('Weeks');
  const [depDraft, setDepDraft] = useState<{ id: string; text: string; error: string } | null>(null);
  // Off to begin with: the critical path is something you ask for, not the default read.
  const [showCritical, setShowCritical] = useState(false);
  /* Set while the plan is on its way to the printer. The chart is redrawn at the width of a
     page for the length of it, which is why this is state rather than something the print
     stylesheet could do on its own. */
  const [printing, setPrinting] = useState(false);
  /* The task list's column widths, dragged from the headings and remembered. */
  const { widths, resize, reset, isDefault } = usePlanColumns();

  /* The picker only offers running work, but a project on hold can still be opened from its
     own edit pane — and a plan is exactly what somebody picking a paused project back up
     wants to look at. So the one asked for is found among both, and only the falling back
     lands on the running list. */
  const project =
    view.projects.find((p) => p.id === chosen) ??
    view.inactiveProjects.find((p) => p.id === chosen) ??
    view.projects[0] ??
    null;

  const tasks = useMemo(
    () => (project ? portfolio.tasks.filter((t) => t.projectId === project.id) : []),
    [portfolio.tasks, project],
  );
  const plan = useMemo(() => schedule(tasks, project?.startDate), [tasks, project?.startDate]);

  /* Printing happens once the chart has been redrawn at the width of a page, which is a
     render away from the click — so the click sets the state and this sends it to the
     printer, and putting it back is what closing the dialog does. */
  useEffect(() => {
    if (printing) printGantt(() => setPrinting(false));
  }, [printing]);

  if (!project) return <p className="empty">No projects yet. Add one before planning it.</p>;

  /* Rows are the project's own phases with their tasks nested underneath, in the order
     they were added — numbering that shuffled as the dates moved would make the
     predecessor column impossible to type into. */
  const rows: Row[] = [];
  let n = 0;
  const numberOf = new Map<string, number>();
  project.phases.forEach((name, i) => {
    const mine = tasks.filter((t) => t.phase === i);
    const dates = mine.map((t) => plan.byId.get(t.id)).filter(Boolean) as Scheduled[];
    rows.push({
      kind: 'phase',
      key: `phase-${i}`,
      phase: i,
      name,
      start: dates.length ? dates.reduce((a, b) => (a.startDate < b.startDate ? a : b)).startDate : null,
      end: dates.length ? dates.reduce((a, b) => (a.endDate > b.endDate ? a : b)).endDate : null,
    });
    mine.forEach((task) => {
      n += 1;
      numberOf.set(task.id, n);
      rows.push({ kind: 'task', key: task.id, number: n, task, at: plan.byId.get(task.id) });
    });
  });
  const byNumber = new Map([...numberOf].map(([id, num]) => [num, id]));

  /* The plan against the plan that was agreed, and against what actually happened. Both off
     until asked for: a plan nobody is tracking is a plan, and two more date columns and two
     more bars per row would be in the way of building one. */
  const baselined = Boolean(project.showPlanBaseline) && Boolean(project.planBaselineAt);
  const planActuals = Boolean(project.showPlanActuals);
  /** Every task's dates as the schedule currently has them — what a baseline freezes. */
  const scheduleNow = () => {
    const at = new Map<string, { startDate: string; endDate: string }>();
    tasks.forEach((t) => {
      const s = plan.byId.get(t.id);
      if (s) at.set(t.id, { startDate: s.startDate, endDate: s.endDate });
    });
    return at;
  };

  /* How wide the task list has to be to hold what is on show. It was a fixed 846, which was
     right for the eleven columns it had; turning tracking on adds three date columns, and a
     fixed width would have squeezed the task name to nothing and then spilled the rest over
     the chart. So the width is the sum of the columns, and the chart takes what is left. */
  const shownCols = [
    widths.who,
    widths.days,
    widths.pct,
    widths.rule,
    widths.start,
    widths.finish,
    widths.after,
    widths.float,
    ...(baselined ? [widths.baseFinish] : []),
    ...(planActuals ? [widths.actStart, widths.actFinish] : []),
  ];
  /** The narrowest a task name is allowed to be before the list simply gets wider. */
  const TASK_MIN = 150;
  const gridWidth =
    16 /* the row's own padding */ +
    16 /* the tick */ +
    26 /* the number */ +
    TASK_MIN +
    22 /* the delete button */ +
    shownCols.reduce((n, w) => n + w, 0) +
    6 * (shownCols.length + 3) /* the gaps between all of them */;

  const zoomPx = ZOOMS.find((z) => z.id === zoom)?.px ?? 8;
  /* The chart opens on the plan, so adding a task shows it rather than leaving the bars
     off to the right of a project that started months earlier. With nothing planned yet
     it falls back to the project's own start, which is where the first task will land. */
  const first = plan.start ?? project.startDate;
  const last = [plan.end, project.endDate].filter(Boolean).sort().reverse()[0] as string;
  // Only ever look forward from the plan's own start, never back to an earlier project date.
  const chartFrom = plan.end && plan.end > (plan.start ?? '') ? plan.end : last;
  const chartStart = addDays(first, -7);
  const totalDays = Math.max(30, Math.round((fromISO(chartFrom).getTime() - fromISO(chartStart).getTime()) / DAY_MS) + 21);
  /* On paper a day is worth whatever makes the whole plan reach the right edge of the page,
     rather than what the zoom says: the zoom is for reading a stretch of the plan on screen,
     and a printed plan has to arrive whole. */
  const px = printing ? PRINT_CHART_WIDTH / totalDays : zoomPx;
  const chartW = totalDays * px;
  const x = (iso: string) => (Math.round((fromISO(iso).getTime() - fromISO(chartStart).getTime()) / DAY_MS)) * px;
  const barEnd = (iso: string) => x(iso) + px;
  const todayX = x(toISO(view.today));

  const addTask = (phase: number) => {
    const after = tasks.filter((t) => t.phase === phase).map((t) => plan.byId.get(t.id)?.endDate).filter(Boolean).sort();
    const start = after.length
      ? toISO(nextWorkingDay(fromISO(addDays(after[after.length - 1] as string, 1))))
      : toISO(nextWorkingDay(fromISO(project.phaseDates[phase] || project.startDate)));
    saveTask({
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      projectId: project.id,
      phase,
      name: 'New task',
      owner: '',
      days: 5,
      /* Typing a date into a plan is how a planner says "not before this", which is
         exactly what Microsoft Project does when you set a start on an auto-scheduled
         task. Anything else is a deliberate choice, made in the Rule column. */
      constraint: 'SNET',
      constraintDate: start,
      deps: [],
      done: 0,
    });
  };

  const months: { key: string; x: number; label: string }[] = [];
  {
    const cursor = fromISO(chartStart);
    cursor.setDate(1);
    for (let i = 0; i < 200; i += 1) {
      const iso = toISO(cursor);
      const at = x(iso);
      if (at > chartW) break;
      if (at >= 0) months.push({ key: iso, x: at, label: `${cursor.toLocaleString('en-GB', { month: 'short' })} ’${String(cursor.getFullYear()).slice(2)}` });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  /* Every month keeps its grid line; how many of them can say their name depends on how wide
     a month has come out. Squeezed onto a page, a long plan names one in three rather than
     printing them on top of each other. */
  const labelEvery = Math.max(1, Math.ceil(52 / Math.max(1, px * 30.4)));


  return (
    <div className="plan-page">
      {/* Only on paper: the screen says which project this is in the menu and the picker
          below, neither of which prints, and a plan handed to somebody has to name itself. */}
      <div className="print-only plan-print-head">
        <div className="kicker">{project.client} · {project.typeLabel}</div>
        <h2 style={{ margin: '2px 0 0' }}>{project.name}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
          {plan.start ? `Plan runs ${shortDateYear(plan.start)} → ${shortDateYear(plan.end as string)}` : 'Nothing planned yet'}
          {' · '}
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across {project.phases.length} phases
          {' · '}
          Printed {shortDateYear(toISO(view.today))}
        </p>
      </div>
      <div className="no-print control-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {!embedded && (
          <label className="picker" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="eyebrow" style={{ whiteSpace: 'nowrap' }}>Planning</span>
            <select
              id="pl-project"
              className="input"
              style={{ width: 'auto', minWidth: 340 }}
              value={project.id}
              onChange={(e) => {
                onSelectProject(e.target.value);
                setDepDraft(null);
              }}
            >
              {view.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.typeLabel} · {p.client}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="chip-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="eyebrow">Zoom</span>
          {ZOOMS.map((z) => (
            <button key={z.id} type="button" className="chip" aria-pressed={zoom === z.id} onClick={() => setZoom(z.id)}>
              {z.id}
            </button>
          ))}
        </span>
        {/* Beside the zoom, because what it puts on the page is what the zoom is showing. */}
        <button
          type="button"
          className="btn btn-secondary"
          title="The plan as it is on screen, on a landscape page"
          disabled={printing}
          onClick={() => setPrinting(true)}
        >
          {printing ? 'Printing…' : 'Export the plan as PDF'}
        </button>
        {/* Both switches sit together at the right, away from the project being picked and
            the zoom that changes what the chart shows. */}
        <span className="switches" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'auto' }}>
          {/* Planning is opt-in per project. Left off, the project keeps the start, end and
              phase dates entered on it, and every other screen reads those as it always did. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={Boolean(project.usesPlan)}
              onChange={(e) => saveProject({ ...(project as unknown as Project), usesPlan: e.target.checked })}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Plan this project here
          </label>
          {/* Only offered once the project is planned here: without a plan there is
              nothing to book anyone from. */}
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, whiteSpace: 'nowrap',
              cursor: project.usesPlan ? 'pointer' : 'not-allowed',
              opacity: project.usesPlan ? 1 : 0.5,
            }}
            title={
              project.usesPlan
                ? 'Book each task to its owner: its days times eight hours, at the weight below.'
                : 'Tick “Plan this project here” first.'
            }
          >
            <input
              type="checkbox"
              disabled={!project.usesPlan}
              checked={Boolean(project.plansResource)}
              onChange={(e) => saveProject({ ...(project as unknown as Project), plansResource: e.target.checked })}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Book people from this plan
          </label>
          {/* Tracking, the way a planner means it: the plan as agreed, and what happened. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={Boolean(project.showPlanBaseline)}
              title="Read the plan against the one that was agreed"
              onChange={(e) => {
                /* Engaging it with nothing to compare against takes the snapshot then and
                   there: being measured against a baseline nobody took is what somebody
                   ticking this is asking for. */
                if (e.target.checked && !project.planBaselineAt) baselinePlan(project.id, scheduleNow());
                setPlanBaselineShown(project.id, e.target.checked);
              }}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Baseline
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={planActuals}
              title="Record when each task really started and finished"
              onChange={(e) => setPlanActualsShown(project.id, e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
            />
            Actuals
          </label>
          {baselined && (
            <button
              type="button"
              className="btn btn-ghost"
              title={`Baselined ${shortDateYear(project.planBaselineAt as string)}. Taking it again agrees the plan as it stands now as the new one.`}
              onClick={() => {
                if (
                  window.confirm(
                    `Re-baseline this plan to the dates it has now? The agreed plan every task is being measured against is replaced.`,
                  )
                )
                  baselinePlan(project.id, scheduleNow());
              }}
            >
              Re-baseline
            </button>
          )}
          {/* Only offered once something has been dragged — a button undoing nothing is
              just another thing to read. */}
          {!isDefault && (
            <button
              type="button"
              className="btn btn-ghost"
              title="Put every column in the task list back to the width it started at"
              onClick={reset}
            >
              Reset columns
            </button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={showCritical}
              onChange={(e) => setShowCritical(e.target.checked)}
              style={{ accentColor: 'var(--color-accent-2)', width: 15, height: 15 }}
            />
            Critical path
          </label>
        </span>
      </div>

      {!project.usesPlan && (
        <p
          className="plan-note"
          style={{
            fontSize: 14,
            color: 'var(--color-neutral-700)',
            background: 'var(--color-surface)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {/* The panel lines up with everything else on the page; the sentence inside it keeps
              a measure that can be read across a wide window. */}
          <span>
            This project is not planned here. It runs {shortDateYear(project.startDate)} →{' '}
            {shortDateYear(project.endDate)} from the dates entered on the project itself, and that is what the
            timeline and every other screen shows. Anything built below is kept but not used until you tick{' '}
            <strong>Plan this project here</strong>.
          </span>
        </p>
      )}

      <PlanSummary project={project} plan={plan} tasks={tasks} numberOf={numberOf} />

      <div className="plan-workspace" style={{ display: 'flex', alignItems: 'flex-start', border: '1px solid var(--color-divider)' }}>
        {/* The task list. Everything here is editable in place; the chart to the right is
            drawn from it and never edited directly. */}
        <div className="plan-grid" style={{ flex: 'none', width: gridWidth, borderRight: '1px solid var(--color-divider)' }}>
          {/* Same padding and the same gap as a task row, so every heading lands over the
              control it names rather than drifting across the row. */}
          <div className="plan-grid-head" style={{ display: 'flex', height: ROW * 2, alignItems: 'flex-end', gap: 6, padding: '0 8px 6px', borderBottom: '1px solid var(--color-divider)', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
            {/* Over the tick. A checklist reads down its left edge, so the box that says a
                task is finished is the first thing on the row. */}
            <span style={{ width: 16, textAlign: 'center' }} title="Done">
              ✓
            </span>
            <span style={{ width: 26 }}>#</span>
            <span style={{ flex: 1, minWidth: 0 }}>Task</span>
            {/* Every one of these can be dragged by its right-hand edge, double-clicked
                back to where it started, or nudged with the arrow keys. */}
            <ColHead col="who" width={widths.who} label="Who" onResize={resize} />
            <ColHead col="days" width={widths.days} label="Days" align="right" onResize={resize} />
            <ColHead
              col="pct"
              width={widths.pct}
              label="% day"
              align="right"
              title="Per cent of that person's day, while the task runs"
              onResize={resize}
            />
            <ColHead col="rule" width={widths.rule} label="Rule" onResize={resize} />
            <ColHead col="start" width={widths.start} label="Start" onResize={resize} />
            <ColHead col="finish" width={widths.finish} label="Finish" align="right" onResize={resize} />
            <ColHead col="after" width={widths.after} label="After" align="right" onResize={resize} />
            <ColHead col="float" width={widths.float} label="Float" align="right" onResize={resize} />
            {baselined && (
              <ColHead
                col="baseFinish"
                width={widths.baseFinish}
                label="Was"
                align="right"
                title="What the agreed plan had this task finishing on, and how far it has moved"
                onResize={resize}
              />
            )}
            {planActuals && (
              <>
                <ColHead col="actStart" width={widths.actStart} label="Began" onResize={resize} />
                <ColHead col="actFinish" width={widths.actFinish} label="Ended" onResize={resize} />
              </>
            )}
            {/* Sits over the delete button, so every heading lands on its own column. */}
            <span style={{ width: 22 }} aria-hidden="true" />
          </div>
          {rows.map((row) =>
            row.kind === 'phase' ? (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: ROW,
                  padding: '0 8px',
                  gap: 6,
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-divider)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.phase + 1}. {row.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
                  {row.start ? `${shortDate(row.start)} → ${shortDate(row.end as string)}` : 'nothing planned'}
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => addTask(row.phase)}>
                  Add task
                </button>
              </div>
            ) : (
              <TaskRow
                key={row.key}
                row={row}
                widths={widths}
                baselined={baselined}
                planActuals={planActuals}
                people={view.people}
                numberOf={numberOf}
                byNumber={byNumber}
                depDraft={depDraft}
                setDepDraft={setDepDraft}
                onSave={saveTask}
                onDelete={deleteTask}
              />
            ),
          )}
        </div>

        {/* The chart. It scrolls sideways on its own; the rows line up because both sides
            step in the same row height. */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          <div style={{ position: 'relative', width: chartW, minWidth: '100%' }}>
            <div style={{ height: ROW * 2, position: 'relative', borderBottom: '1px solid var(--color-divider)' }}>
              {months.map((m, i) =>
                i % labelEvery === 0 ? (
                  <span key={m.key} style={{ position: 'absolute', left: m.x, bottom: 6, fontSize: 12, color: 'var(--color-neutral-700)', paddingLeft: 4, whiteSpace: 'nowrap' }}>
                    {m.label}
                  </span>
                ) : null,
              )}
            </div>
            <svg
              width={chartW}
              height={rows.length * ROW}
              style={{ position: 'absolute', left: 0, top: ROW * 2, pointerEvents: 'none' }}
            >
              <defs>
                <marker id="pl-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill="var(--color-neutral-600)" />
                </marker>
              </defs>
              {months.map((m) => (
                <line key={m.key} x1={m.x} y1={0} x2={m.x} y2={rows.length * ROW} stroke="var(--color-neutral-200)" strokeWidth={1} />
              ))}
              {rows.map((_, i) => (
                <line key={i} x1={0} y1={(i + 1) * ROW} x2={chartW} y2={(i + 1) * ROW} stroke="var(--color-divider)" strokeWidth={1} />
              ))}
              <line x1={todayX} y1={0} x2={todayX} y2={rows.length * ROW} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" />
              {/* One line per link, elbowed so it is readable even when a task runs
                  backwards from the one it waits on. */}
              {rows.map((row, i) => {
                if (row.kind !== 'task') return null;
                const to = row.at;
                if (!to) return null;
                return row.task.deps.map((dep) => {
                      const fromIndex = rows.findIndex((r) => r.kind === 'task' && r.task.id === dep.id);
                      const from = rows[fromIndex];
                      if (fromIndex < 0 || from.kind !== 'task' || !from.at) return null;
                      const y1 = fromIndex * ROW + ROW / 2;
                      const y2 = i * ROW + ROW / 2;
                      const startsAtFinish = dep.type === 'FS' || dep.type === 'FF';
                      const endsAtStart = dep.type === 'FS' || dep.type === 'SS';
                      const x1 = startsAtFinish ? barEnd(from.at.endDate) : x(from.at.startDate);
                      const x2 = endsAtStart ? x(to.startDate) : barEnd(to.endDate);
                      const d =
                        x2 - 12 > x1 + 6
                          ? `M${x1} ${y1} H${x1 + 6} V${y2} H${x2 - 6}`
                          : `M${x1} ${y1} H${x1 + 6} V${(y1 + y2) / 2} H${x2 - 16} V${y2} H${x2 - 6}`;
                      return (
                        <path
                          key={`${row.key}-${dep.id}`}
                          d={d}
                          fill="none"
                          stroke="var(--color-neutral-600)"
                          strokeWidth={1}
                          markerEnd="url(#pl-arrow)"
                        />
                      );
                    });
              })}
            </svg>
            <div style={{ position: 'relative' }}>
              {rows.map((row) => (
                <div key={row.key} style={{ position: 'relative', height: ROW }}>
                  {row.kind === 'phase' && row.start && (
                    <span
                      title={`${row.name}: ${shortDateYear(row.start)} → ${shortDateYear(row.end as string)}`}
                      style={{
                        position: 'absolute',
                        left: x(row.start),
                        width: Math.max(3, barEnd(row.end as string) - x(row.start)),
                        top: ROW / 2 - 5,
                        height: 10,
                        background: 'var(--color-accent-700)',
                        borderRadius: 2,
                        display: 'block',
                        opacity: 0.85,
                      }}
                    />
                  )}
                  {/* The agreed plan, under the bar and thinner, the way a tracking Gantt
                      shows it: where the task was going to be, so the gap between the two
                      is the slip, read off the chart rather than out of a column. */}
                  {row.kind === 'task' && baselined && row.task.baseStart && row.task.baseFinish && (
                    <span
                      title={`Agreed: ${shortDateYear(row.task.baseStart)} → ${shortDateYear(row.task.baseFinish)}`}
                      style={{
                        position: 'absolute',
                        left: x(row.task.baseStart),
                        width: Math.max(3, barEnd(row.task.baseFinish) - x(row.task.baseStart)),
                        top: ROW / 2 + 7,
                        height: 5,
                        background: 'var(--color-neutral-400)',
                        borderRadius: 2,
                        display: 'block',
                      }}
                    />
                  )}
                  {/* And what actually happened, over the top of it. */}
                  {row.kind === 'task' && planActuals && row.task.actualStart && (
                    <span
                      title={`Actually: ${shortDateYear(row.task.actualStart)} → ${row.task.actualFinish ? shortDateYear(row.task.actualFinish) : 'still running'}`}
                      style={{
                        position: 'absolute',
                        left: x(row.task.actualStart),
                        width: Math.max(3, barEnd(row.task.actualFinish || row.task.actualStart) - x(row.task.actualStart)),
                        top: ROW / 2 - 13,
                        height: 5,
                        background: 'var(--color-teal-700)',
                        borderRadius: 2,
                        display: 'block',
                        /* An unfinished task is drawn to where it has got to and left open
                           at the end rather than pretending to a finish it has not had. */
                        opacity: row.task.actualFinish ? 1 : 0.55,
                      }}
                    />
                  )}
                  {row.kind === 'task' && row.at && (
                    <span
                      title={`${row.task.name}: ${shortDateYear(row.at.startDate)} → ${shortDateYear(row.at.endDate)}${row.task.done >= 100 ? ' · complete' : row.at.critical ? ' · on the critical path' : ` · ${row.at.float} days of float`}`}
                      style={{
                        position: 'absolute',
                        left: x(row.at.startDate),
                        width: Math.max(3, barEnd(row.at.endDate) - x(row.at.startDate)),
                        top: ROW / 2 - 8,
                        height: 16,
                        background: showCritical && row.at.critical ? 'var(--color-accent-2)' : 'var(--color-accent)',
                        borderRadius: 3,
                        display: 'block',
                      }}
                    >
                      {row.task.done > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${Math.min(100, row.task.done)}%`,
                            background: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                            borderRadius: '3px 0 0 3px',
                            display: 'block',
                          }}
                        />
                      )}
                      {/* Ruled through, the way a finished line on a list is. A part-done
                          task is the shaded stretch above and nothing more; the line means
                          the whole bar is behind you, and it reads at any zoom, where a bar
                          a pixel and a half wide has no room to show shading at all. */}
                      {row.task.done >= 100 && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 1,
                            right: 1,
                            top: '50%',
                            height: 2,
                            marginTop: -1,
                            background: 'var(--color-bg)',
                            borderRadius: 1,
                            display: 'block',
                          }}
                        />
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="legend" style={{ marginTop: 'var(--space-3)' }}>
        <span>
          <span style={{ width: 26, height: 10, background: 'var(--color-accent-700)', display: 'block' }} />
          Phase
        </span>
        <span>
          <span style={{ width: 26, height: 10, background: 'var(--color-accent)', display: 'block' }} />
          Task
        </span>
        <span>
          <span style={{ width: 26, height: 10, background: 'var(--color-accent-2)', display: 'block' }} />
          On the critical path
        </span>
        <span>
          <span style={{ width: 26, height: 10, background: 'var(--color-accent)', display: 'grid', alignItems: 'center' }}>
            <span style={{ height: 2, background: 'var(--color-bg)', display: 'block' }} />
          </span>
          Complete
        </span>
        {baselined && (
          <span>
            <span style={{ width: 26, height: 5, background: 'var(--color-neutral-400)', display: 'block' }} />
            Where the agreed plan had it
          </span>
        )}
        {planActuals && (
          <span>
            <span style={{ width: 26, height: 5, background: 'var(--color-teal-700)', display: 'block' }} />
            What actually happened
          </span>
        )}
        <span>
          <span style={{ width: 16, height: 0, borderTop: '1px dashed var(--color-text)', display: 'block' }} />
          Today
        </span>
        <span>Predecessors read as 3, or 3SS+2 for a start-to-start link with two days of lag</span>
        <span>Rule is the constraint: ASAP, ALAP, start or finish no earlier/later than, must start/finish on</span>
      </div>
    </div>
  );
}

/** What the plan adds up to, and anything wrong with it. */
function PlanSummary({
  project,
  plan,
  tasks,
  numberOf,
}: {
  project: ProjectView;
  plan: ReturnType<typeof schedule>;
  tasks: Task[];
  numberOf: Map<string, number>;
}) {
  const critical = plan.ordered.filter((s) => s.critical).length;
  const name = (id: string) => tasks.find((t) => t.id === id)?.name ?? id;
  /* What the plan asks of people, rather than how long it takes to happen. A task of four
     days at a quarter of somebody's day is one day of work, not four — the same arithmetic
     the plan books people by — so this is the sum of every task at its own share of a day.
     End to end is still on the page either side of it, as the two dates the plan runs
     between. */
  const scheduledDays = tasks.reduce((n, t) => n + t.days * ((t.weight ?? 100) / 100), 0);
  const scheduledHours = scheduledDays * WORKING_HOURS_PER_DAY;
  /* Credited as far as each task has got, so a plan half way through a long task is not
     rounded down to nothing. The tick sets a task to all or none of it; a sheet can bring
     in anything in between, and this counts that too. */
  const doneHours = tasks.reduce(
    (n, t) => n + t.days * ((t.weight ?? 100) / 100) * WORKING_HOURS_PER_DAY * (Math.min(100, Math.max(0, t.done)) / 100),
    0,
  );
  const complete = tasks.filter((t) => t.done >= 100).length;
  /** Whole where it is whole, one place where it is not — 27 rather than 27.0, 27.5 as it is. */
  const trim = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Number(n.toFixed(1)));
  const hours = (n: number) => Math.round(n).toLocaleString('en-GB');
  return (
    <>
      <div className="stat-row one-line" style={{ marginBottom: 'var(--space-4)' }}>
        <Fig value={String(tasks.length)} label="Tasks" sub={`Across ${project.phases.length} phases`} />
        <Fig value={plan.start ? shortDateYear(plan.start) : '—'} label="Plan starts" sub={`Project opens ${shortDateYear(project.startDate)}`} />
        <Fig
          value={plan.end ? shortDateYear(plan.end) : '—'}
          label="Plan finishes"
          sub={
            plan.end
              ? plan.end > project.endDate
                ? `Past the project's own end of ${shortDateYear(project.endDate)}`
                : `Inside the project's end of ${shortDateYear(project.endDate)}`
              : 'Nothing planned yet'
          }
          color={plan.end && plan.end > project.endDate ? 'var(--color-accent-2-700)' : undefined}
        />
        <Fig
          value={String(trim(scheduledDays))}
          label="Working days scheduled"
          sub="Every task's days at its share of a day"
        />
        <Fig
          value={hours(doneHours)}
          label="Hours complete"
          sub={`Of ${hours(scheduledHours)} scheduled · ${complete} of ${tasks.length} tasks ticked off`}
        />
        <Fig
          value={String(critical)}
          label="Tasks that cannot slip"
          sub="A day lost on any of these is a day lost on the project"
          color={critical ? 'var(--color-accent-2-700)' : undefined}
        />
      </div>
      {plan.conflicts.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          {plan.conflicts.map((c) => (
            <p key={c.id} style={{ color: 'var(--color-accent-2-700)', fontSize: 14, margin: '0 0 4px' }}>
              {numberOf.get(c.id) ?? '?'} {name(c.id)} {c.message}. The rule has been kept and the links let go.
            </p>
          ))}
        </div>
      )}
      {plan.cycles.length > 0 && (
        <p style={{ color: 'var(--color-accent-2-700)', fontSize: 14, marginBottom: 'var(--space-4)' }}>
          These tasks wait on each other in a loop, so none of them can be scheduled:{' '}
          {plan.cycles.map((id) => `${numberOf.get(id) ?? '?'} ${name(id)}`).join(', ')}. Break one of the links.
        </p>
      )}
    </>
  );
}

function Fig({ value, label, sub, color }: { value: string; label: string; sub: string; color?: string }) {
  return (
    <div>
      <div className="stat-value" style={{ fontSize: 30, color }}>{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function TaskRow({
  row,
  widths,
  baselined,
  planActuals,
  people,
  numberOf,
  byNumber,
  depDraft,
  setDepDraft,
  onSave,
  onDelete,
}: {
  row: Extract<Row, { kind: 'task' }>;
  widths: Widths;
  baselined: boolean;
  planActuals: boolean;
  people: Person[];
  numberOf: Map<string, number>;
  byNumber: Map<number, string>;
  depDraft: { id: string; text: string; error: string } | null;
  setDepDraft: (d: { id: string; text: string; error: string } | null) => void;
  onSave: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { task, at } = row;
  const set = (patch: Partial<Task>) => onSave({ ...task, ...patch });
  const written = depsToText(task.deps, (id) => numberOf.get(id) ?? null);
  const needsDate = CONSTRAINTS.find((c) => c.id === task.constraint)?.needsDate ?? true;
  const editing = depDraft?.id === task.id;
  const cell: React.CSSProperties = { fontSize: 13, padding: '2px 4px', height: 26 };

  return (
    <div
      className="task-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: ROW,
        padding: '0 8px',
        gap: 6,
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      {/* Done or not done. The model keeps how far through a task is as a percentage, which
          a sheet can still import at anything in between and the bar still draws; from here
          it is the two ends of it, because that is the question anybody running a plan is
          answering — is this finished. */}
      <input
        type="checkbox"
        checked={task.done >= 100}
        aria-label={`Task ${row.number} complete`}
        title={task.done >= 100 ? 'Complete' : task.done > 0 ? `${task.done}% done — tick to complete` : 'Tick when this is finished'}
        style={{ width: 16, height: 16, flex: 'none', accentColor: 'var(--color-accent)', margin: 0 }}
        onChange={(e) => set({ done: e.target.checked ? 100 : 0 })}
      />
      <span style={{ width: 26, fontSize: 12, color: 'var(--color-neutral-600)', fontVariantNumeric: 'tabular-nums' }}>
        {row.number}
      </span>
      <input
        className="input"
        style={{ ...cell, flex: 1, minWidth: 0, textDecoration: task.done >= 100 ? 'line-through' : undefined }}
        defaultValue={task.name}
        aria-label={`Task ${row.number} name`}
        onBlur={(e) => e.target.value !== task.name && set({ name: e.target.value })}
      />
      {/* Picked from the team rather than typed, because this is who the task books when
          the plan is booking people. The name is stored beside the id so an exported sheet
          still reads, and so a plan built before anyone was linked keeps what it said. */}
      <select
        className="input"
        style={{ ...cell, width: widths.who, flex: 'none', fontSize: 12 }}
        value={task.ownerId ?? ''}
        aria-label={`Task ${row.number} owner`}
        onChange={(e) => {
          const person = people.find((p) => p.id === e.target.value);
          set({ ownerId: person?.id ?? '', owner: person?.name ?? '' });
        }}
      >
        <option value="">{task.owner && !task.ownerId ? task.owner : '—'}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        className="input"
        type="number"
        min={1}
        step={1}
        style={{ ...cell, width: widths.days, flex: 'none', textAlign: 'right' }}
        defaultValue={task.days}
        aria-label={`Task ${row.number} days`}
        onBlur={(e) => {
          const days = Math.max(1, Math.round(Number(e.target.value) || 1));
          if (days !== task.days) set({ days });
          e.target.value = String(days);
        }}
      />
      {/* How much of the owner's day it takes while it runs. Half of a two-day task is one
          day of their time, not two — which is the whole point of having it. */}
      <input
        className="input"
        type="number"
        min={0}
        max={100}
        step={5}
        style={{ ...cell, width: widths.pct, flex: 'none', textAlign: 'right' }}
        defaultValue={task.weight ?? 100}
        aria-label={`Task ${row.number} share of the owner's day, per cent`}
        title="Per cent of that person's day, while the task runs."
        onBlur={(e) => {
          const weight = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
          if (weight !== (task.weight ?? 100)) set({ weight });
          e.target.value = String(weight);
        }}
      />
      <select
        className="input"
        style={{ ...cell, width: widths.rule, flex: 'none', fontSize: 12 }}
        value={task.constraint}
        aria-label={`Task ${row.number} constraint`}
        title={CONSTRAINTS.find((c) => c.id === task.constraint)?.hint}
        onChange={(e) => set({ constraint: e.target.value as ConstraintType })}
      >
        {CONSTRAINTS.map((c) => (
          <option key={c.id} value={c.id} title={c.hint}>
            {c.id}
          </option>
        ))}
      </select>
      {/* The date the rule beside it is measured against — for the usual rule, the day the
          task may start. On paper the rule column is not printed and there is nothing to
          type into, so what shows there instead is the day the plan actually has it
          starting, which is the day its bar begins. */}
      <span className="task-start" style={{ width: widths.start, flex: 'none', display: 'flex', alignItems: 'center' }}>
        <input
          className="input"
          type="date"
          style={{ ...cell, width: '100%', minWidth: 0, fontSize: 12, visibility: needsDate ? 'visible' : 'hidden' }}
          value={task.constraintDate}
          aria-label={`Task ${row.number} start rule date`}
          aria-hidden={needsDate ? undefined : true}
          tabIndex={needsDate ? undefined : -1}
          title="Work only lands on weekdays, so a weekend here moves to the Monday."
          onChange={(e) => {
            if (!e.target.value) return;
            // Nothing is worked at a weekend, so a date dropped on one moves to the Monday.
            set({ constraintDate: toISO(nextWorkingDay(fromISO(e.target.value))) });
          }}
        />
        <span className="print-only" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>
          {at ? shortDate(at.startDate) : '—'}
        </span>
      </span>
      <span
        title={at?.conflict ? `Its rule and its links disagree: ${at.conflict}` : undefined}
        style={{
          width: widths.finish,
          flex: 'none',
          textAlign: 'right',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          color: at?.conflict ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)',
        }}
      >
        {at ? `${at.conflict ? '! ' : ''}${shortDate(at.endDate)}` : '—'}
      </span>
      <input
        className="input"
        style={{ ...cell, width: widths.after, flex: 'none', fontSize: 12 }}
        value={editing ? depDraft.text : written}
        placeholder="—"
        aria-label={`Task ${row.number} predecessors`}
        aria-invalid={editing && depDraft.error ? true : undefined}
        title={editing && depDraft.error ? depDraft.error : 'Task numbers, e.g. 3 or 3SS+2'}
        onChange={(e) => setDepDraft({ id: task.id, text: e.target.value, error: '' })}
        onBlur={(e) => {
          const parsed = parseDeps(e.target.value, (num) => byNumber.get(num) ?? null, row.number);
          if (parsed.error) {
            setDepDraft({ id: task.id, text: e.target.value, error: parsed.error });
            return;
          }
          setDepDraft(null);
          set({ deps: parsed.deps });
        }}
      />
      <span
        style={{
          width: widths.float,
          flex: 'none',
          textAlign: 'right',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          color: at?.critical ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)',
        }}
      >
        {at ? (at.critical ? 'none' : `${at.float}d`) : '—'}
      </span>
      {/* What the agreed plan had it finishing on, and how far it has moved since. A task
          added after the baseline was taken has nothing to be measured against and says so
          rather than reading as on time. */}
      {baselined && (
        <span
          style={{
            width: widths.baseFinish,
            flex: 'none',
            textAlign: 'right',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-neutral-700)',
          }}
          title={
            task.baseFinish
              ? `Agreed: ${shortDate(task.baseStart ?? '')} → ${shortDate(task.baseFinish)}${task.baseDays ? `, ${task.baseDays}d` : ''}`
              : 'Added since the plan was baselined'
          }
        >
          {task.baseFinish ? (
            <>
              {shortDate(task.baseFinish)}
              {at && (
                <span style={{ color: slipInk(slip(task.baseFinish, at.endDate)) }}>
                  {' '}
                  {slip(task.baseFinish, at.endDate) === 0 ? '=' : `${slip(task.baseFinish, at.endDate) > 0 ? '+' : ''}${slip(task.baseFinish, at.endDate)}d`}
                </span>
              )}
            </>
          ) : (
            'new'
          )}
        </span>
      )}
      {/* Typed as the work runs. The schedule is never rewritten from them: a plan that
          quietly agreed with reality would have nothing left to report. */}
      {planActuals && (
        <>
          <input
            className="input"
            type="date"
            style={{ ...cell, width: widths.actStart, flex: 'none', fontSize: 12 }}
            value={task.actualStart ?? ''}
            aria-label={`Task ${row.number} actually began`}
            onChange={(e) => set({ actualStart: e.target.value })}
          />
          <input
            className="input"
            type="date"
            style={{ ...cell, width: widths.actFinish, flex: 'none', fontSize: 12 }}
            value={task.actualFinish ?? ''}
            aria-label={`Task ${row.number} actually ended`}
            title={
              task.actualFinish && at
                ? `${slip(at.endDate, task.actualFinish) === 0 ? 'On the day' : `${Math.abs(slip(at.endDate, task.actualFinish))} days ${slip(at.endDate, task.actualFinish) > 0 ? 'later' : 'earlier'}`} than the plan has it`
                : undefined
            }
            onChange={(e) => set({ actualFinish: e.target.value })}
          />
        </>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        aria-label={`Delete task ${row.number}`}
        title={`Delete “${task.name}”`}
        style={{ color: 'var(--color-accent-2-700)', padding: '2px 6px' }}
        onClick={() => {
          if (window.confirm(`Delete “${task.name}”? Any task waiting on it will lose that link.`)) onDelete(task.id);
        }}
      >
        ×
      </button>
    </div>
  );
}
