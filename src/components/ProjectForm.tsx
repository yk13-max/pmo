import { useMemo, useState } from 'react';
import type { CurrencyCode, Facing, Person, Project, ProjectFamily, ProjectTypeDef, Rag } from '../types';
import {
  BASE_CURRENCY,
  CURRENCIES,
  INVOICE_STAGES,
  MAX_DATE,
  PRIORITY_LABEL,
  PRIORITY_LEVELS,
} from '../types';
import { RAG_LABEL } from '../data/phases';
import { days, hoursToPct, ragColor } from '../lib/derive';
import { addMonths, monthKey, shortDateYear, toISO } from '../lib/dates';
import { AllocationGrid } from './AllocationGrid';
import { DEFAULT_MONTHS } from './WindowControls';
import { useFullPane } from './Drawer';
import { usePortfolio } from '../store/portfolio';
import { schedule, type Scheduled } from '../lib/schedule';
import { Planning } from '../screens/Planning';
import type { PortfolioView } from '../lib/derive';

type Draft = Omit<Project, 'phase' | 'pct' | 'budget' | 'actual' | 'value' | 'billed' | 'load'> & {
  phase: number;
  pct: string;
  budget: string;
  actual: string;
  value: string;
  billed: string;
  load: string;
};

function emptyProject(pmId: string, type: ProjectTypeDef | undefined): Project {
  const today = new Date();
  return {
    id: `project-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    client: '',
    type: type?.id ?? '',
    facing: 'C',
    phase: 0,
    pct: 0,
    rag: 'G',
    pmId,
    budget: 0,
    actual: 0,
    value: 0,
    billed: 0,
    load: 0,
    startDate: toISO(today),
    endDate: toISO(addMonths(today, 9)),
    milestone: type?.milestones[0] ?? '',
    milestoneDate: toISO(addMonths(today, 1)),
    priority: 3,
    currency: 'GBP',
    sterile: false,
    phaseDates: [],
    invoiceDates: [],
  };
}

function toDraft(p: Project): Draft {
  return {
    ...p,
    pct: String(p.pct),
    budget: String(p.budget),
    actual: String(p.actual),
    value: String(p.value),
    billed: String(p.billed),
    load: String(p.load),
  };
}

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/* Money, which is held in thousands. Whole thousands are what most of a portfolio is written
   in, but not all of it — a £600 study is 0.6, and rounding that to the nearest thousand
   would either lose it or double it. Kept to three places, which is the pound. */
const cash = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 0;
};

export function ProjectForm({
  project,
  view,
  people,
  months,
  monthLabels,
  threshold,
  projectTypes,
  families,
  allocations,
  otherLoads,
  onSave,
  onCancel,
  onDelete,
}: {
  project: Project | null;
  /* Only for the plan at the foot of a full page, which is the Planning screen itself. */
  view: PortfolioView;
  people: Person[];
  months: string[];
  monthLabels: string[];
  threshold: number;
  projectTypes: ProjectTypeDef[];
  families: ProjectFamily[];
  /** `${personId}|${month}` → % for this project. */
  allocations: Record<string, number>;
  /** Each person's load from every other project, for the over-booking warning. */
  otherLoads: Record<string, number[]>;
  onSave: (project: Project, allocations?: Record<string, number>) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) {
  const managers = useMemo(() => people.filter((p) => p.role === 'Project manager'), [people]);
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(project ?? emptyProject((managers[0] ?? people[0])?.id ?? '', projectTypes[0])),
  );
  const [alloc, setAlloc] = useState<Record<string, number>>(allocations);
  const [touched, setTouched] = useState(false);
  /* Which stretch of the project's months the booking grid shows. It is only a view of the
     grid: every month is still held in `alloc` and still saved, whether on show or not.
     Nought months means all of them.

     It opens on this month and the five after it — the half year anyone editing a booking is
     almost always editing — falling back to the whole run when the project is shorter than
     that, and to either end of it for work that is entirely behind or entirely ahead. */
  const [bookCount, setBookCount] = useState(() => (months.length > DEFAULT_MONTHS ? DEFAULT_MONTHS : 0));
  const [bookFrom, setBookFrom] = useState(() => {
    const thisMonth = monthKey(new Date());
    const found = months.indexOf(thisMonth);
    const wanted = found >= 0 ? found : thisMonth > (months[months.length - 1] ?? '') ? months.length : 0;
    return Math.max(0, Math.min(wanted, months.length - DEFAULT_MONTHS));
  });
  const { portfolio } = usePortfolio();
  const fullPane = useFullPane();
  /* The plan at the foot of a full page saves the moment it is touched — including its two
     switches, which are the project's own fields. So those two are read from the store
     rather than from the draft this form opened with, or ticking one and then saving the
     form would put it straight back. */
  const live = project ? portfolio.projects.find((p) => p.id === project.id) : undefined;
  const usesPlan = live?.usesPlan ?? draft.usesPlan;
  const plansResource = live?.plansResource ?? draft.plansResource;

  const start = Math.min(bookFrom, Math.max(0, months.length - 1));
  const shownMonths = months.slice(start, bookCount > 0 ? start + bookCount : undefined);
  const shownLabels = monthLabels.slice(start, bookCount > 0 ? start + bookCount : undefined);
  const shownLoads = useMemo(() => {
    const out: Record<string, number[]> = {};
    Object.entries(otherLoads).forEach(([id, row]) => {
      out[id] = row.slice(start, bookCount > 0 ? start + bookCount : undefined);
    });
    return out;
  }, [otherLoads, start, bookCount]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Mirrors the derived figure so it updates as bookings are edited. Bookings are hours.
  const peakHours = Math.max(
    0,
    ...months.map((m) => people.reduce((n, person) => n + (alloc[`${person.id}|${m}`] ?? 0), 0)),
  );
  const derivedLoad = Math.round(hoursToPct(peakHours));

  const typeDef = projectTypes.find((t) => t.id === draft.type) ?? projectTypes[0];
  const phases = typeDef?.phases ?? [];
  /* A person with no types listed is treated as available to everything; anyone with an
     explicit list must include this project's kind of work to be bookable. People are
     assigned to the kind, not to the way a particular project of it is run, so the check is
     against the family the chosen category sits under. */
  const draftFamily = projectTypes.find((t) => t.id === draft.type)?.family ?? '';
  /** The ways this kind of work is run — what the delivery type is chosen from. */
  const ofFamily = projectTypes.filter((t) => t.family === draftFamily);
  const ineligible = new Set(
    people.filter((p) => p.types.length > 0 && !p.types.includes(draftFamily)).map((p) => p.id),
  );
  const strandedBookings = people.filter(
    (p) => ineligible.has(p.id) && months.some((m) => (alloc[`${p.id}|${m}`] ?? 0) > 0),
  );
  const internal = draft.facing === 'I';

  const phaseDates = phases.map((_, i) => draft.phaseDates[i] ?? '');
  /* The plan is read live so the gates and the milestone list always show what the Gantt
     currently says, rather than whatever it said when the form was opened. */
  const planned = schedule(
    portfolio.tasks.filter((t) => t.projectId === draft.id),
    draft.startDate,
  );
  const planPhaseEnds: string[] = [];
  const planTasks = portfolio.tasks
    .filter((t) => t.projectId === draft.id)
    .map((t) => ({ task: t, at: planned.byId.get(t.id) }))
    .filter((x) => x.at)
    .sort((a, b) => (a.at as Scheduled).earlyFinish - (b.at as Scheduled).earlyFinish);
  planTasks.forEach(({ task, at }) => {
    const end = (at as Scheduled).endDate;
    if (!planPhaseEnds[task.phase] || end > planPhaseEnds[task.phase]) planPhaseEnds[task.phase] = end;
  });
  const canMirror = Boolean(usesPlan) && planTasks.length > 0;
  const mirroring = canMirror && Boolean(draft.mirrorPhases);
  /* What each gate reads as on screen: the plan's dates while mirroring, otherwise typed. */
  const gates = phases.map((_, i) => (mirroring ? planPhaseEnds[i] || phaseDates[i] : phaseDates[i]));
  /* The last phase completing is the project finishing, so once that gate is filled in it
     is the end date, here and on every screen. The typed date is left alone and comes back
     if the gate is cleared. */
  const lastGate = phases.length ? gates[phases.length - 1] : '';
  const effectiveEnd = lastGate || draft.endDate;

  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Give the project a name.';
  if (!draft.client.trim())
    errors.client = internal ? 'Name the function that owns the work.' : 'Name the customer.';
  if (!draft.pmId) errors.pmId = 'Pick a project manager.';
  if (cash(draft.budget) <= 0) errors.budget = 'A budget above zero is needed to track spend.';
  if (effectiveEnd <= draft.startDate)
    errors.endDate = lastGate
      ? 'The last phase completes on or before the start date.'
      : 'The end date must come after the start date.';
  if (!internal && cash(draft.billed) > cash(draft.value)) errors.billed = 'Invoiced cannot exceed the agreed value.';
  if (draft.milestoneDate && effectiveEnd && draft.milestoneDate > effectiveEnd)
    errors.milestoneDate = `The next thing due falls after the project ends (${effectiveEnd}). Move it earlier, or push the end date out.`;
  if (draft.milestoneDate && draft.startDate && draft.milestoneDate < draft.startDate)
    errors.milestoneDate = 'The next thing due falls before the project starts.';
  if (strandedBookings.length)
    errors.types = `${strandedBookings.map((p) => p.name).join(', ')} ${strandedBookings.length === 1 ? 'is' : 'are'} booked here but ${strandedBookings.length === 1 ? 'does' : 'do'} not work on ${families.find((f) => f.id === draftFamily)?.label ?? draft.type}. Clear those bookings or add the type to them.`;

  /* Bookings come from the plan while this is on, so the grid below reports rather than
     accepts. The figures in it are the plan's own — every screen reads the same set. */
  const planBooked = Boolean(usesPlan && plansResource);

  const invoiceDates = INVOICE_STAGES.map((_, i) => draft.invoiceDates[i] ?? '');
  if (!internal && invoiceDates.some((d) => !d)) errors.invoiceDates = 'Each invoice stage needs a date.';
  if (!internal && invoiceDates.some((d) => d && effectiveEnd && d > effectiveEnd))
    errors.invoiceDates = 'An invoice is dated after the project ends.';

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSave(
      {
        ...draft,
        name: draft.name.trim(),
        client: draft.client.trim(),
        milestone: draft.milestone.trim() || typeDef?.milestones[draft.phase] || '',
        // Owned by the plan below, and already saved by it. See `live` above.
        usesPlan,
        plansResource,
        pct: Math.min(100, num(draft.pct)),
        budget: cash(draft.budget),
        actual: cash(draft.actual),
        value: internal ? 0 : cash(draft.value),
        billed: internal ? 0 : cash(draft.billed),
        load: derivedLoad,
        phaseDates,
        invoiceDates: internal ? [] : invoiceDates,
      },
      /* A plan-booked project's hours come from its tasks, so there is nothing here to
         save. Sending the grid back would overwrite what was typed by hand with a copy of
         the plan, and that is exactly what should still be waiting if the switch goes off
         again. */
      planBooked ? undefined : alloc,
    );
  };

  const err = (key: string) => (touched && errors[key] ? <div className="field-error">{errors[key]}</div> : null);
  const invalid = (key: string) => (touched && errors[key] ? true : undefined);

  return (
    <div className="project-form">
      {/* Two columns on a full page, one otherwise — the wrapper is `display: contents`
          until there is width for it, so off a full page these are the same six sections in
          the same order they have always been in. Each column is a run of the form: what the
          project is and where it has got to on the left, what it costs and when it is due on
          the right. Bookings sit below both, where they have the width to be read. */}
      <div className="form-columns">
      <div className="form-col">
      <fieldset className="fieldset">
        <legend>What it is</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-name">Project name</label>
            <input
              id="pf-name"
              className="input"
              value={draft.name}
              aria-invalid={invalid('name')}
              placeholder="Rolex"
              onChange={(e) => set('name', e.target.value)}
            />
            {err('name')}
          </div>
          <div className="field">
            {/* One label for both kinds of work: a customer's name on customer work, the
                function that owns it on internal. Which of the two applies is the answer to
                "Who it is for", two fields along. */}
            <label htmlFor="pf-client">Owner (Customer / Function)</label>
            <input
              id="pf-client"
              className="input"
              value={draft.client}
              aria-invalid={invalid('client')}
              placeholder={internal ? 'Quality' : 'Aveltis Bio'}
              onChange={(e) => set('client', e.target.value)}
            />
            {err('client')}
          </div>
          {/* The two levels, in the order they are decided: what kind of work this is, then
              which way it is being run. Both are one field each rather than one field of
              grouped options, because the first decides who can be booked and how the
              portfolio reads it, and the second decides the phases — different questions,
              and the second is not worth reading past until the first is answered. */}
          <div className="field">
            <label htmlFor="pf-family">Project type</label>
            <select
              id="pf-family"
              className="input"
              value={draftFamily}
              onChange={(e) => {
                /* The categories belong to one family, so changing family takes the first
                   way that one is run — and the phase and milestone come with it, since
                   the new category has phases of its own. */
                const next = projectTypes.find((t) => t.family === e.target.value);
                if (!next) return;
                setDraft((d) => {
                  const phase = Math.min(d.phase, Math.max(0, next.phases.length - 1));
                  return { ...d, type: next.id, phase, milestone: next.milestones[phase] ?? d.milestone };
                });
              }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="field-hint">The kind of work. Sets who can be booked on it.</div>
          </div>
          <div className="field">
            <label htmlFor="pf-type">Delivery type</label>
            <select
              id="pf-type"
              className="input"
              value={draft.type}
              onChange={(e) => {
                const next = projectTypes.find((t) => t.id === e.target.value);
                if (!next) return;
                setDraft((d) => {
                  const phase = Math.min(d.phase, Math.max(0, next.phases.length - 1));
                  return { ...d, type: next.id, phase, milestone: next.milestones[phase] ?? d.milestone };
                });
              }}
            >
              {projectTypes
                .filter((t) => t.family === draftFamily)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </select>
            <div className="field-hint">
              {ofFamily.length > 1
                ? 'The way it is run, and the phases it follows.'
                : `The only way ${families.find((f) => f.id === draftFamily)?.label ?? 'this'} work is run. Add another on the Data screen.`}
            </div>
          </div>
          <div className="field">
            <label htmlFor="pf-facing">Who it is for</label>
            <select
              id="pf-facing"
              className="input"
              value={draft.facing}
              onChange={(e) => set('facing', e.target.value as Facing)}
            >
              <option value="C">Customer</option>
              <option value="I">Internal</option>
            </select>
            <div className="field-hint">Internal work draws on a budget pool and carries no invoice side.</div>
          </div>
          <div className="field">
            <label htmlFor="pf-pm">Project manager</label>
            <select
              id="pf-pm"
              className="input"
              value={draft.pmId}
              aria-invalid={invalid('pmId')}
              onChange={(e) => set('pmId', e.target.value)}
            >
              <option value="">Unassigned</option>
              {(managers.length ? managers : people).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {err('pmId')}
          </div>
          <div className="field">
            <label htmlFor="pf-priority">Priority</label>
            <select
              id="pf-priority"
              className="input"
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
            >
              {PRIORITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} — {PRIORITY_LABEL[level]}
                </option>
              ))}
            </select>
            <div className="field-hint">1 is highest. Drives ranking and the callouts on the portfolio chart.</div>
          </div>
          <div className="field">
            <label htmlFor="pf-rag">Status</label>
            {/* The field carries the colour of the status it is set to — the same three the
                dots use everywhere else — as an edge and a wash behind it rather than as
                coloured text, which at these values would be the one thing on the form that
                could not be read. */}
            <select
              id="pf-rag"
              className="input"
              value={draft.rag}
              style={{
                borderLeft: `5px solid ${ragColor(draft.rag)}`,
                background: `color-mix(in srgb, ${ragColor(draft.rag)} 12%, var(--color-surface))`,
              }}
              onChange={(e) => set('rag', e.target.value as Rag)}
            >
              {(Object.keys(RAG_LABEL) as Rag[]).map((r) => (
                <option
                  key={r}
                  value={r}
                  style={{
                    background: `color-mix(in srgb, ${ragColor(r)} 14%, var(--color-bg))`,
                    color: 'var(--color-text)',
                  }}
                >
                  {RAG_LABEL[r]}
                </option>
              ))}
            </select>
            <div className="field-hint">Set by the project manager, not calculated.</div>
          </div>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Where it has got to</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-phase">Current phase</label>
            <select
              id="pf-phase"
              className="input"
              value={draft.phase}
              onChange={(e) => {
                const phase = Number(e.target.value);
                setDraft((d) => ({ ...d, phase, milestone: typeDef?.milestones[phase] ?? d.milestone }));
              }}
            >
              {phases.map((p: string, i: number) => (
                <option key={p} value={i}>
                  {i + 1}. {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-pct">% through current phase</label>
            <input
              id="pf-pct"
              className="input"
              type="number"
              min={0}
              max={100}
              value={draft.pct}
              onChange={(e) => set('pct', e.target.value)}
            />
            <div className="field-hint">Progress through the current phase</div>
          </div>
          <div className="field">
            <label htmlFor="pf-start">Started</label>
            <input id="pf-start" className="input" type="date" max={MAX_DATE} value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pf-end">Finishes</label>
            <input
              id="pf-end"
              className="input"
              type="date"
              max={MAX_DATE}
              /* A date on the last phase is the project finishing, so it takes this field
                 over rather than sitting beside it disagreeing. */
              disabled={Boolean(lastGate)}
              value={effectiveEnd}
              aria-invalid={invalid('endDate')}
              onChange={(e) => set('endDate', e.target.value)}
            />
            {err('endDate')}
            {lastGate && (
              <div className="field-hint">
                From the last phase date below. What was typed here is kept, and comes back if that is cleared.
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="pf-ms">Next thing due</label>
            {/* A planned project can point at a task rather than retyping its name and
                date. Custom comes first, because anything not in the plan is still a
                perfectly good answer — a board date, an audit, a customer visit. */}
            {canMirror && (
              <select
                id="pf-ms-pick"
                className="input"
                aria-label="Take the next thing due from the plan"
                style={{ marginBottom: 6 }}
                value={planTasks.find((x) => x.task.name === draft.milestone)?.task.id ?? ''}
                onChange={(e) => {
                  const picked = planTasks.find((x) => x.task.id === e.target.value);
                  if (!picked) return;
                  // Taking the task takes its date too, which is the point of picking one.
                  setDraft((d) => ({
                    ...d,
                    milestone: picked.task.name,
                    milestoneDate: (picked.at as Scheduled).endDate,
                  }));
                }}
              >
                <option value="">Custom — type it below</option>
                {planTasks.map(({ task, at }) => (
                  <option key={task.id} value={task.id}>
                    {task.name} · {shortDateYear((at as Scheduled).endDate)}
                  </option>
                ))}
              </select>
            )}
            <input
              id="pf-ms"
              className="input"
              value={draft.milestone}
              placeholder={typeDef?.milestones[draft.phase] ?? ''}
              onChange={(e) => set('milestone', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-msdate">Due on</label>
            <input
              id="pf-msdate"
              className="input"
              type="date"
              max={effectiveEnd || MAX_DATE}
              value={draft.milestoneDate}
              aria-invalid={invalid('milestoneDate')}
              onChange={(e) => set('milestoneDate', e.target.value)}
            />
            {err('milestoneDate')}
            {touched && errors.milestoneDate && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ paddingInline: 0 }}
                onClick={() => set('milestoneDate', effectiveEnd)}
              >
                Set it to the end date
              </button>
            )}
          </div>
        </div>
      </fieldset>
      </div>

      <div className="form-col">
      <fieldset className="fieldset">
        <legend>Money, in thousands</legend>
        <div className="form-grid">
          {!internal && (
            <div className="field">
              <label htmlFor="pf-currency">Invoice the client in</label>
              <select
                id="pf-currency"
                className="input"
                value={draft.currency}
                onChange={(e) => set('currency', e.target.value as CurrencyCode)}
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                  <option key={code} value={code}>
                    {CURRENCIES[code].symbol} {code} — {CURRENCIES[code].label}
                  </option>
                ))}
              </select>
              <div className="field-hint">
                Applies to the agreed value and invoices. Budget and spend stay in {CURRENCIES[BASE_CURRENCY].symbol}
                {BASE_CURRENCY}.
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="pf-budget">Approved budget ({CURRENCIES[BASE_CURRENCY].symbol})</label>
            <input
              id="pf-budget"
              className="input"
              type="number"
              min={0}
              /* Any is what lets a sum under a thousand be typed: without it a browser
                 holds the field to whole numbers and refuses 0.6 outright. */
              step="any"
              value={draft.budget}
              aria-invalid={invalid('budget')}
              onChange={(e) => set('budget', e.target.value)}
            />
            {err('budget')}
            <div className="field-hint">In thousands, so a £600 study is 0.6.</div>
          </div>
          <div className="field">
            <label htmlFor="pf-actual">Spent so far ({CURRENCIES[BASE_CURRENCY].symbol})</label>
            <input id="pf-actual" className="input" type="number" min={0} step="any" value={draft.actual} onChange={(e) => set('actual', e.target.value)} />
          </div>
          {!internal && (
            <>
              <div className="field">
                <label htmlFor="pf-value">Agreed with the client ({CURRENCIES[draft.currency].symbol})</label>
                <input id="pf-value" className="input" type="number" min={0} step="any" value={draft.value} onChange={(e) => set('value', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="pf-billed">Invoiced so far ({CURRENCIES[draft.currency].symbol})</label>
                <input
                  id="pf-billed"
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  value={draft.billed}
                  aria-invalid={invalid('billed')}
                  onChange={(e) => set('billed', e.target.value)}
                />
                {err('billed')}
              </div>
            </>
          )}
          <div className="field">
            <label>Team draw</label>
            <div
              style={{
                minHeight: 36,
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              {days(peakHours)}
            </div>
            <div className="field-hint">
              Calculated from the bookings below — the total resource this project draws across the whole team in its
              busiest month. Not typed in.
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Phase dates</legend>
        {/* Only a project that is planned in the Gantt has anything to mirror, so the tick
            is offered but not usable until it is. */}
        <label
          title={
            canMirror
              ? 'Each gate becomes the last day of work in that phase of the plan.'
              : 'Tick “Plan this project here” on the Planning screen, and add some tasks, before these can be mirrored.'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            marginBottom: 'var(--space-3)',
            cursor: canMirror ? 'pointer' : 'not-allowed',
            color: canMirror ? 'var(--color-text)' : 'var(--color-neutral-500)',
          }}
        >
          <input
            type="checkbox"
            disabled={!canMirror}
            checked={mirroring}
            onChange={(e) => set('mirrorPhases', e.target.checked)}
            style={{ accentColor: 'var(--color-accent)', width: 15, height: 15 }}
          />
          Mirror the Gantt chart phase dates
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {phases.map((phase: string, i: number) => (
            <div className="field" key={phase} style={{ width: 180 }}>
              <label htmlFor={`pf-phase-${i}`}>
                {i + 1}. {phase}
              </label>
              <input
                id={`pf-phase-${i}`}
                className="input"
                type="date"
                max={MAX_DATE}
                disabled={mirroring}
                value={gates[i]}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = phases.map((_: string, j: number) => d.phaseDates[j] ?? '');
                    next[i] = e.target.value;
                    return { ...d, phaseDates: next };
                  })
                }
              />
            </div>
          ))}
        </div>
        <p className="field-hint">
          {mirroring
            ? 'Taken from the plan: each gate is the last day of work in that phase. What was typed here is kept, and comes back if this is unticked.'
            : 'When each phase is planned to complete. Shown on the project detail stepper.'}{' '}
          A date on the last phase is when the project finishes, and stands in for the end date above.
        </p>
      </fieldset>

      {!internal && (
        <fieldset className="fieldset">
          <legend>Invoice dates</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {INVOICE_STAGES.map((label, i) => (
              <div className="field" key={label} style={{ width: 190 }}>
                <label htmlFor={`pf-inv-${i}`}>{label}</label>
                <input
                  id={`pf-inv-${i}`}
                  className="input"
                  type="date"
                  max={MAX_DATE}
                  value={invoiceDates[i]}
                  aria-invalid={invalid('invoiceDates')}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = INVOICE_STAGES.map((_, j) => d.invoiceDates[j] ?? '');
                      next[i] = e.target.value;
                      return { ...d, invoiceDates: next };
                    })
                  }
                />
              </div>
            ))}
          </div>
          {err('invoiceDates')}
          <p className="field-hint">Required — when each invoice is expected to be raised.</p>
        </fieldset>
      )}
      </div>
      </div>

      <fieldset className="fieldset">
        <legend>Who is working on it</legend>
        {touched && errors.types && <div className="field-error" style={{ marginBottom: 'var(--space-2)' }}>{errors.types}</div>}
        {planBooked && (
          <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
            Booked from this project&rsquo;s plan — its tasks, their owners and how much of a day each takes. The
            figures below are what that comes to per person per month; change them on the Planning screen, or untick
            &ldquo;Book people from this plan&rdquo; there to go back to booking by hand.
          </p>
        )}
        {/* The same two controls as the Resourcing screen, over this project's own months:
            a long project is two dozen columns wide, and most edits are to one stretch of
            it. Only what is on show changes — every month keeps its bookings either way. */}
        <div
          className="control-row"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3) var(--space-4)', minWidth: 0, marginBottom: 'var(--space-3)' }}
        >
          <div className="field" style={{ margin: 0, width: 150 }}>
            <label htmlFor="pf-book-from">Plan from</label>
            <select
              id="pf-book-from"
              className="input"
              value={months[start] ?? ''}
              onChange={(e) => setBookFrom(Math.max(0, months.indexOf(e.target.value)))}
            >
              {months.map((m, i) => (
                <option key={m} value={m}>
                  {monthLabels[i]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, width: 150 }}>
            <label htmlFor="pf-book-for">For</label>
            <select
              id="pf-book-for"
              className="input"
              value={bookCount}
              onChange={(e) => setBookCount(Number(e.target.value))}
            >
              {[...new Set([3, 6, 12, 18, 24].filter((n) => n < months.length))].map((n) => (
                <option key={n} value={n}>
                  {n} months
                </option>
              ))}
              {/* Nought is a length, like the rest: everything from the month chosen to the
                  end of the project. */}
              <option value={0}>Every month to the end</option>
            </select>
          </div>
          {shownMonths.length < months.length && (
            <p className="field-hint" style={{ margin: '0 0 8px' }}>
              {months.length - shownMonths.length} of the project&rsquo;s months are out of view. Anything booked in
              them is kept, and counts in the totals.
            </p>
          )}
        </div>
        <AllocationGrid
          readOnly={planBooked}
          people={people}
          months={shownMonths}
          monthLabels={shownLabels}
          /* Each person's total is of the whole project, not of the months on show, so
             sliding the view does not move a number called Total. */
          totalMonths={months}
          value={alloc}
          threshold={threshold}
          otherLoads={shownLoads}
          ineligible={ineligible}
          typeLabel={families.find((f) => f.id === draftFamily)?.label ?? draft.type}
          onChange={(personId, month, pct) =>
            setAlloc((prev) => {
              const next = { ...prev };
              if (pct > 0) next[`${personId}|${month}`] = pct;
              else delete next[`${personId}|${month}`];
              return next;
            })
          }
        />
      </fieldset>

      {/* THE PLAN
          Only on a full page, and only for a project that exists — a Gantt needs the width
          of a screen to be worth reading, and tasks need something to be attached to. It is
          the Planning screen itself rather than a copy of it: the same grid, the same chart,
          the same switches, the same PDF. The only thing missing is the project picker, the
          pane being open on one project already.

          What it saves, it saves as it goes, the way it does on its own screen. So the gates
          above fill in from it as tasks move, and the bookings grid turns to reading when
          "Book people from this plan" goes on, without this form having been saved. */}
      {fullPane && project && (
        <fieldset className="fieldset plan-fieldset">
          <legend>The plan</legend>
          <Planning view={view} projectId={project.id} onSelectProject={() => {}} embedded />
        </fieldset>
      )}

      <div className="drawer-actions">
        {project && onDelete && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginRight: 'auto', color: 'var(--color-accent-2-700)' }}
            onClick={() => onDelete(project.id)}
          >
            Archive project
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={submit}>
          {project ? 'Save changes' : 'Add project'}
        </button>
      </div>
    </div>
  );
}
