import type { ConstraintType, CurrencyCode, Portfolio, Skill, Task } from '../types';
import { CONSTRAINTS, CURRENCIES, PRIORITY_LABEL, STERILE_FAMILY, WORKING_DAYS_PER_MONTH, WORKING_HOURS_PER_DAY } from '../types';
import { RAG_LABEL } from '../data/phases';
import { fileStamp, monthKeyLabel } from './dates';
import { depsToText, parseDeps } from './schedule';
import { parsePeople, peopleText } from './planLoad';

/* CSVs are written to be read by a person, not just re-imported: words rather than codes
   ("Client Solutions", "At risk", "Customer"), money in whole thousands under a labelled
   column, and one row per project or per person-month. Import accepts the same words back,
   and is case-insensitive about them. */

const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];
const CONSTRAINT_IDS = CONSTRAINTS.map((c) => c.id);

function escape(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  // Headers need quoting as much as the cells do — a column name may carry a comma.
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');
}

/** Splits CSV text into rows, honouring quoted fields and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export interface CsvFile {
  name: string;
  content: string;
}

const RAG_FROM_LABEL: Record<string, 'G' | 'A' | 'R'> = {
  'on track': 'G',
  watch: 'A',
  'at risk': 'R',
};

export function projectsCsv(p: Portfolio, months: string[]): string {
  const person = (id: string) => p.people.find((x) => x.id === id)?.name ?? '';
  /** Days the whole team draws on a project in the first month of the window. */
  const drawDays = (projectId: string) => {
    const hours = p.people.reduce((n, x) => n + (p.allocations[`${projectId}|${x.id}|${months[0]}`] ?? 0), 0);
    return (hours / WORKING_HOURS_PER_DAY).toFixed(1);
  };
  return toCsv(
    [
      'Project',
      'Project number',
      'Skills needed',
      'Client or function',
      'Delivery type',
      'Category',
      'For',
      'Sterile',
      'Priority',
      'Priority label',
      'Status',
      'Phase',
      '% through current phase',
      'Project manager',
      'Sales lead',
      'Budget £k',
      'Spent £k',
      'Invoice currency',
      'Agreed k',
      'Invoiced k',
      'Team draw this month (days, calculated)',
      'Start date',
      'End date',
      'Next milestone',
      'Milestone date',
      'Planned with tasks',
      'Books people from the plan',
      'On hold',
      'Archived',
    ],
    p.projects.map((x) => [
      x.name,
      x.number ?? '',
      (x.skills ?? []).map((id) => p.skills.find((s) => s.id === id)?.label ?? id).join('; '),
      x.client,
      familyOf(p, x.type)?.label ?? x.type,
      p.projectTypes.find((t) => t.id === x.type)?.label ?? '',
      x.facing === 'C' ? 'Customer' : 'Internal',
      // Only Client Solutions work is asked the question, so the rest stay blank.
      familyOf(p, x.type)?.id === STERILE_FAMILY ? (x.sterile ? 'Yes' : 'No') : '',
      x.priority,
      PRIORITY_LABEL[x.priority] ?? '',
      RAG_LABEL[x.rag],
      (p.projectTypes.find((t) => t.id === x.type)?.phases ?? [])[x.phase] ?? '',
      x.pct,
      person(x.pmId),
      x.salesLead ?? '',
      x.budget,
      x.actual,
      x.currency,
      x.value,
      x.billed,
      drawDays(x.id),
      x.startDate,
      x.endDate,
      x.milestone,
      x.milestoneDate,
      x.usesPlan ? 'Yes' : 'No',
      x.plansResource ? 'Yes' : 'No',
      x.inactive ? 'Yes' : 'No',
      x.archived ? 'Yes' : 'No',
    ]),
  );
}

/** The kind of work a project's category belongs to. */
function familyOf(p: Portfolio, typeId: string) {
  const category = p.projectTypes.find((t) => t.id === typeId);
  return p.families.find((f) => f.id === category?.family);
}

