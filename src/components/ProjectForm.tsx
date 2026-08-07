import { useMemo, useState } from 'react';
import type { Facing, Person, Project, ProjectTypeDef, Rag } from '../types';
import { MAX_DATE, PRIORITY_LABEL, PRIORITY_LEVELS } from '../types';
import { RAG_LABEL } from '../data/phases';
import { addMonths, toISO } from '../lib/dates';
import { AllocationGrid } from './AllocationGrid';

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

export function ProjectForm({
  project,
  people,
  months,
  monthLabels,
  threshold,
  projectTypes,
  allocations,
  otherLoads,
  onSave,
  onCancel,
  onDelete,
}: {
  project: Project | null;
  people: Person[];
  months: string[];
  monthLabels: string[];
  threshold: number;
  projectTypes: ProjectTypeDef[];
  /** `${personId}|${month}` → % for this project. */
  allocations: Record<string, number>;
  /** Each person's load from every other project, for the over-booking warning. */
  otherLoads: Record<string, number[]>;
  onSave: (project: Project, allocations: Record<string, number>) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) {
  const managers = useMemo(() => people.filter((p) => p.role === 'Project manager'), [people]);
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(project ?? emptyProject((managers[0] ?? people[0])?.id ?? '', projectTypes[0])),
  );
  const [alloc, setAlloc] = useState<Record<string, number>>(allocations);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Mirrors the derived figure so it updates as bookings are edited.
  const derivedLoad = Math.max(
    0,
    ...months.map((m) => people.reduce((n, person) => n + (alloc[`${person.id}|${m}`] ?? 0), 0)),
  );

  const typeDef = projectTypes.find((t) => t.id === draft.type) ?? projectTypes[0];
  const phases = typeDef?.phases ?? [];
  const internal = draft.facing === 'I';
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Give the project a name.';
  if (!draft.client.trim()) errors.client = internal ? 'Name the owning function.' : 'Name the client.';
  if (!draft.pmId) errors.pmId = 'Pick a project manager.';
  if (num(draft.budget) <= 0) errors.budget = 'A budget above zero is needed to track spend.';
  if (draft.endDate <= draft.startDate) errors.endDate = 'The end date must come after the start date.';
  if (!internal && num(draft.billed) > num(draft.value)) errors.billed = 'Invoiced cannot exceed the agreed value.';

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSave(
      {
        ...draft,
        name: draft.name.trim(),
        client: draft.client.trim(),
        milestone: draft.milestone.trim() || typeDef?.milestones[draft.phase] || '',
        pct: Math.min(100, num(draft.pct)),
        budget: num(draft.budget),
        actual: num(draft.actual),
        value: internal ? 0 : num(draft.value),
        billed: internal ? 0 : num(draft.billed),
        load: derivedLoad,
      },
      alloc,
    );
  };

  const err = (key: string) => (touched && errors[key] ? <div className="field-error">{errors[key]}</div> : null);
  const invalid = (key: string) => (touched && errors[key] ? true : undefined);

  return (
    <div>
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
            <label htmlFor="pf-client">{internal ? 'Owning function' : 'Client'}</label>
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
              {projectTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-facing">Who it is for</label>
            <select
              id="pf-facing"
              className="input"
              value={draft.facing}
              onChange={(e) => set('facing', e.target.value as Facing)}
            >
              <option value="C">Customer-facing</option>
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
            <select id="pf-rag" className="input" value={draft.rag} onChange={(e) => set('rag', e.target.value as Rag)}>
              {(Object.keys(RAG_LABEL) as Rag[]).map((r) => (
                <option key={r} value={r}>
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
            <label htmlFor="pf-pct">Plan finished (%)</label>
            <input
              id="pf-pct"
              className="input"
              type="number"
              min={0}
              max={100}
              value={draft.pct}
              onChange={(e) => set('pct', e.target.value)}
            />
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
              value={draft.endDate}
              aria-invalid={invalid('endDate')}
              onChange={(e) => set('endDate', e.target.value)}
            />
            {err('endDate')}
          </div>
          <div className="field">
            <label htmlFor="pf-ms">Next thing due</label>
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
            <input id="pf-msdate" className="input" type="date" max={MAX_DATE} value={draft.milestoneDate} onChange={(e) => set('milestoneDate', e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Money, in £ thousands</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-budget">Approved budget</label>
            <input
              id="pf-budget"
              className="input"
              type="number"
              min={0}
              value={draft.budget}
              aria-invalid={invalid('budget')}
              onChange={(e) => set('budget', e.target.value)}
            />
            {err('budget')}
          </div>
          <div className="field">
            <label htmlFor="pf-actual">Spent so far</label>
            <input id="pf-actual" className="input" type="number" min={0} value={draft.actual} onChange={(e) => set('actual', e.target.value)} />
          </div>
          {!internal && (
            <>
              <div className="field">
                <label htmlFor="pf-value">Agreed with the client</label>
                <input id="pf-value" className="input" type="number" min={0} value={draft.value} onChange={(e) => set('value', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="pf-billed">Invoiced so far</label>
                <input
                  id="pf-billed"
                  className="input"
                  type="number"
                  min={0}
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
              {derivedLoad}% · {(derivedLoad / 100).toFixed(2)} people
            </div>
            <div className="field-hint">
              Calculated from the bookings below — the total resource this project draws across the whole team in its
              busiest month. Not typed in.
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Who is working on it</legend>
        <AllocationGrid
          people={people}
          months={months}
          monthLabels={monthLabels}
          value={alloc}
          threshold={threshold}
          otherLoads={otherLoads}
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

      <div className="drawer-actions">
        {project && onDelete && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginRight: 'auto', color: 'var(--color-accent-2-700)' }}
            onClick={() => onDelete(project.id)}
          >
            Delete project
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
