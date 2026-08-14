import { useState } from 'react';
import type { Person, ProjectFamily } from '../types';
import { WORKING_DAYS_PER_MONTH } from '../types';
import { leavePct } from '../lib/derive';

/** A part-timer's month as a share of a full-time one. */
function capacityFromDays(days: number): number {
  return Math.max(0, Math.round((days / WORKING_DAYS_PER_MONTH) * 100));
}

function emptyPerson(role: string): Person {
  return {
    id: `person-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    role,
    types: [],
    capacity: 100,
    workingDays: WORKING_DAYS_PER_MONTH,
    overheadPct: 0,
  };
}

export function PersonForm({
  person,
  roles,
  families,
  months,
  monthLabels,
  leaveDays,
  onSave,
  onAddRole,
  onSetLeave,
  onCancel,
  onDelete,
}: {
  person: Person | null;
  roles: string[];
  /** The kinds of work a person can be assigned to. They work on a kind, not on one
      particular way of running it. */
  families: ProjectFamily[];
  months: string[];
  monthLabels: string[];
  /** Days of leave already booked, one per planning month. */
  leaveDays: number[];
  onSave: (person: Person) => void;
  onAddRole: (role: string) => void;
  onSetLeave: (personId: string, month: string, days: number) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Person>(() => person ?? emptyPerson(roles[0] ?? 'Project manager'));
  const [workingDays, setWorkingDays] = useState(String(draft.workingDays));
  const [overhead, setOverhead] = useState(String(draft.overheadPct ?? 0));
  // Held locally so Cancel discards leave edits, like every other field on this form.
  const [leave, setLeave] = useState<number[]>(leaveDays);
  const [newRole, setNewRole] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameError = draft.name.trim() ? '' : 'Give this person a name.';
  const daysNum = Math.min(WORKING_DAYS_PER_MONTH, Math.max(0, Number(workingDays) || 0));
  const overheadNum = Math.min(100, Math.max(0, Number(overhead) || 0));

  const commitRole = () => {
    const clean = newRole.trim();
    if (!clean) return;
    onAddRole(clean);
    setDraft((d) => ({ ...d, role: clean }));
    setNewRole('');
    setAddingRole(false);
  };

  const submit = () => {
    setTouched(true);
    if (nameError) return;
    const days = Math.min(WORKING_DAYS_PER_MONTH, Math.max(0.5, Number(workingDays) || WORKING_DAYS_PER_MONTH));
    if (person) {
      months.forEach((month, i) => {
        if (leave[i] !== leaveDays[i]) onSetLeave(person.id, month, leave[i]);
      });
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      workingDays: days,
      capacity: capacityFromDays(days),
      overheadPct: Math.round(overheadNum),
    });
  };

  return (
    <div>
      <div className="form-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="field">
          <label htmlFor="pn-name">Name</label>
          <input
            id="pn-name"
            className="input"
            value={draft.name}
            aria-invalid={touched && nameError ? true : undefined}
            placeholder="Saranan"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {touched && nameError && <div className="field-error">{nameError}</div>}
        </div>
        <div className="field">
          <label htmlFor="pn-role">Job title</label>
          {addingRole ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                id="pn-role-new"
                className="input"
                autoFocus
                value={newRole}
                placeholder="Quality engineer"
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRole();
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={commitRole}>
                Add
              </button>
            </div>
          ) : (
            <select
              id="pn-role"
              className="input"
              value={draft.role}
              onChange={(e) => {
                if (e.target.value === '__new') setAddingRole(true);
                else setDraft({ ...draft, role: e.target.value });
              }}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="__new">+ Add a new job title…</option>
            </select>
          )}
        </div>
        <div className="field">
          <span style={{ display: 'block', fontSize: 13, marginBottom: 5, color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
            Project types they work on
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {families.map((t) => {
              const on = draft.types.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      types: on ? d.types.filter((x) => x !== t.id) : [...d.types, t.id],
                    }))
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="field-hint">
            {draft.types.length ? 'Only these types.' : 'None selected — treated as available to every type.'}
          </div>
        </div>
        <div className="field">
          <label htmlFor="pn-cap">Working days a month</label>
          <input
            id="pn-cap"
            className="input"
            type="number"
            min={1}
            max={WORKING_DAYS_PER_MONTH}
            step={0.5}
            value={workingDays}
            onChange={(e) => setWorkingDays(e.target.value)}
          />
          <div className="field-hint">
            {WORKING_DAYS_PER_MONTH} is full time. Fewer means part time — {capacityFromDays(Number(workingDays) || 0)}% of
            a full-time month.
          </div>
        </div>
        <div className="field">
          <label htmlFor="pn-overhead">Non-project work (%)</label>
          <input
            id="pn-overhead"
            className="input"
            type="number"
            min={0}
            max={100}
            step={1}
            value={overhead}
            onChange={(e) => setOverhead(e.target.value)}
          />
          <div className="field-hint">
            Meetings, admin, training and line management — the share of their time that never reaches a project. Leaves{' '}
            {(((100 - overheadNum) / 100) * daysNum).toFixed(1)} of their {daysNum.toFixed(1)} days a month to book.
          </div>
        </div>
      </div>

      {person ? (
        <fieldset className="fieldset">
          <legend>Annual leave, in days</legend>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {months.map((month, i) => (
              <div className="field" key={month} style={{ width: 92 }}>
                <label htmlFor={`pn-leave-${month}`}>{monthLabels[i]}</label>
                <input
                  id={`pn-leave-${month}`}
                  className="input"
                  type="number"
                  min={0}
                  max={WORKING_DAYS_PER_MONTH}
                  value={leave[i] || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const days = Math.max(0, Math.min(WORKING_DAYS_PER_MONTH, Math.round(Number(e.target.value) || 0)));
                    setLeave((prev) => prev.map((v, j) => (j === i ? days : v)));
                  }}
                />
                <div className="field-hint">{leave[i] ? `${leavePct(leave[i])}%` : ' '}</div>
              </div>
            ))}
          </div>
          <p className="field-hint">
            Their own leave only — public holidays are set once for everybody on the Annual leave tab. It counts against
            capacity: {WORKING_DAYS_PER_MONTH} working days is a full month, and it sits at the base of their bars in the
            resource graphs.
          </p>
        </fieldset>
      ) : (
        <p className="field-hint" style={{ marginBottom: 'var(--space-6)' }}>
          Annual leave can be booked once this person is saved.
        </p>
      )}

      <div className="drawer-actions">
        {person && onDelete && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginRight: 'auto', color: 'var(--color-accent-2-700)' }}
            onClick={() => onDelete(person.id)}
          >
            Archive person
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={submit}>
          {person ? 'Save changes' : 'Add person'}
        </button>
      </div>
    </div>
  );
}
