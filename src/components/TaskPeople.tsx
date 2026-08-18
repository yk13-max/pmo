import { useEffect, useRef, useState } from 'react';
import type { Assignee, Person, Task } from '../types';
import { assigneesOf, taskDayShare } from '../lib/planLoad';

/* Who is on a task.

   One person was a select in the row. Several cannot be: a row is one line tall, and the
   question has two answers per person — who, and how much of their day. So the cell says who
   in as many words as it has room for, and opens a panel with a line each.

   The share is per person and not a split of one number. An engineer on it full time beside
   a reviewer at a fifth of their day is 120% of a day between them, which is a real thing to
   plan; making the two shares add to a hundred would be inventing an arithmetic nobody
   asked for. */

/** Somebody's initials: one letter per word of their name, at most three. */
function initials(name: string): string {
  return (
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word[0].toUpperCase())
      .join('') || '?'
  );
}

/**
 * How the cell reads with the panel shut: the first person in full, and the others by their
 * initials.
 *
 * It used to say "Saranan +1", which answered the wrong question. Whether a task has one
 * person on it or two is rarely the thing being scanned for; *who else is on it* is. Initials
 * fit in a column that has to stay narrow enough for the eight beside it, and a reader who
 * knows the team reads them as names. The full list is on the cell's tooltip and in the panel.
 */
export function peopleLabel(task: Task, people: Person[]): string {
  const on = assigneesOf(task);
  if (!on.length) return '—';
  const name = (a: Assignee) => people.find((p) => p.id === a.personId)?.name ?? a.name ?? '—';
  if (on.length === 1) return name(on[0]);
  /* A plus before each of them, not one plus in front of the lot: "Rachel +E +S" is two
     more people, where "Rachel +E S" could be read as one person called ES. */
  return `${name(on[0])} ${on.slice(1).map((a) => `+${initials(name(a))}`).join(' ')}`;
}

export function TaskPeople({
  task,
  people,
  width,
  label,
  onSave,
}: {
  task: Task;
  people: Person[];
  width: number;
  /** Which task this is, for the panel's heading and the button's label. */
  label: string;
  onSave: (patch: Partial<Task>) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  /* Clicking anywhere else closes it, the way a menu does. Escape too, which is what a
     keyboard reaches for first. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const on = assigneesOf(task);
  /* A task with nobody on it still shows one line, empty and ready — picking a name from it
     is what puts the first person on the task. Asking for a click on "Add someone" before
     the first name could be typed would make the common case the slow one. */
  const lines: Assignee[] = on.length ? on : [{ personId: '', weight: 100 }];
  /* Writing the list writes the old two fields with it, so anything still reading them —
     an older export, a screen not yet moved over — sees the first person on the task
     rather than nothing at all. */
  const write = (rawNext: Assignee[]) => {
    // A line with nobody picked is a line being filled in, not somebody on the task.
    const next = rawNext.filter((a) => a.personId);
    onSave({
      assignees: next,
      ownerId: next[0]?.personId ?? '',
      owner: next[0] ? people.find((p) => p.id === next[0].personId)?.name ?? next[0].name ?? '' : '',
      weight: next[0]?.weight ?? 100,
    });
  };

  const set = (i: number, patch: Partial<Assignee>) => write(lines.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <span ref={box} style={{ width, flex: 'none', position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        className="input plan-people-button"
        aria-expanded={open}
        title={
          on.length
            ? on
                .map((a) => `${people.find((p) => p.id === a.personId)?.name ?? a.name ?? '—'} at ${a.weight}% of their day`)
                .join(', ')
            : 'Nobody on it yet'
        }
        aria-label={`Who is on ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        {peopleLabel(task, people)}
      </button>
      {open && (
        <span className="plan-people-panel">
          <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
            Who is on it
          </span>
          {on.length === 0 && (
            <span style={{ display: 'block', fontSize: 13, color: 'var(--color-neutral-600)', marginBottom: 8 }}>
              Nobody on it yet. It still sits in the plan and still drives the dates; it just books no time.
            </span>
          )}
          {lines.map((a, i) => (
            <span key={`${a.personId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <select
                className="input"
                style={{ flex: 1, minWidth: 0, fontSize: 13, height: 30, padding: '2px 4px' }}
                value={a.personId}
                aria-label="Who"
                onChange={(e) => {
                  const person = people.find((p) => p.id === e.target.value);
                  set(i, { personId: e.target.value, name: person?.name });
                }}
              >
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step={5}
                style={{ width: 62, fontSize: 13, height: 30, padding: '2px 4px', textAlign: 'right' }}
                value={a.weight}
                aria-label="Share of their day, per cent"
                title="Per cent of that person's day, while the task runs"
                onChange={(e) => set(i, { weight: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
              />
              <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>%</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: 'var(--color-accent-2-700)', padding: '2px 6px' }}
                aria-label="Take them off the task"
                onClick={() => write(lines.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                /* Whoever is not on it yet, so adding twice does not offer the same person
                   twice over. A full team already on the task simply stops offering. */
                const spare = people.find((p) => !lines.some((a) => a.personId === p.id));
                write([...lines, { personId: spare?.id ?? '', name: spare?.name, weight: 100 }]);
              }}
            >
              Add someone
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
              {taskDayShare(task)}% of a day between them
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
