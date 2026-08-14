import { useMemo } from 'react';
import type { CurrencyCode, Person, Portfolio, Project, ProjectFamily, ProjectTypeDef, Rag, Task } from '../types';
import {
  BASE_CURRENCY,
  CURRENCIES,
  HOURS_PER_FULL_MONTH,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY,
} from '../types';
import { RAG_LABEL } from '../data/phases';
import { schedule } from './schedule';
import { effectiveAllocations, planBookedProjects } from './planLoad';
import { PRIORITY_LABEL } from '../types';
import { fromISO, monthKeyLabel, monthLabel, monthSpan, monthsBetween, monthsFrom, shortDate, shortMonth } from './dates';

/** Money in thousands, in whatever the client is billed in. Costs stay in the base currency. */
export function money(k: number, currency: CurrencyCode = BASE_CURRENCY): string {
  if (!k) return '—';
  const symbol = CURRENCIES[currency]?.symbol ?? CURRENCIES[BASE_CURRENCY].symbol;
  return k >= 1000 ? `${symbol}${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}m` : `${symbol}${k}k`;
}

export function moneyOrZero(k: number, currency: CurrencyCode = BASE_CURRENCY): string {
  return k ? money(k, currency) : `${CURRENCIES[currency]?.symbol ?? '£'}0`;
}

/* Time is booked in hours and reported in days. Percentages survive only where the question
   is "how full is this person's month", which is what the resourcing graphs measure. */
export const hoursToPct = (hours: number) => (hours / HOURS_PER_FULL_MONTH) * 100;
export const pctToHours = (pct: number) => (pct / 100) * HOURS_PER_FULL_MONTH;
export const hoursToDays = (hours: number) => hours / WORKING_HOURS_PER_DAY;

/** Days to one decimal, the way every resource figure is reported. */
export function days(hours: number): string {
  const d = hoursToDays(hours);
  return `${d.toFixed(1)} day${d === 1 ? '' : 's'}`;
}

/* Each delivery type gets its own colour so CDMO and Client Solutions can be told apart at
   a glance. The first two are the brand's navy and teal; further types cycle on from there. */
const TYPE_COLOURS = [
  'var(--color-accent)',
  'var(--color-teal-600)',
  'var(--color-accent-2)',
  'var(--color-warning)',
  'var(--color-teal-800)',
];

export function typeColour(index: number): string {
  return TYPE_COLOURS[((index % TYPE_COLOURS.length) + TYPE_COLOURS.length) % TYPE_COLOURS.length];
}

export function ragColor(rag: Rag): string {
  if (rag === 'R') return 'var(--color-accent-2)';
  if (rag === 'A') return 'var(--color-warning)';
  return 'var(--color-neutral-500)';
}

export interface ProjectView extends Project {
  phases: string[];
  phaseName: string;
  phaseStep: string;
  /** How far through the whole project it is: phases finished plus progress through this
      one, 0–100. `pct` on its own only measures the current phase. */
  overallPct: number;
  pips: { fill: number; bg: string }[];
  cust: boolean;
  /** The family's id — what the portfolio filters and colours by. */
  family: string;
  /** The family's name: "CDMO". What is said where there is only room for one word. */
  typeShort: string;
  /** The category under it: "Full". */
  categoryLabel: string;
  /** Both, for the places with room to say which way this project is being run. */
  typeLabel: string;
  facingLabel: string;
  /** Inner band of the stripe: who the work is for. Internal is the lighter tone. */
  stripe: string;
  /** Outer band of the stripe: which delivery type it is. */
  stripeType: string;
  sterileLabel: string;
  ragLabel: string;
  ragColor: string;
  pmName: string;
  burn: number;
  burnLabel: string;
  burnInk: string;
  burnInk2: string;
  loadLabel: string;
  /** Days this project draws from the whole team in the current month. */
  loadHours: number;
  loadDaysLabel: string;
  /** Its share of every day the portfolio draws this month, to one decimal. */
  loadSharePct: number;
  loadShareLabel: string;
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
  /** Contract value and billings converted to the base currency, for portfolio totals. */
  valueBase: number;
  billedBase: number;
  currencyLabel: string;
  msDateLabel: string;
  priorityLabel: string;
  startLabel: string;
  endLabel: string;
  /** Where the project's own plan says it runs, when one has been built. The stored
      dates are left alone: a plan informs the views, it does not rewrite the project. */
  plannedStart: string | null;
  plannedEnd: string | null;
  /** The last day of work in each phase of the plan, index-aligned to the phases. Empty
      where the plan has nothing in that phase. */
  planPhaseEnds: string[];
  /** Whether to read the dates above as planned or as entered by hand. */
  planned: boolean;
  /** The span every screen should draw — the plan where there is one, the entered dates
      otherwise. */
  spanStart: string;
  spanEnd: string;
  durationMonths: number;
}