export function peopleCsv(p: Portfolio): string {
  return toCsv(
    ['Name', 'Job title', 'Project family', 'Skills', 'Working days per month', 'Capacity %', 'Non-project work %', 'Archived'],
    p.people.map((x) => [
      x.name,
      x.role,
      x.types.map((id) => p.families.find((f) => f.id === id)?.label ?? id).join('; ') || 'All',
      // By name, not by id: a spreadsheet is read by people, and the names are the tags.
      (x.skills ?? []).map((id) => p.skills.find((s) => s.id === id)?.label ?? id).join('; '),
      x.workingDays,
      x.capacity,
      x.overheadPct ?? 0,
      x.archived ? 'Yes' : 'No',
    ]),
  );
}

/** One row per person-month, with project columns — the shape a planner actually reads.
    Time is booked in hours, so that is what the file carries. */
export function allocationsCsv(p: Portfolio, months: string[]): string {
  const rows: (string | number)[][] = [];
  p.people.forEach((person) => {
    p.projects.forEach((project) => {
      const values = months.map((m) => p.allocations[`${project.id}|${person.id}|${m}`] ?? 0);
      if (values.every((v) => !v)) return;
      rows.push([person.name, person.role, project.name, ...values]);
    });
  });
  return toCsv(
    ['Person', 'Job title', 'Project', ...months.map((m) => `${monthKeyLabel(m)} (hours)`)],
    rows,
  );
}

/** The first row is the days everybody takes; the rest is what each person books themselves. */
export const HOLIDAY_ROW = 'Public holidays (everyone)';

export function leaveCsv(p: Portfolio, months: string[]): string {
  const holidays = [HOLIDAY_ROW, ...months.map((m) => p.publicHolidays[m] ?? 0)];
  const rows = p.people
    .map((person) => [person.name, ...months.map((m) => p.leave[`${person.id}|${m}`] ?? 0)])
    .filter((r) => r.slice(1).some((v) => Number(v) > 0));
  const body = holidays.slice(1).some((v) => Number(v) > 0) ? [holidays, ...rows] : rows;
  return toCsv(['Person', ...months.map((m) => `${monthKeyLabel(m)} (days)`)], body);
}

/** One row per task, with predecessors written the way the planner types them. Numbering
    runs per project in the same order the Planning screen shows, so a file exported here
    reads back as the same plan. */
export function tasksCsv(p: Portfolio): string {
  const rows: (string | number)[][] = [];
  p.projects.forEach((project) => {
    const phases = p.projectTypes.find((t) => t.id === project.type)?.phases ?? [];
    const mine: Task[] = [];
    phases.forEach((_, i) => mine.push(...p.tasks.filter((t) => t.projectId === project.id && t.phase === i)));
    const numberOf = new Map(mine.map((t, i) => [t.id, i + 1]));
    mine.forEach((t) => {
      rows.push([
        project.name,
        phases[t.phase] ?? String(t.phase + 1),
        numberOf.get(t.id) ?? 0,
        t.name,
        peopleText(t, (id) => p.people.find((x) => x.id === id)?.name),
        t.days,
        t.weight ?? 100,
        t.constraint,
        t.constraintDate,
        depsToText(t.deps, (id) => numberOf.get(id) ?? null),
        t.done,
      ]);
    });
  });
  return toCsv(
    [
      'Project',
      'Phase',
      'Task number',
      'Task',
      'Who',
      'Working days',
      '% of their day',
      'Constraint',
      'Constraint date',
      'Predecessors',
      '% done',
    ],
    rows,
  );
}

