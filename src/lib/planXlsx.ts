import * as XLSX from 'xlsx';
import type { ConstraintType, Person, Project, Task } from '../types';
import { CONSTRAINTS } from '../types';
import { depsToText, parseDeps, schedule } from './schedule';
import { fileStamp } from './dates';

/* The plan, out to a spreadsheet and back.

   A plan gets built in a room, and the room is not always in front of this screen. Somebody
   wants to work through it on a train, or send it to a contractor who has never heard of the
   tracker, or sort it four ways in a tool they already know. So the whole task list goes out
   as a workbook and comes back in.

   Two columns are the contract. `Id` is how a row finds the task it came from, so editing a
   name offline changes that task rather than adding a second one with the new name; leave it
   blank and the row is a new task. `Phase` is which of the project's phases the task sits
   under, by name, because a number would be meaningless in a sheet somebody has re-sorted.

   Start and Finish go out but do not come back. They are what the schedule works out from
   the days, the rules and the links — writing them in a sheet would be writing down an
   answer, and the answer is recomputed the moment anything it depends on changes. What comes
   back is what a planner actually decides: the name, the owner, how long, how much of a day,
   the rule and its date, what it waits on, and how far through it is. */

/** The sheet's columns, in the order they are written. */
const HEAD = [
  'Id',
  '#',
  'Phase',
  'Task',
  'Who',
  'Days',
  '% of day',
  'Rule',
  'Rule date',
  'Predecessors',
  'Start (calculated)',
  'Finish (calculated)',
  '% done',
  'Actual start',
  'Actual finish',
] as const;

/** What comes back from a sheet, before it is turned into tasks. */
export interface PlanImport {
  updated: number;
  added: number;
  /** Rows that could not be read, and why. Nothing is written when this has anything in it. */
  problems: string[];
  tasks: Task[];
}