/** Total resource a project draws from the whole team this month, as a share of one
    full-time month. 150% means the project consumes one and a half people. */
export function viewProject(
  project: Project,
  people: Person[],
  threshold: number,
  types: ProjectTypeDef[],
  families: ProjectFamily[],
  load = project.load,
  /** What one unit of the project's currency is worth in the base currency. */
  fx = 1,
  /** Hours this project draws this month, and every hour the portfolio draws in the same month. */
  draw: { hours: number; portfolioHours: number } = { hours: 0, portfolioHours: 0 },
  /** Where this project's own plan runs, if one has been built for it, and where each of
      its phases ends. */
  planSpan: { start: string; end: string } | null = null,
  planPhaseEnds: string[] = [],
): ProjectView {
  const sharePct = draw.portfolioHours ? (draw.hours / draw.portfolioHours) * 100 : 0;
  const typeDef = types.find((t) => t.id === project.type) ?? types[0];
  const family = families.find((f) => f.id === typeDef?.family) ?? families[0];
  const phases = typeDef?.phases ?? [];
  const cust = project.facing === 'C';
  const burn = project.budget ? Math.round((project.actual / project.budget) * 100) : 0;
  const pm = people.find((p) => p.id === project.pmId);
  const start = fromISO(project.startDate);
  /* The gates, after mirroring has had its say: the plan's own dates while that is ticked,
     otherwise what was typed on the project. */
  const gates =
    project.mirrorPhases && planPhaseEnds.length
      ? phases.map((_, i) => planPhaseEnds[i] || project.phaseDates[i] || '')
      : project.phaseDates;
  /* The last gate is the date the last phase completes, which is the date the project
     finishes — so once it is filled in it stands in for the end date typed on the project.
     The typed date is kept and comes back the moment the gate is cleared. */
  const endDate = (phases.length ? gates[phases.length - 1] : '') || project.endDate;
  const end = fromISO(endDate);
  return {
    ...project,
    endDate,
    phases,
    phaseName: phases[project.phase] ?? phases[0] ?? '—',
    phaseStep: `${project.phase + 1} of ${phases.length}`,
    overallPct: phases.length
      ? Math.max(0, Math.min(100, Math.round(((project.phase + project.pct / 100) / phases.length) * 100)))
      : project.pct,
    /* One pip per phase, each a track with a fill: full for a phase that is done, empty
       for one still to come, and part-filled for the phase in hand — so the stepper shows
       how far through the current phase the work is, not just which phase it is. */
    pips: phases.map((_, i) => ({
      fill: i < project.phase ? 100 : i === project.phase ? Math.max(0, Math.min(100, project.pct)) : 0,
      bg: i < project.phase ? 'var(--color-text)' : 'var(--color-accent)',
    })),
    cust,
    family: family?.id ?? typeDef?.family ?? '',
    typeShort: family?.label ?? project.type,
    categoryLabel: typeDef?.label ?? '',
    /* Both, in the order they are read: the kind of work, then the way it is being run. A
       family with one way of running it says only its own name — there is nothing to tell
       apart, and "CDMO · Full" would be saying it twice. */
    typeLabel:
      typeDef && families.length && types.filter((t) => t.family === typeDef.family).length > 1
        ? `${family?.label ?? ''} · ${typeDef.label}`
        : family?.label ?? project.type,
    facingLabel: cust ? 'Customer' : 'Internal',
    stripe: cust ? 'var(--color-text)' : 'var(--color-neutral-300)',
    // Colour belongs to the family, so every way of running CDMO work reads as CDMO.
    stripeType: typeColour(families.findIndex((f) => f.id === typeDef?.family)),
    sterileLabel: project.sterile ? 'Sterile' : 'Non-sterile',
    ragLabel: RAG_LABEL[project.rag],
    ragColor: ragColor(project.rag),
    pmName: pm?.name ?? 'Unassigned',
    burn,
    burnLabel: `${burn}%`,
    burnInk:
      burn > 95 ? 'var(--color-accent-2-700)' : burn > threshold ? 'var(--color-accent-700)' : 'var(--color-text)',
    burnInk2: burn > 95 ? 'var(--color-accent-2)' : 'var(--color-text)',
    load,
    loadLabel: `${load}%`,
    loadHours: draw.hours,
    loadDaysLabel: days(draw.hours),
    loadSharePct: sharePct,
    loadShareLabel: `${sharePct.toFixed(1)}% of the portfolio's draw this month`,
    loadColor:
      load >= 200 ? 'var(--color-accent-2)' : load >= 100 ? 'var(--color-warning)' : 'var(--color-neutral-500)',
    loadInk: load >= 200 ? 'var(--color-accent-2-700)' : 'var(--color-text)',
    budgetLabel: money(project.budget),
    actualLabel: money(project.actual),
    remainLabel: money(project.budget - project.actual),
    valueLabel: money(project.value, project.currency),
    billedLabel: moneyOrZero(project.billed, project.currency),
    toBillLabel: money(project.value - project.billed, project.currency),
    moneyLabel: cust ? 'Invoiced' : 'Budget drawn',
    moneyMain: cust ? moneyOrZero(project.billed, project.currency) : money(project.actual),
    moneySub: cust
      ? `of ${money(project.value, project.currency)} value`
      : `of ${money(project.budget)} pool`,
    valueBase: Math.round(project.value * fx),
    billedBase: Math.round(project.billed * fx),
    currencyLabel: `${CURRENCIES[project.currency]?.symbol ?? '£'} ${project.currency}`,
    msDateLabel: shortDate(project.milestoneDate),
    priorityLabel: PRIORITY_LABEL[project.priority] ?? 'Normal',
    startLabel: monthLabel(start),
    endLabel: monthLabel(end),
    plannedStart: planSpan?.start ?? null,
    plannedEnd: planSpan?.end ?? null,
    planPhaseEnds,
    /* Mirroring swaps the typed gates for the plan's own, without touching what was
       typed — unticking the box gives those dates straight back. */
    phaseDates: gates,
    planned: Boolean(planSpan),
    spanStart: planSpan?.start ?? project.startDate,
    spanEnd: planSpan?.end ?? endDate,
    durationMonths: monthSpan(start, end),
  };
}