/** One row per invoice, naming what it waits on rather than pointing at an id. */
export function invoicesCsv(p: Portfolio): string {
  const project = (id: string) => p.projects.find((x) => x.id === id);
  return toCsv(
    ['Project', 'What for', 'Sales order', 'Amount', 'Currency', 'Due', 'Waits on'],
    p.invoices.map((i) => {
      const proj = project(i.projectId);
      const phases = p.projectTypes.find((t) => t.id === proj?.type)?.phases ?? [];
      const waits =
        i.phase !== undefined && phases[i.phase]
          ? `Gate: ${phases[i.phase]}`
          : i.taskId
            ? `Task: ${p.tasks.find((t) => t.id === i.taskId)?.name ?? ''}`
            : '';
      return [proj?.name ?? '', i.label, i.salesOrder ?? '', i.amount, proj?.currency ?? '', i.due, waits];
    }),
  );
}

export function portfolioCsvFiles(p: Portfolio, months: string[]): CsvFile[] {
  const stamp = fileStamp();
  return [
    { name: `pmo-projects-${stamp}.csv`, content: projectsCsv(p, months) },
    { name: `pmo-people-${stamp}.csv`, content: peopleCsv(p) },
    { name: `pmo-allocations-${stamp}.csv`, content: allocationsCsv(p, months) },
    { name: `pmo-leave-${stamp}.csv`, content: leaveCsv(p, months) },
    { name: `pmo-tasks-${stamp}.csv`, content: tasksCsv(p) },
    { name: `pmo-invoices-${stamp}.csv`, content: invoicesCsv(p) },
  ];
}

/* Skills come and go by name in a sheet. A name already on the list is that skill; one that
   is not is added, the same way an unfamiliar job title is — a sheet naming a skill nobody
   has recorded is a person telling the tracker about a skill, not a mistake to drop. */
function readSkills(text: string, into: Skill[]): string[] {
  return text
    .split(';')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((label) => {
      const found = into.find((s) => s.label.toLowerCase() === label.toLowerCase());
      if (found) return found.id;
      const made = { id: `skill-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`, label };
      into.push(made);
      return made.id;
    });
}

export type CsvKind = 'projects' | 'people' | 'allocations' | 'leave' | 'tasks';

/** Works out which export a file is from its header row. */
export function detectKind(headers: string[]): CsvKind | null {
  const h = headers.map((x) => x.trim().toLowerCase());
  if (h.includes('task') && h.includes('predecessors')) return 'tasks';
  if (h.includes('project') && h.includes('budget £k')) return 'projects';
  if (h.includes('name') && h.includes('job title')) return 'people';
  if (h.includes('person') && h.includes('project')) return 'allocations';
  if (h[0] === 'person' && h.slice(1).some((x) => x.includes('(days)'))) return 'leave';
  return null;
}

export interface ImportResult {
  kind: CsvKind;
  portfolio: Portfolio;
  applied: number;
  skipped: string[];
}

