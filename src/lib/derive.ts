import { useMemo } from 'react';
import type { Person, Portfolio, Project, Rag } from '../types';
import { PHASES, RAG_LABEL, TYPE_LABEL } from '../data/phases';
import { fromISO, monthLabel, monthSpan, planningMonths, shortDate, shortMonth } from './dates';

export function money(k: number): string {
  if (!k) return '—';
  return k >= 1000 ? `£${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}m` : `£${k}k`;
}

export function moneyOrZero(k: number): string {
  return k ? money(k) : '£0';
}

export function ragColor(rag: Rag): string {
  if (rag === 'R') return 'var(--color-accent-2)';
  if (rag === 'A') return 'var(--color-process-yellow)';
  return 'var(--color-neutral-500)';
}

export interface ProjectView extends Project {
  phases: string[];
  phaseName: string;
  phaseStep: string;
  pips: { bg: string }[];
  cust: boolean;
  typeShort: string;
  typeLabel: string;
  facingLabel: string;
  stripe: string;
  ragLabel: string;
  ragColor: string;
  pmName: string;
  burn: number;
  burnLabel: string;
  burnInk: string;
  burnInk2: string;
  loadLabel: string;
  loadColor: string;
  loadInk: string;
  budgetLabel: string;
  actualLabel: string;
  remainLabel: string;
  valueLabel: string;
  billedLabel: string;
  toBillLabel: string;
  moneyLabel: string;
  moneyMain: string;
  moneySub: string;
  msDateLabel: string;
  startLabel: string;
  endLabel: string;
  durationMonths: number;
}

export function viewProject(project: Project, people: Person[], threshold: number): ProjectView {
  const phases = PHASES[project.type];
  const cust = project.facing === 'C';
  const burn = project.budget ? Math.round((project.actual / project.budget) * 100) : 0;
  const pm = people.find((p) => p.id === project.pmId);
  const start = fromISO(project.startDate);
  const end = fromISO(project.endDate);
  return {
    ...project,
    phases,
    phaseName: phases[project.phase] ?? phases[0],
    phaseStep: `${project.phase + 1} of ${phases.length}`,
    pips: phases.map((_, i) => ({
      bg:
        i < project.phase
          ? 'var(--color-text)'
          : i === project.phase
            ? 'var(--color-accent)'
            : 'var(--color-neutral-300)',
    })),
    cust,
    typeShort: project.type,
    typeLabel: TYPE_LABEL[project.type],
    facingLabel: cust ? 'Customer-facing' : 'Internal',
    stripe: cust ? 'var(--color-accent)' : 'var(--color-neutral-400)',
    ragLabel: RAG_LABEL[project.rag],
    ragColor: ragColor(project.rag),
    pmName: pm?.name ?? 'Unassigned',
    burn,
    burnLabel: `${burn}%`,
    burnInk:
      burn > 95 ? 'var(--color-accent-2-700)' : burn > threshold ? 'var(--color-accent-700)' : 'var(--color-text)',
    burnInk2: burn > 95 ? 'var(--color-accent-2)' : 'var(--color-text)',
    loadLabel: `${project.load}%`,
    loadColor:
      project.load > 100
        ? 'var(--color-accent-2)'
        : project.load > threshold
          ? 'var(--color-process-yellow)'
          : 'var(--color-neutral-500)',
    loadInk: project.load > 100 ? 'var(--color-accent-2-700)' : 'var(--color-text)',
    budgetLabel: money(project.budget),
    actualLabel: money(project.actual),
    remainLabel: money(project.budget - project.actual),
    valueLabel: money(project.value),
    billedLabel: moneyOrZero(project.billed),
    toBillLabel: money(project.value - project.billed),
    moneyLabel: cust ? 'Invoiced' : 'Budget drawn',
    moneyMain: cust ? moneyOrZero(project.billed) : money(project.actual),
    moneySub: cust ? `of ${money(project.value)} value` : `of ${money(project.budget)} pool`,
    msDateLabel: shortDate(project.milestoneDate),
    startLabel: monthLabel(start),
    endLabel: monthLabel(end),
    durationMonths: monthSpan(start, end),
  };
}

export interface PersonView {
  person: Person;
  loads: number[];
  peak: number;
  peakMonthIndex: number;
  /** Names of the projects this person is booked on, in the planning window. */
  projectNames: string[];
}