/** Annual leave as a share of a full-time month, so it is comparable with booked work.
    A part-timer's day off costs the same slice of the calendar as anyone else's. */
export function leavePct(days: number): number {
  return Math.round((days / WORKING_DAYS_PER_MONTH) * 100);
}

export interface PersonView {
  person: Person;
  /** Project work booked, % of a full-time month. */
  loads: number[];
  /** The same work as booked — hours per month. */
  bookedHours: number[];
  /** Every day off — their own leave plus the public holidays everybody takes. */
  leaveDays: number[];
  /** Just the days they booked themselves, which is what the leave table edits. */
  ownLeaveDays: number[];
  /** That leave as a share of the month. */
  leaveLoads: number[];
  /** Meetings, admin and the rest, as a share of a full-time month. The same every month —
      what this person does in a month with room for it. */
  overheadLoad: number;
  /** What is left for that non-project work once the projects and the days off have taken
      their share: the same figure, cut back where the month would otherwise go past full. */
  overheadLoads: number[];
  /** Project work plus leave plus non-project work — what consumes the person's month. */
  committed: number[];
  peak: number;
  peakMonthIndex: number;
  /** Names of the projects this person is booked on, in the planning window. */
  projectNames: string[];
}

export interface RoleShortage {
  role: string;
  /** Consecutive months where the whole role is oversubscribed. */
  months: string[];
  /** Largest gap over the role's combined capacity, in people. */
  worstGap: number;
  /** How many people hold this title. */
  headcount: number;
}