const num = (v: string) => {
  const n = Number(String(v).replace(/[£,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Merges a CSV into the portfolio by name, updating what matches and adding what does not. */
export function applyCsv(portfolio: Portfolio, text: string, months: string[]): ImportResult {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('the file is empty');
  const headers = rows[0];
  const kind = detectKind(headers);
  if (!kind) throw new Error('the header row does not match a projects, people, allocations, leave or tasks export');

  const body = rows.slice(1);
  const skipped: string[] = [];
  let applied = 0;
  const next: Portfolio = { ...portfolio };
  const col = (r: string[], name: string) => {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    return i < 0 ? '' : (r[i] ?? '').trim();
  };

  if (kind === 'projects') {
    const projects = [...portfolio.projects];
    const skills = [...portfolio.skills];
    body.forEach((r) => {
      const name = col(r, 'Project');
      if (!name) return;
      /* The kind of work names the family; the category names the way it is run. A sheet
         written before categories existed carries only the first, and lands on whichever way
         that kind is run first — which is the only way it was run when the sheet was made. */
      const typeLabel = col(r, 'Delivery type').toLowerCase();
      const categoryLabel = col(r, 'Category').toLowerCase();
      const family =
        portfolio.families.find((f) => f.label.toLowerCase() === typeLabel) ??
        portfolio.families.find((f) => f.id.toLowerCase() === typeLabel);
      const withinFamily = portfolio.projectTypes.filter((t) => !family || t.family === family.id);
      const typeDef =
        withinFamily.find((t) => t.label.toLowerCase() === categoryLabel) ??
        withinFamily[0] ??
        portfolio.projectTypes.find((t) => t.id.toLowerCase() === typeLabel) ??
        portfolio.projectTypes[0];
      const phaseName = col(r, 'Phase');
      const phaseIndex = Math.max(0, typeDef.phases.findIndex((x: string) => x.toLowerCase() === phaseName.toLowerCase()));
      const pmName = col(r, 'Project manager');
      const pm = portfolio.people.find((x) => x.name.toLowerCase() === pmName.toLowerCase());
      const existing = projects.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
      const base = existing >= 0 ? projects[existing] : null;
      const merged = {
        id: base?.id ?? `project-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        client: col(r, 'Client or function') || base?.client || '',
        type: typeDef.id,
        facing: (col(r, 'For').toLowerCase().startsWith('internal') ? 'I' : 'C') as 'C' | 'I',
        priority: num(col(r, 'Priority')) || base?.priority || 3,
        rag: RAG_FROM_LABEL[col(r, 'Status').toLowerCase()] ?? base?.rag ?? 'G',
        phase: phaseIndex,
        pct: num(col(r, '% through current phase')),
        pmId: pm?.id ?? base?.pmId ?? portfolio.people[0]?.id ?? '',
        budget: num(col(r, 'Budget £k')),
        actual: num(col(r, 'Spent £k')),
        value: num(col(r, 'Agreed k')),
        billed: num(col(r, 'Invoiced k')),
        // Draw is recalculated from the bookings, so the exported column is not read back.
        load: base?.load ?? 0,
        startDate: col(r, 'Start date') || base?.startDate || '',
        endDate: col(r, 'End date') || base?.endDate || '',
        milestone: col(r, 'Next milestone') || base?.milestone || '',
        milestoneDate: col(r, 'Milestone date') || base?.milestoneDate || '',
        phaseDates: base?.phaseDates ?? [],
        invoiceDates: base?.invoiceDates ?? [],
        usesPlan: headers.some((h) => h.trim().toLowerCase() === 'planned with tasks')
          ? col(r, 'Planned with tasks').toLowerCase() === 'yes'
          : base?.usesPlan,
        plansResource: headers.some((h) => h.trim().toLowerCase() === 'books people from the plan')
          ? col(r, 'Books people from the plan').toLowerCase() === 'yes'
          : base?.plansResource,
        // A file without the column leaves the stored answer alone.
        archived: headers.some((h) => h.trim().toLowerCase() === 'archived')
          ? col(r, 'Archived').toLowerCase() === 'yes'
          : base?.archived,
        number: col(r, 'Project number').trim() || base?.number,
        skills: headers.some((h) => h.trim().toLowerCase() === 'skills needed')
          ? readSkills(col(r, 'Skills needed'), skills)
          : base?.skills ?? [],
        salesLead: col(r, 'Sales lead').trim() || base?.salesLead,
        inactive: headers.some((h) => h.trim().toLowerCase() === 'on hold')
          ? col(r, 'On hold').toLowerCase() === 'yes'
          : base?.inactive,
        // A file without the column leaves the stored answer alone.
        sterile: headers.some((h) => h.trim().toLowerCase() === 'sterile')
          ? col(r, 'Sterile').toLowerCase() === 'yes'
          : base?.sterile,
        currency: (CURRENCY_CODES.find((c) => c === col(r, 'Invoice currency').trim().toUpperCase()) ??
          base?.currency ??
          'GBP') as CurrencyCode,
      };
      if (!merged.startDate || !merged.endDate) {
        skipped.push(`${name}: missing start or end date`);
        return;
      }
      if (existing >= 0) projects[existing] = merged;
      else projects.push(merged);
      applied += 1;
    });
    next.projects = projects;
    next.skills = skills;
  }

  /* A tasks file replaces the plan of every project it names, and leaves every other
     project's plan alone. Merging row by row would quietly double a plan up each time a
     backup was restored. */
  if (kind === 'tasks') {
    const touched = new Set<string>();
    const made: { task: Task; predecessors: string; number: number }[] = [];
    body.forEach((r, i) => {
      const projectName = col(r, 'Project');
      const taskName = col(r, 'Task');
      if (!projectName || !taskName) return;
      const project = portfolio.projects.find((x) => x.name.toLowerCase() === projectName.toLowerCase());
      if (!project) {
        skipped.push(`${taskName}: no project called ${projectName}`);
        return;
      }
      const phases = portfolio.projectTypes.find((t) => t.id === project.type)?.phases ?? [];
      const phaseName = col(r, 'Phase');
      const phase = Math.max(0, phases.findIndex((x) => x.toLowerCase() === phaseName.toLowerCase()));
      touched.add(project.id);
      made.push({
        task: {
          id: `task-${project.id}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: project.id,
          phase,
          name: taskName,
          /* The sheet names people, so the id is looked up here — a name nobody answers to
             is kept as written and books no time, which is what it did before. */
          ...(() => {
            /* One cell holds everybody on the task — "Yusuf 100%; Rachel 20%" — and the
               first of them fills the two older fields so anything still reading those
               sees the task's lead rather than nothing. */
            const on = parsePeople(col(r, 'Who'), portfolio.people);
            return { assignees: on, owner: on[0]?.name ?? '', ownerId: on[0]?.personId || undefined };
          })(),
          days: Math.max(1, Math.round(num(col(r, 'Working days')) || 1)),
          // A sheet written before weights existed means the whole day.
          weight: col(r, '% of their day') ? Math.min(100, Math.max(0, num(col(r, '% of their day')))) : 100,
          /* Files written before constraints existed carry only a start date, which is
             what "start no earlier than" says. */
          constraint: (CONSTRAINT_IDS.find((c) => c === col(r, 'Constraint').toUpperCase()) ?? 'SNET') as ConstraintType,
          constraintDate:
            col(r, 'Constraint date') || col(r, 'Starts no earlier than') || project.startDate,
          deps: [],
          done: Math.min(100, Math.max(0, num(col(r, '% done')))),
        },
        predecessors: col(r, 'Predecessors'),
        number: Math.round(num(col(r, 'Task number'))),
      });
      applied += 1;
    });
    // Links are resolved once every task exists, since a task may point either way.
    made.forEach((entry) => {
      if (!entry.predecessors) return;
      const inProject = made.filter((m) => m.task.projectId === entry.task.projectId);
      const parsed = parseDeps(
        entry.predecessors,
        (n) => inProject.find((m) => m.number === n)?.task.id ?? null,
        entry.number,
      );
      if (parsed.error) skipped.push(`${entry.task.name}: ${parsed.error}`);
      else entry.task.deps = parsed.deps;
    });
    next.tasks = [...portfolio.tasks.filter((t) => !touched.has(t.projectId)), ...made.map((m) => m.task)];
  }

  if (kind === 'people') {
    const people = [...portfolio.people];
    const roles = new Set(portfolio.roles);
    const skills = [...portfolio.skills];
    body.forEach((r) => {
      const name = col(r, 'Name');
      if (!name) return;
      const role = col(r, 'Job title') || 'Project manager';
      roles.add(role);
      // Sheets written before families were named that way carry the old heading.
      const typeNames = col(r, 'Project family') || col(r, 'Project types');
      const days = num(col(r, 'Working days per month')) || WORKING_DAYS_PER_MONTH;
      const existing = people.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
      const merged = {
        id: existing >= 0 ? people[existing].id : `person-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        role,
        types:
          !typeNames || typeNames.toLowerCase() === 'all'
            ? []
            : typeNames
                .split(';')
                .map((n) => n.trim())
                .map((n) => portfolio.families.find((f) => f.label.toLowerCase() === n.toLowerCase())?.id)
                .filter((x): x is string => Boolean(x)),
        workingDays: days,
        capacity: Math.round((days / WORKING_DAYS_PER_MONTH) * 100),
        // A file without the column leaves what is already recorded alone.
        overheadPct: headers.some((h) => h.trim().toLowerCase() === 'non-project work %')
          ? Math.min(100, Math.max(0, num(col(r, 'Non-project work %'))))
          : (existing >= 0 ? people[existing].overheadPct : 0) ?? 0,
        archived: headers.some((h) => h.trim().toLowerCase() === 'archived')
          ? col(r, 'Archived').toLowerCase() === 'yes'
          : existing >= 0 && people[existing].archived,
        // A file without the column leaves what this person can do alone.
        skills: headers.some((h) => h.trim().toLowerCase() === 'skills')
          ? readSkills(col(r, 'Skills'), skills)
          : (existing >= 0 ? people[existing].skills : []) ?? [],
      };
      if (existing >= 0) people[existing] = merged;
      else people.push(merged);
      applied += 1;
    });
    next.people = people;
    next.roles = [...roles];
    next.skills = skills;
  }

  if (kind === 'allocations') {
    const allocations = { ...portfolio.allocations };
    const monthCols = headers.slice(3);
    body.forEach((r) => {
      const personName = col(r, 'Person');
      const projectName = col(r, 'Project');
      const person = portfolio.people.find((x) => x.name.toLowerCase() === personName.toLowerCase());
      const project = portfolio.projects.find((x) => x.name.toLowerCase() === projectName.toLowerCase());
      if (!person || !project) {
        skipped.push(`${personName || '?'} on ${projectName || '?'}: not found`);
        return;
      }
      monthCols.forEach((label, i) => {
        const month = months.find((m) => `${monthKeyLabel(m)} (hours)` === label.trim());
        if (!month) return;
        const hours = num(r[3 + i] ?? '');
        const key = `${project.id}|${person.id}|${month}`;
        if (hours > 0) allocations[key] = hours;
        else delete allocations[key];
      });
      applied += 1;
    });
    next.allocations = allocations;
  }

  if (kind === 'leave') {
    const leave = { ...portfolio.leave };
    const publicHolidays = { ...portfolio.publicHolidays };
    const monthCols = headers.slice(1);
    /** The month a column names, or null if it falls outside the planning window. */
    const monthOf = (label: string) => months.find((m) => `${monthKeyLabel(m)} (days)` === label.trim()) ?? null;
    body.forEach((r) => {
      const personName = col(r, 'Person');
      // The everyone-row is written first by the export and comes back the same way.
      if (personName.trim().toLowerCase() === HOLIDAY_ROW.toLowerCase()) {
        monthCols.forEach((label, i) => {
          const month = monthOf(label);
          if (!month) return;
          const days = num(r[1 + i] ?? '');
          if (days > 0) publicHolidays[month] = days;
          else delete publicHolidays[month];
        });
        applied += 1;
        return;
      }
      const person = portfolio.people.find((x) => x.name.toLowerCase() === personName.toLowerCase());
      if (!person) {
        skipped.push(`${personName || '?'}: not found`);
        return;
      }
      monthCols.forEach((label, i) => {
        const month = monthOf(label);
        if (!month) return;
        const days = num(r[1 + i] ?? '');
        const key = `${person.id}|${month}`;
        if (days > 0) leave[key] = days;
        else delete leave[key];
      });
      applied += 1;
    });
    next.leave = leave;
    next.publicHolidays = publicHolidays;
  }

  return { kind, portfolio: next, applied, skipped };
}