/** The plan as a workbook, ready to be downloaded. */
export function planToXlsx(project: Project, phases: string[], tasks: Task[], people: Person[]): Blob {
  const plan = schedule(tasks, project.startDate);
  /* Numbered as the screen numbers them — down the phases in order — so a printed sheet and
     the screen can be read side by side, and the predecessor column means the same thing. */
  const ordered: Task[] = [];
  phases.forEach((_, i) => tasks.filter((t) => t.phase === i).forEach((t) => ordered.push(t)));
  const numberOf = new Map(ordered.map((t, i) => [t.id, i + 1]));

  const rows = ordered.map((t) => {
    const at = plan.byId.get(t.id);
    return {
      Id: t.id,
      '#': numberOf.get(t.id) ?? '',
      Phase: phases[t.phase] ?? '',
      Task: t.name,
      Who: people.find((p) => p.id === t.ownerId)?.name ?? t.owner ?? '',
      Days: t.days,
      '% of day': t.weight ?? 100,
      Rule: t.constraint,
      'Rule date': t.constraintDate ?? '',
      Predecessors: depsToText(t.deps, (id) => numberOf.get(id) ?? null),
      'Start (calculated)': at?.startDate ?? '',
      'Finish (calculated)': at?.endDate ?? '',
      '% done': t.done ?? 0,
      'Actual start': t.actualStart ?? '',
      'Actual finish': t.actualFinish ?? '',
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...HEAD] });
  /* Wide enough to read without dragging anything on the way in. */
  sheet['!cols'] = [
    { wch: 14 }, { wch: 4 }, { wch: 26 }, { wch: 38 }, { wch: 16 }, { wch: 6 }, { wch: 9 },
    { wch: 7 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 13 }, { wch: 13 },
  ];
  const book = XLSX.utils.book_new();
  /* Named for the project, so three of these open at once are told apart by their tabs. A
     sheet name may not carry \\ / ? * [ ] and may not run past 31 characters. */
  XLSX.utils.book_append_sheet(book, sheet, project.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Plan');
  const out = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheetml' });
}

/** What the downloaded file is called. */
export function planXlsxName(project: Project): string {
  const safe = project.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'plan';
  return `pmo-plan-${safe}-${fileStamp()}.xlsx`;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (v: unknown, fallback: number) => {
  const n = Number(String(v ?? '').replace(/[%\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

/** A date cell, whether the sheet holds it as text or as one of Excel's own serial numbers. */
function dateCell(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return '';
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

/**
 * Read a workbook back into this project's tasks.
 *
 * Rows with an id update the task they name; rows without one are added. Nothing is deleted:
 * a sheet that has lost a row is far more likely to have been mis-edited than to be saying
 * the task should go, and deleting a task from the screen takes one click.
 *
 * Nothing at all is written if any row cannot be read — a half-applied plan is worse than a
 * rejected one, so the problems come back instead and the plan is left as it was.
 */
export async function xlsxToPlan(
  file: File,
  project: Project,
  phases: string[],
  existing: Task[],
  people: Person[],
): Promise<PlanImport> {
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const first = book.SheetNames[0];
  const problems: string[] = [];
  if (!first) return { updated: 0, added: 0, problems: ['The workbook has no sheets in it.'], tasks: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[first], { defval: '' });
  if (!rows.length) return { updated: 0, added: 0, problems: [`"${first}" has no rows under its headings.`], tasks: [] };

  const byId = new Map(existing.map((t) => [t.id, t]));
  /* The sheet's own numbering is what its predecessor column refers to, so links are
     resolved against the rows in front of us rather than against the plan on screen. */
  const idAt = new Map<number, string>();
  rows.forEach((r, i) => {
    const n = num(r['#'], i + 1);
    const id = String(r.Id ?? '').trim() || `task-${crypto.randomUUID().slice(0, 8)}`;
    idAt.set(n, id);
    r.__id = id;
  });

  const out: Task[] = [];
  let updated = 0;
  let added = 0;

  rows.forEach((r, i) => {
    const where = `Row ${i + 2}`;
    const name = String(r.Task ?? '').trim();
    if (!name) {
      problems.push(`${where} has no task name.`);
      return;
    }
    const phaseName = String(r.Phase ?? '').trim();
    const phase = phases.findIndex((p) => p.toLowerCase() === phaseName.toLowerCase());
    if (phase < 0) {
      problems.push(`${where} ("${name}") is in a phase called "${phaseName}", which this project does not have.`);
      return;
    }
    const rule = String(r.Rule ?? 'SNET').trim().toUpperCase();
    if (!CONSTRAINTS.some((c) => c.id === rule)) {
      problems.push(`${where} ("${name}") has a rule of "${rule}". It has to be one of ${CONSTRAINTS.map((c) => c.id).join(', ')}.`);
      return;
    }
    const deps = parseDeps(String(r.Predecessors ?? ''), (n) => idAt.get(n) ?? null, num(r['#'], i + 1));
    if (deps.error) {
      problems.push(`${where} ("${name}"): ${deps.error}`);
      return;
    }
    const id = String(r.__id);
    const was = byId.get(id);
    if (was) updated += 1;
    else added += 1;
    const whoName = String(r.Who ?? '').trim();
    const person = people.find((p) => p.name.toLowerCase() === whoName.toLowerCase());
    out.push({
      ...(was ?? {}),
      id,
      projectId: project.id,
      phase,
      name,
      owner: person?.name ?? whoName,
      ownerId: person?.id,
      days: Math.max(1, Math.round(num(r.Days, was?.days ?? 1))),
      weight: clamp(Math.round(num(r['% of day'], was?.weight ?? 100)), 0, 100),
      constraint: rule as ConstraintType,
      constraintDate: dateCell(r['Rule date']) || was?.constraintDate || '',
      deps: deps.deps,
      done: clamp(Math.round(num(r['% done'], was?.done ?? 0)), 0, 100),
      actualStart: dateCell(r['Actual start']) || undefined,
      actualFinish: dateCell(r['Actual finish']) || undefined,
    });
  });

  return problems.length ? { updated: 0, added: 0, problems, tasks: [] } : { updated, added, problems, tasks: out };
}