export interface PortfolioView {
  projects: ProjectView[];
  archivedProjects: ProjectView[];
  people: Person[];
  /** People who have left. Their bookings are still in the record. */
  archivedPeople: Person[];
  peopleViews: PersonView[];
  /** `YYYY-MM` keys for the six planning months. */
  months: string[];
  monthLabels: string[];
  threshold: number;
  demand: number[];
  /** Days off everybody takes, per planning month. */
  publicHolidays: number[];
  /** Headcount, ignoring leave. */
  capacity: number;
  /** Capacity actually available each month once leave and non-project work are taken out. */
  capacityByMonth: number[];
  /** People-worth of time the team spends on meetings, admin and the rest. */
  overhead: number;
  /** `YYYY-MM` the last live project finishes in — the soft edge of what is worth planning. */
  lastEndMonth: string | null;
  /** Months from the window start to that end, so the window can be stretched to cover it. */
  monthsToLastEnd: number;
  roles: string[];
  projectTypes: ProjectTypeDef[];
  families: ProjectFamily[];
  /** The categories under a family, in the order they were added. */
  categoriesOf: (familyId: string) => ProjectTypeDef[];
  /** Roles oversubscribed for 3+ months running, where no colleague of the same
      title has room to absorb the overspill. */
  roleShortages: RoleShortage[];
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
  /** The months a project can be booked across: the planning window, stretched forward so
      it always reaches the project's own end date. Booking has to be possible for every
      month the work actually runs, whatever the window happens to be set to. */
  monthsFor: (project: { id?: string; startDate: string; endDate: string }) => {
    months: string[];
    labels: string[];
  };
  /** Projects whose bookings come from their plan — theirs are read-only. */
  planBooked: Set<string>;
  allocationsFor: (projectId: string, months?: string[]) => { person: Person; hours: number[]; loads: number[]; totalHours: number }[];
  /** This project's bookings in hours, keyed `${personId}|${month}`, for the edit form. */
  allocationsOf: (projectId: string, months?: string[]) => Record<string, number>;
  /** One person's booking across every project they touch, month by month. */
  spreadFor: (personId: string) => { project: ProjectView; hours: number[]; loads: number[]; totalHours: number }[];
  /** Everyone's booked hours with one project left out, so the form can warn on unsaved edits. */
  loadsExcluding: (projectId: string, forMonths?: string[]) => Record<string, number[]>;
  today: Date;
}

/** Worst first, so a status column sorts the way a delivery lead reads it. */
export const RAG_ORDER = { R: 0, A: 1, G: 2 } as const;