export interface PortfolioView {
  projects: ProjectView[];
  people: Person[];
  peopleViews: PersonView[];
  /** `YYYY-MM` keys for the six planning months. */
  months: string[];
  monthLabels: string[];
  threshold: number;
  demand: number[];
  capacity: number;
  totals: {
    value: number;
    billed: number;
    toBill: number;
    internalBudget: number;
    internalDrawn: number;
    customerCount: number;
    internalCount: number;
    atRisk: number;
    shortOfPeople: number;
  };
  allocationsFor: (projectId: string) => { person: Person; loads: number[]; total: number }[];
  /** This project's bookings keyed `${personId}|${month}`, for the edit form. */
  allocationsOf: (projectId: string) => Record<string, number>;
  /** Everyone's monthly load with one project left out, so the form can warn on unsaved edits. */
  loadsExcluding: (projectId: string) => Record<string, number[]>;
  today: Date;
}

export function usePortfolioView(portfolio: Portfolio): PortfolioView {
  return useMemo(() => {
    const today = new Date();
    const months = planningMonths(today);
    const monthLabels = months.map(shortMonth);
    const { threshold, people, allocations } = portfolio;
    const projects = portfolio.projects.map((p) => viewProject(p, people, threshold));

    const projectById = new Map(portfolio.projects.map((p) => [p.id, p]));
    const loadIndex = new Map<string, number[]>();
    const bookedOn = new Map<string, Set<string>>();
    people.forEach((person) => {
      loadIndex.set(person.id, months.map(() => 0));
      bookedOn.set(person.id, new Set());
    });
    Object.entries(allocations).forEach(([key, pct]) => {
      const [projectId, personId, month] = key.split('|');
      const monthIndex = months.indexOf(month);
      const loads = loadIndex.get(personId);
      const project = projectById.get(projectId);
      if (monthIndex < 0 || !loads || !project) return;
      loads[monthIndex] += pct;
      bookedOn.get(personId)?.add(project.name);
    });

    const peopleViews: PersonView[] = people.map((person) => {
      const loads = loadIndex.get(person.id) ?? months.map(() => 0);
      const peak = loads.length ? Math.max(...loads) : 0;
      return {
        person,
        loads,
        peak,
        peakMonthIndex: loads.indexOf(peak),
        projectNames: [...(bookedOn.get(person.id) ?? [])],
      };
    });

    const demand = months.map((_, i) => peopleViews.reduce((n, p) => n + p.loads[i], 0) / 100);
    const capacity = people.reduce((n, p) => n + p.capacity, 0) / 100;

    const customer = projects.filter((p) => p.cust);
    const internal = projects.filter((p) => !p.cust);
    const value = customer.reduce((n, p) => n + p.value, 0);
    const billed = customer.reduce((n, p) => n + p.billed, 0);

    const allocationsFor = (projectId: string) =>
      people
        .map((person) => {
          const loads = months.map((m) => allocations[`${projectId}|${person.id}|${m}`] ?? 0);
          return { person, loads, total: loads.reduce((n, v) => n + v, 0) };
        })
        .filter((row) => row.total > 0);

    const allocationsOf = (projectId: string) => {
      const out: Record<string, number> = {};
      people.forEach((person) => {
        months.forEach((month) => {
          const pct = allocations[`${projectId}|${person.id}|${month}`];
          if (pct) out[`${person.id}|${month}`] = pct;
        });
      });
      return out;
    };

    const loadsExcluding = (projectId: string) => {
      const out: Record<string, number[]> = {};
      people.forEach((person) => {
        const own = months.map((m) => allocations[`${projectId}|${person.id}|${m}`] ?? 0);
        const total = loadIndex.get(person.id) ?? months.map(() => 0);
        out[person.id] = total.map((v, i) => v - own[i]);
      });
      return out;
    };

    return {
      projects,
      people,
      peopleViews,
      months,
      monthLabels,
      threshold,
      demand,
      capacity,
      totals: {
        value,
        billed,
        toBill: value - billed,
        internalBudget: internal.reduce((n, p) => n + p.budget, 0),
        internalDrawn: internal.reduce((n, p) => n + p.actual, 0),
        customerCount: customer.length,
        internalCount: internal.length,
        atRisk: projects.filter((p) => p.rag === 'R').length,
        shortOfPeople: projects.filter((p) => p.load > threshold).length,
      },
      allocationsFor,
      allocationsOf,
      loadsExcluding,
      today,
    };
  }, [portfolio]);
}
