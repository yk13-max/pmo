import type { Portfolio } from '../types';
import { PRIORITY_LABEL, WORKING_DAYS_PER_MONTH } from '../types';
import { PHASES, RAG_LABEL, TYPE_LABEL } from '../data/phases';
import { monthKeyLabel } from './dates';

/* CSVs are written to be read by a person, not just re-imported: words rather than codes
   ("Client Solutions", "At risk", "Customer-facing"), money in whole £k under a labelled
   column, and one row per project or per person-month. Import accepts the same words back,
   and is case-insensitive about them. */

function escape(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');
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

export function projectsCsv(p: Portfolio): string {
  const person = (id: string) => p.people.find((x) => x.id === id)?.name ?? '';
  return toCsv(
    [
      'Project',
      'Client or function',
      'Delivery type',
      'For',
      'Priority',
      'Priority label',
      'Status',
      'Phase',
      'Plan finished %',
      'Project manager',
      'Budget £k',
      'Spent £k',
      'Agreed £k',
      'Invoiced £k',
      'Team load %',
      'Start date',
      'End date',
      'Next milestone',
      'Milestone date',
    ],
    p.projects.map((x) => [
      x.name,
      x.client,
      TYPE_LABEL[x.type],
      x.facing === 'C' ? 'Customer-facing' : 'Internal',
      x.priority,
      PRIORITY_LABEL[x.priority] ?? '',
      RAG_LABEL[x.rag],
      PHASES[x.type][x.phase] ?? '',
      x.pct,
      person(x.pmId),
      x.budget,
      x.actual,
      x.value,
      x.billed,
      x.load,
      x.startDate,
      x.endDate,
      x.milestone,
      x.milestoneDate,
    ]),
  );
}

export function peopleCsv(p: Portfolio): string {
  return toCsv(
    ['Name', 'Job title', 'Works across', 'Working days per month', 'Capacity %'],
    p.people.map((x) => [
      x.name,
      x.role,
      x.discipline === 'CS' ? 'Client Solutions' : x.discipline === 'CDMO' ? 'CDMO' : 'Both',
      x.workingDays,
      x.capacity,
    ]),
  );
}

/** One row per person-month, with project columns — the shape a planner actually reads. */
export function allocationsCsv(p: Portfolio, months: string[]): string {
  const rows: (string | number)[][] = [];
  p.people.forEach((person) => {
    p.projects.forEach((project) => {
      const values = months.map((m) => p.allocations[`${project.id}|${person.id}|${m}`] ?? 0);
      if (values.every((v) => !v)) return;
      rows.push([person.name, person.role, project.name, ...values]);
    });
  });
  return toCsv(['Person', 'Job title', 'Project', ...months.map(monthKeyLabel)], rows);
}

export function leaveCsv(p: Portfolio, months: string[]): string {
  const rows = p.people
    .map((person) => [person.name, ...months.map((m) => p.leave[`${person.id}|${m}`] ?? 0)])
    .filter((r) => r.slice(1).some((v) => Number(v) > 0));
  return toCsv(['Person', ...months.map((m) => `${monthKeyLabel(m)} (days)`)], rows);
}

export function portfolioCsvFiles(p: Portfolio, months: string[]): CsvFile[] {
  const stamp = new Date().toISOString().slice(0, 10);
  return [
    { name: `pmo-projects-${stamp}.csv`, content: projectsCsv(p) },
    { name: `pmo-people-${stamp}.csv`, content: peopleCsv(p) },
    { name: `pmo-allocations-${stamp}.csv`, content: allocationsCsv(p, months) },
    { name: `pmo-leave-${stamp}.csv`, content: leaveCsv(p, months) },
  ];
}

export type CsvKind = 'projects' | 'people' | 'allocations' | 'leave';

/** Works out which export a file is from its header row. */
export function detectKind(headers: string[]): CsvKind | null {
  const h = headers.map((x) => x.trim().toLowerCase());
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
  if (!kind) throw new Error('the header row does not match a projects, people, allocations or leave export');

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
    body.forEach((r) => {
      const name = col(r, 'Project');
      if (!name) return;
      const type = col(r, 'Delivery type').toLowerCase().startsWith('cdmo') ? 'CDMO' : 'CS';
      const phaseName = col(r, 'Phase');
      const phaseIndex = Math.max(0, PHASES[type].findIndex((x) => x.toLowerCase() === phaseName.toLowerCase()));
      const pmName = col(r, 'Project manager');
      const pm = portfolio.people.find((x) => x.name.toLowerCase() === pmName.toLowerCase());
      const existing = projects.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
      const base = existing >= 0 ? projects[existing] : null;
      const merged = {
        id: base?.id ?? `project-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        client: col(r, 'Client or function') || base?.client || '',
        type: type as 'CS' | 'CDMO',
        facing: (col(r, 'For').toLowerCase().startsWith('internal') ? 'I' : 'C') as 'C' | 'I',
        priority: num(col(r, 'Priority')) || base?.priority || 3,
        rag: RAG_FROM_LABEL[col(r, 'Status').toLowerCase()] ?? base?.rag ?? 'G',
        phase: phaseIndex,
        pct: num(col(r, 'Plan finished %')),
        pmId: pm?.id ?? base?.pmId ?? portfolio.people[0]?.id ?? '',
        budget: num(col(r, 'Budget £k')),
        actual: num(col(r, 'Spent £k')),
        value: num(col(r, 'Agreed £k')),
        billed: num(col(r, 'Invoiced £k')),
        load: num(col(r, 'Team load %')),
        startDate: col(r, 'Start date') || base?.startDate || '',
        endDate: col(r, 'End date') || base?.endDate || '',
        milestone: col(r, 'Next milestone') || base?.milestone || '',
        milestoneDate: col(r, 'Milestone date') || base?.milestoneDate || '',
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
  }

  if (kind === 'people') {
    const people = [...portfolio.people];
    const roles = new Set(portfolio.roles);
    body.forEach((r) => {
      const name = col(r, 'Name');
      if (!name) return;
      const role = col(r, 'Job title') || 'Project manager';
      roles.add(role);
      const across = col(r, 'Works across').toLowerCase();
      const days = num(col(r, 'Working days per month')) || WORKING_DAYS_PER_MONTH;
      const existing = people.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
      const merged = {
        id: existing >= 0 ? people[existing].id : `person-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        role,
        discipline: across.startsWith('client') ? 'CS' : across.startsWith('cdmo') ? 'CDMO' : '',
        workingDays: days,
        capacity: Math.round((days / WORKING_DAYS_PER_MONTH) * 100),
      };
      if (existing >= 0) people[existing] = merged;
      else people.push(merged);
      applied += 1;
    });
    next.people = people;
    next.roles = [...roles];
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
        const month = months.find((m) => monthKeyLabel(m) === label.trim());
        if (!month) return;
        const pct = num(r[3 + i] ?? '');
        const key = `${project.id}|${person.id}|${month}`;
        if (pct > 0) allocations[key] = pct;
        else delete allocations[key];
      });
      applied += 1;
    });
    next.allocations = allocations;
  }

  if (kind === 'leave') {
    const leave = { ...portfolio.leave };
    const monthCols = headers.slice(1);
    body.forEach((r) => {
      const personName = col(r, 'Person');
      const person = portfolio.people.find((x) => x.name.toLowerCase() === personName.toLowerCase());
      if (!person) {
        skipped.push(`${personName || '?'}: not found`);
        return;
      }
      monthCols.forEach((label, i) => {
        const month = months.find((m) => `${monthKeyLabel(m)} (days)` === label.trim());
        if (!month) return;
        const days = num(r[1 + i] ?? '');
        const key = `${person.id}|${month}`;
        if (days > 0) leave[key] = days;
        else delete leave[key];
      });
      applied += 1;
    });
    next.leave = leave;
  }

  return { kind, portfolio: next, applied, skipped };
}