export function usePortfolioView(portfolio: Portfolio): PortfolioView {
  return useMemo(() => {
    const today = new Date();
    const months = monthsFrom(portfolio.window.startMonth, portfolio.window.months);
    const loadPerMonth = new Map<string, number[]>();
    // Long windows repeat month names across years, so they carry the year too.
    const monthLabels = months.map((m) => (portfolio.window.months > 12 ? monthKeyLabel(m) : shortMonth(m)));
    const { threshold } = portfolio;
    /* One set of bookings for the whole app. Projects booking their people from a plan have
       their stored bookings set aside and the plan's own put in their place, so resourcing,
       the alerts and the portfolio's draw all move together when the switch is thrown. */
    const allocations = effectiveAllocations(portfolio);
    const planBooked = planBookedProjects(portfolio);
    /* Archived people leave every screen but the archive. Their bookings stay in the
       store, so what a project drew historically is still true; only the planning
       forward stops counting them. The full list is kept for looking up names. */
    const allPeople = portfolio.people;
    const people = allPeople.filter((p) => !p.archived);
    const archivedPeople = allPeople.filter((p) => p.archived);

    /* Project draw is the sum of everyone's booked hours on it, month by month. */
    Object.entries(allocations).forEach(([key, hours]) => {
      const [projectId, , month] = key.split('|');
      const monthIndex = months.indexOf(month);
      if (monthIndex < 0) return;
      const perMonth = loadPerMonth.get(projectId) ?? months.map(() => 0);
      perMonth[monthIndex] += hours;
      loadPerMonth.set(projectId, perMonth);
    });
    /* Team draw reports the current month — the month the window starts on — because that
       is the demand a lead is deciding about now. The peak is still available per month. */
    const drawHours = (id: string) => loadPerMonth.get(id)?.[0] ?? 0;
    // Archived work is out of the portfolio, so it is out of the share each project takes.
    const portfolioHours = portfolio.projects
      .filter((p) => !p.archived)
      .reduce((n, p) => n + drawHours(p.id), 0);

    /* Each project that has opted into planning is scheduled once here, so the timeline can
       draw what its plan actually says rather than the dates typed on it. The stored dates
       are untouched, and a project that has not opted in behaves exactly as it always did
       — which is what the toggle on the Planning screen turns on and off. */
    const planned = new Map<string, { start: string; end: string }>();
    const tasksByProject = new Map<string, Task[]>();
    (portfolio.tasks ?? []).forEach((t) => {
      tasksByProject.set(t.projectId, [...(tasksByProject.get(t.projectId) ?? []), t]);
    });
    const phaseEnds = new Map<string, string[]>();
    tasksByProject.forEach((list, projectId) => {
      const project = portfolio.projects.find((p) => p.id === projectId);
      if (!project?.usesPlan) return;
      const plan = schedule(list, project.startDate);
      /* Every screen reads the start and end typed on the project unless its gates are
         mirrored from the plan — ticking that box is what says the plan is the truth. */
      if (project.mirrorPhases && plan.start && plan.end) {
        planned.set(projectId, { start: plan.start, end: plan.end });
      }
      // The gate for a phase is the last day of work anywhere inside it.
      const ends: string[] = [];
      list.forEach((task) => {
        const at = plan.byId.get(task.id);
        if (!at) return;
        if (!ends[task.phase] || at.endDate > ends[task.phase]) ends[task.phase] = at.endDate;
      });
      phaseEnds.set(projectId, ends);
    });

    const allProjectViews = portfolio.projects.map((p) =>
      viewProject(
        p,
        allPeople,
        threshold,
        portfolio.projectTypes,
        portfolio.families,
        Math.round(hoursToPct(drawHours(p.id))),
        portfolio.fxToBase[p.currency] ?? 1,
        { hours: drawHours(p.id), portfolioHours },
        planned.get(p.id) ?? null,
        phaseEnds.get(p.id) ?? [],
      ),
    );
    // Archived work keeps its data but is invisible to every screen except the archive.
    const projects = allProjectViews.filter((p) => !p.archived);
    const archivedProjects = allProjectViews.filter((p) => p.archived);

    const projectById = new Map(portfolio.projects.map((p) => [p.id, p]));
    const loadIndex = new Map<string, number[]>();
    const bookedOn = new Map<string, Set<string>>();
    people.forEach((person) => {
      loadIndex.set(person.id, months.map(() => 0));
      bookedOn.set(person.id, new Set());
    });
    Object.entries(allocations).forEach(([key, hours]) => {
      const [projectId, personId, month] = key.split('|');
      const monthIndex = months.indexOf(month);
      const booked = loadIndex.get(personId);
      const project = projectById.get(projectId);
      if (monthIndex < 0 || !booked || !project) return;
      booked[monthIndex] += hours;
      bookedOn.get(personId)?.add(project.name);
    });

    /* Public holidays are entered once and cost everybody the same days, so they are added
       to each person's own leave rather than tracked separately downstream. */
    const publicHolidays = months.map((m) => portfolio.publicHolidays[m] ?? 0);

    const peopleViews: PersonView[] = people.map((person) => {
      /* Booked hours become a share of a full-time month here, once, so every graph and
         threshold downstream still reads in whole percentages. */
      const bookedHours = loadIndex.get(person.id) ?? months.map(() => 0);
      const loads = bookedHours.map((h) => Math.round(hoursToPct(h)));
      const ownLeaveDays = months.map((m) => portfolio.leave[`${person.id}|${m}`] ?? 0);
      const leaveDays = ownLeaveDays.map((d, i) =>
        Math.min(person.workingDays, d + publicHolidays[i]),
      );
      const leaveLoads = leaveDays.map(leavePct);
      /* Non-project work is a share of this person's own time, so a part-timer's 20% is
         20% of their shorter month. Held as a share of a full month like everything else. */
      const overheadLoad = Math.round((person.capacity * (person.overheadPct ?? 0)) / 100);
      /* Meetings and admin are the elastic part of a month: they are what a person drops
         when the projects and their days off have taken the rest of it. So the standing
         figure above is what they would do in a quiet month, and this is what is actually
         left for it once everything fixed has been counted — which stops a month reading as
         over-committed when the only thing spilling over is work that would simply not
         happen. A month past full here means the projects and the leave alone are past it. */
      const overheadLoads = loads.map((v, i) =>
        Math.max(0, Math.min(overheadLoad, person.capacity - v - leaveLoads[i])),
      );
      const committed = loads.map((v, i) => v + leaveLoads[i] + overheadLoads[i]);
      const peak = committed.length ? Math.max(...committed) : 0;
      return {
        person,
        loads,
        bookedHours,
        leaveDays,
        ownLeaveDays,
        leaveLoads,
        overheadLoad,
        overheadLoads,
        committed,
        peak,
        peakMonthIndex: committed.indexOf(peak),
        projectNames: [...(bookedOn.get(person.id) ?? [])],
      };
    });

    const demand = months.map((_, i) => peopleViews.reduce((n, p) => n + p.loads[i], 0) / 100);
    const capacity = people.reduce((n, p) => n + p.capacity, 0) / 100;
    // Leave and non-project work both come straight off what is available to book.
    const capacityByMonth = months.map(
      (_, i) =>
        peopleViews.reduce((n, p) => n + Math.max(0, p.person.capacity - p.leaveLoads[i] - p.overheadLoad), 0) / 100,
    );
    // What the whole team loses to meetings and admin, in people. Constant across the window.
    const overhead = peopleViews.reduce((n, p) => n + p.overheadLoad, 0) / 100;

    /* A role is short when the work booked to everyone holding that title exceeds their
       combined capacity for the month — meaning the overspill cannot be handed to a
       colleague who does the same job. Three months running makes it structural rather
       than a bad fortnight. */
    const roleShortages: RoleShortage[] = [];
    const rolesInUse = [...new Set(people.map((p) => p.role))];
    rolesInUse.forEach((role) => {
      const holders = peopleViews.filter((p) => p.person.role === role);
      if (!holders.length) return;
      const gaps = months.map((_, i) => {
        const booked = holders.reduce((n, p) => n + p.loads[i], 0);
        const available = holders.reduce(
          (n, p) => n + Math.max(0, p.person.capacity - p.leaveLoads[i] - p.overheadLoad),
          0,
        );
        return (booked - available) / 100;
      });
      let run: number[] = [];
      const flush = () => {
        if (run.length >= 3) {
          roleShortages.push({
            role,
            months: run.map((i) => monthLabels[i]),
            worstGap: Math.max(...run.map((i) => gaps[i])),
            headcount: holders.length,
          });
        }
        run = [];
      };
      gaps.forEach((gap, i) => {
        if (gap > 0) run.push(i);
        else flush();
      });
      flush();
    });

    /* How far out there is anything to look at. Used as a soft limit: the window can be
       stretched to cover every live project without guessing a number. */
    const lastEnd = projects.reduce<string>((latest, p) => (p.endDate > latest ? p.endDate : latest), '');
    const lastEndMonth = lastEnd ? lastEnd.slice(0, 7) : null;
    const monthsToLastEnd = lastEndMonth ? monthsBetween(months[0], lastEndMonth) + 1 : 0;

    const customer = projects.filter((p) => p.cust);
    const internal = projects.filter((p) => !p.cust);
    // Totals mix currencies, so they are added up in the base currency.
    const value = customer.reduce((n, p) => n + p.valueBase, 0);
    const billed = customer.reduce((n, p) => n + p.billedBase, 0);

    /** One booking row: the hours as entered, and the same time as a share of the month. */
    const row = (hours: number[]) => ({
      hours,
      loads: hours.map((h) => Math.round(hoursToPct(h))),
      totalHours: hours.reduce((n, v) => n + v, 0),
    });

    /* Every month a project could have a booking in: its own life, the resourcing window,
       and anything already booked outside both — a project whose dates were pulled in after
       the work was booked still has those hours, and the edit pane speaks for every month it
       shows, so a month left out of it would be dropped on the next save. */
    const monthsFor = (project: { id?: string; startDate: string; endDate: string }) => {
      let first = project.startDate.slice(0, 7);
      let last = project.endDate.slice(0, 7);
      if (months[0] < first) first = months[0];
      if (months[months.length - 1] > last) last = months[months.length - 1];
      if (project.id) {
        const prefix = `${project.id}|`;
        Object.keys(allocations).forEach((key) => {
          if (!key.startsWith(prefix)) return;
          const month = key.split('|')[2];
          if (month < first) first = month;
          if (month > last) last = month;
        });
      }
      const full = monthsFrom(first, Math.min(monthsBetween(first, last) + 1, 240));
      return {
        months: full,
        labels: full.map((m) => (full.length > 12 ? monthKeyLabel(m) : shortMonth(m))),
      };
    };

    const allocationsFor = (projectId: string, over: string[] = months) =>
      people
        .map((person) => ({ person, ...row(over.map((m) => allocations[`${projectId}|${person.id}|${m}`] ?? 0)) }))
        .filter((r) => r.totalHours > 0);

    const allocationsOf = (projectId: string, over: string[] = months) => {
      const out: Record<string, number> = {};
      people.forEach((person) => {
        over.forEach((month) => {
          const hours = allocations[`${projectId}|${person.id}|${month}`];
          if (hours) out[`${person.id}|${month}`] = hours;
        });
      });
      return out;
    };

    const spreadFor = (personId: string) =>
      projects
        .map((project) => ({ project, ...row(months.map((m) => allocations[`${project.id}|${personId}|${m}`] ?? 0)) }))
        .filter((r) => r.totalHours > 0)
        .sort((a, b) => b.totalHours - a.totalHours);

    /** Hours each person carries from every *other* project, so the form can warn live.
        The months are given, because the edit pane covers the project's own life rather
        than the resourcing window and the two rarely line up. */
    const loadsExcluding = (projectId: string, forMonths: string[] = months) => {
      const out: Record<string, number[]> = {};
      const at = new Map(forMonths.map((m, i) => [m, i]));
      people.forEach((person) => {
        out[person.id] = forMonths.map(() => 0);
      });
      Object.entries(allocations).forEach(([key, hours]) => {
        const [pid, personId, month] = key.split('|');
        if (pid === projectId || !projectById.has(pid)) return;
        const i = at.get(month);
        const row = out[personId];
        if (i === undefined || !row) return;
        row[i] += hours;
      });
      return out;
    };

    return {
      projects,
      archivedProjects,
      people,
      archivedPeople,
      peopleViews,
      months,
      monthLabels,
      threshold,
      demand,
      publicHolidays,
      capacity,
      capacityByMonth,
      overhead,
      lastEndMonth,
      monthsToLastEnd,
      roles: portfolio.roles,
      projectTypes: portfolio.projectTypes,
      families: portfolio.families,
      categoriesOf: (familyId: string) => portfolio.projectTypes.filter((x) => x.family === familyId),
      roleShortages,
      totals: {
        value,
        billed,
        toBill: value - billed,
        internalBudget: internal.reduce((n, p) => n + p.budget, 0),
        internalDrawn: internal.reduce((n, p) => n + p.actual, 0),
        customerCount: customer.length,
        internalCount: internal.length,
        atRisk: projects.filter((p) => p.rag === 'R').length,
        shortOfPeople: projects.filter((project) =>
          peopleViews.some(
            (pv) =>
              pv.committed.some((v, i) => v > (pv.person.capacity * threshold) / 100 && (allocations[`${project.id}|${pv.person.id}|${months[i]}`] ?? 0) > 0),
          ),
        ).length,
      },
      monthsFor,
      planBooked,
      allocationsFor,
      allocationsOf,
      spreadFor,
      loadsExcluding,
      today,
    };
  }, [portfolio]);
}
