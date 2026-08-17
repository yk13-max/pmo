/** A project type's id. Types are user-defined, so this is a plain string. */
export type ProjectType = string;

/* Delivery work comes in kinds — CDMO, Client Solutions — and each kind is run more than one
   way. A family is the kind; a category under it is one way of running it, with its own
   phases. "CDMO · Full" is the whole seven-phase route; a shorter one alongside it is another
   category of the same family.

   The family is what the business is organised around: it decides a project's colour, who is
   allowed to work on it, and what the portfolio is filtered by. The category decides the
   phases, which is why anything comparing projects phase by phase has to be looking at one
   category at a time. */
export interface ProjectFamily {
  id: string;
  label: string;
  /** Written out in full, for the places with room to say it properly. */
  fullName?: string;
}

export interface ProjectTypeDef {
  id: string;
  /** The category's own name — "Full", "Fill-finish only". The family names the kind. */
  label: string;
  /** The category written out in full. Short labels do the work everywhere space is tight;
      this is what gets said where there is room to say it properly. */
  fullName?: string;
  /** Which family this category belongs to. */
  family: string;
  /** Ordered phases a project of this category passes through. */
  phases: string[];
  /** The milestone that closes each phase, offered as the default. */
  milestones: string[];
}
export type Facing = 'C' | 'I';
export type Rag = 'G' | 'A' | 'R';

/** The plan as it was agreed: what a project's dates and money were at the moment somebody
    said "this is the plan". Everything the project has done since is read against it. */
export interface Baseline {
  /** When the snapshot was taken. */
  takenAt: string;
  startDate: string;
  endDate: string;
  /** The gates as they stood, index-aligned to the type's phases. */
  phaseDates: string[];
  budget: number;
  value: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  type: ProjectType;
  facing: Facing;
  /** Index into PHASES[type]. */
  phase: number;
  /** How much of the plan is finished, 0–100. */
  pct: number;
  rag: Rag;
  pmId: string;
  /** All money in £ thousands. */
  budget: number;
  actual: number;
  /** Agreed contract value; 0 for internal work. */
  value: number;
  billed: number;
  /** Share of the assigned team's working week this project takes, %. */
  load: number;
  startDate: string;
  endDate: string;
  milestone: string;
  milestoneDate: string;
  /** 1 = highest. Set by the PMO, used for ranking and callouts. */
  priority: number;
  /** Planned end date for each phase of this project's type, ISO, index-aligned to phases. */
  phaseDates: string[];
  /** Date each invoice stage is expected to be raised, ISO, aligned to INVOICE_STAGES. */
  invoiceDates: string[];
  /** The agreed plan, taken when baselining is first engaged. Kept when the comparison is
      switched off, so turning it back on does not lose the history. */
  baseline?: Baseline;
  /** Whether the detail screen reads the project against its baseline. */
  showBaseline?: boolean;
  /** When each phase actually completed, index-aligned to the type's phases. Only asked for
      once actuals are engaged, and blank for anything not finished. */
  actualDates?: string[];
  /** When the work actually started. */
  actualStart?: string;
  /** Whether the detail screen shows what actually happened beside what was planned. */
  showActuals?: boolean;
  /** Who sold the work, where somebody is named for it. Free text rather than a person on
      the team: a sales lead is often not somebody the tracker books time for. */
  salesLead?: string;
  /** Whatever the business calls this project in its own systems — a job number, a contract
      reference, a code. Optional and free text, because every organisation numbers its work
      differently and none of them number it the way an id does. */
  number?: string;
  /** Archived projects keep all their data but drop out of every screen. */
  archived?: boolean;
  /** Work that is not running at the moment — on hold, awaiting a decision, between
      contracts. It keeps its place in the project data and everything booked on it, but it
      is out of the portfolio and draws nobody's time until it is made active again. Not the
      same as archived: that is for work that is finished with. */
  inactive?: boolean;
  /** Currency the client is invoiced in. Budget and spend stay in the base currency. */
  currency: CurrencyCode;
  /** Whether the product is sterile. Only asked of Client Solutions work. */
  sterile?: boolean;
  /** Whether this project's dates come from a task plan. Off by default: a project keeps
      the start, end and phase dates entered on it until someone chooses to plan it out. */
  usesPlan?: boolean;
  /** Whether the phase gates follow the plan rather than the dates typed on the project.
      The typed dates are kept either way, so unticking gives them back. */
  mirrorPhases?: boolean;
  /** Whether the plan books its people, instead of the bookings being typed by hand. */
  plansResource?: boolean;
  /** When the plan's tasks were last baselined. The baseline itself lives on the tasks. */
  planBaselineAt?: string;
  /** Whether the plan is read against that baseline. */
  showPlanBaseline?: boolean;
  /** Whether the plan shows what actually happened beside what was planned. */
  showPlanActuals?: boolean;
}

/** The family that carries the sterile question. It is asked of the kind of work rather than
    of the way a particular project of it is run, so every category under it is asked. */
export const STERILE_FAMILY = 'CS';

/* An invoice a project expects to raise: what it is for, what it is worth, and when.

   It can stand on its own, or it can be tied to a phase gate or a task. The tie drives
   nothing — it does not move the date, and the date does not move the plan. What it does is
   let the two disagree out loud: an invoice raised on handover cannot be raised before the
   handover happens, so if the thing it is tied to now finishes after the invoice is due, the
   date says so in red. That is a conversation to have, not a number to correct automatically:
   the answer might be to move the invoice, or to move the work, or to accept it. */
export interface Invoice {
  id: string;
  projectId: string;
  /** What the invoice is for, as it would be written on it. */
  label: string;
  /** In thousands of the project's own currency. */
  amount: number;
  /** When it is expected to be raised. */
  due: string;
  /** The phase whose gate it waits on, as an index into the type's phases. */
  phase?: number;
  /** The task it waits on. */
  taskId?: string;
}

/** The points a customer-facing project raises an invoice at. What each one is worth is
    agreed with the client project by project, so no share is assumed here. */
export const INVOICE_STAGES: string[] = [
  'On kick-off',
  'At design freeze',
  'At validation',
  'On handover',
];

export const PRIORITY_LEVELS = [1, 2, 3, 4, 5] as const;
export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Normal',
  4: 'Low',
  5: 'Watching brief',
};

export interface Person {
  id: string;
  name: string;
  role: string;
  /** Project types this person works across. Empty means all of them. */
  types: string[];
  /** Share of a full-time month available to projects, %. Derived from workingDays. */
  capacity: number;
  /** Normal working days per month. Below full time means part time. */
  workingDays: number;
  /** Share of their own working time that never reaches a project — meetings, admin,
      training, line management. Comes off what is available to book, %. */
  overheadPct: number;
  /** Archived people keep every booking and day off; they drop out of every screen but
      the archive, so the history of what they worked on survives them leaving. */
  archived?: boolean;
}

/** How one task waits on another, in the four forms a project planner expects.
    FS: start after it finishes. SS: start together. FF: finish together.
    SF: finish after it starts. */
export type DepType = 'FS' | 'SS' | 'FF' | 'SF';

export const DEP_TYPES: DepType[] = ['FS', 'SS', 'FF', 'SF'];

export interface Dep {
  /** The task waited on. */
  id: string;
  type: DepType;
  /** Working days of slack after the link is satisfied. Negative pulls the task earlier. */
  lag: number;
}

/** The eight ways Microsoft Project lets a date be pinned down.
    ASAP and ALAP need no date; the other six are measured against one. */
export type ConstraintType = 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';

export const CONSTRAINTS: { id: ConstraintType; label: string; needsDate: boolean; hint: string }[] = [
  { id: 'ASAP', label: 'As soon as possible', needsDate: false, hint: 'Starts the moment everything it waits on allows.' },
  { id: 'ALAP', label: 'As late as possible', needsDate: false, hint: 'Slides as late as it can go without delaying the finish.' },
  { id: 'SNET', label: 'Start no earlier than', needsDate: true, hint: 'Never starts before this date, whatever the links allow.' },
  { id: 'SNLT', label: 'Start no later than', needsDate: true, hint: 'Must have started by this date; later is a conflict.' },
  { id: 'FNET', label: 'Finish no earlier than', needsDate: true, hint: 'Cannot be finished before this date.' },
  { id: 'FNLT', label: 'Finish no later than', needsDate: true, hint: 'Must be finished by this date; later is a conflict.' },
  { id: 'MSO', label: 'Must start on', needsDate: true, hint: 'Pinned to this start, links or no links.' },
  { id: 'MFO', label: 'Must finish on', needsDate: true, hint: 'Pinned to this finish, links or no links.' },
];

/** A piece of work inside one phase of one project. */
export interface Task {
  id: string;
  projectId: string;
  /** Which of the project type's phases this sits under. */
  phase: number;
  name: string;
  /** Who is doing it, as typed. Kept alongside `ownerId` so a plan built before people
      were linked still reads, and so the name survives in an exported sheet. */
  owner: string;
  /** The person on the team it draws from, when the plan is booking people. */
  ownerId?: string;
  /** How much of that person's day the task takes, 0–100. Half of a two-day task is one
      day of their time — eight hours — not two. */
  weight?: number;
  /** Working days of work. A task always occupies at least one. */
  days: number;
  /** How this task is pinned to the calendar. */
  constraint: ConstraintType;
  /** The date the constraint is measured against. Ignored by ASAP and ALAP, but kept, so
      switching away and back does not lose the date that was typed. */
  constraintDate: string;
  /** What has to happen first. */
  deps: Dep[];
  /** How far through it is, 0–100. */
  done: number;
  /* The plan as it was agreed, frozen onto the task when the plan is baselined. Dates rather
     than a duration, because what a reader wants is "it was going to finish on the 14th" —
     and because a task's dates move when anything it waits on moves, whether or not its own
     length changed. */
  baseStart?: string;
  baseFinish?: string;
  /** Working days it was given at the time, so a task that grew can be told from one that
      simply slid. */
  baseDays?: number;
  /* What actually happened. Typed as the work runs; the schedule is never rewritten from
     them, because a plan that quietly agreed with reality would have nothing to report. */
  actualStart?: string;
  actualFinish?: string;
}

/** Keyed `${projectId}|${personId}|${YYYY-MM}` → hours booked that month. */
export type Allocations = Record<string, number>;

/** Keyed `${personId}|${YYYY-MM}` → days of annual leave booked that month. */
export type Leave = Record<string, number>;

/** Keyed `YYYY-MM` → days everybody loses that month (public holidays, shutdowns). */
export type PublicHolidays = Record<string, number>;

export type CurrencyCode = 'GBP' | 'USD' | 'EUR';

export const CURRENCIES: Record<CurrencyCode, { symbol: string; label: string }> = {
  GBP: { symbol: '£', label: 'Pounds' },
  USD: { symbol: '$', label: 'US dollars' },
  EUR: { symbol: '€', label: 'Euros' },
};

export interface Portfolio {
  projects: Project[];
  /** Invoices a project expects to raise. Empty until somebody lists them. */
  invoices: Invoice[];
  people: Person[];
  /** Every project's plan, in one list. A project with none simply has no plan yet. */
  tasks: Task[];
  allocations: Allocations;
  leave: Leave;
  /** Job titles available when adding someone. Editable on the Data screen. */
  roles: string[];
  /** Delivery types and their phase lists. Editable on the Data screen. */
  /** The kinds of work. Every category belongs to one of these. */
  families: ProjectFamily[];
  /** The categories, each under a family, each with its own phases. */
  projectTypes: ProjectTypeDef[];
  /** Load above which a person counts as over-allocated, %. */
  threshold: number;
  /** The months resourcing plans across. */
  window: { startMonth: string; months: number };
  /** Days off that apply to everyone, so they need entering only once. */
  publicHolidays: PublicHolidays;
  /** What one unit of each currency is worth in the base currency, for portfolio totals. */
  fxToBase: Record<CurrencyCode, number>;
  /** Marks allocations as hours. Stores written before the switch held percentages. */
  allocationUnit: 'hours';
}

/** Totals across a mixed-currency portfolio are expressed in this. */
export const BASE_CURRENCY: CurrencyCode = 'GBP';

/** A full-time month, the yardstick every load percentage is measured against. */
export const WORKING_DAYS_PER_MONTH = 21;

/** Time is booked in hours; every figure reported back is in days. */
export const WORKING_HOURS_PER_DAY = 8;
export const HOURS_PER_FULL_MONTH = WORKING_DAYS_PER_MONTH * WORKING_HOURS_PER_DAY;

/** Projects and resourcing can be planned out to the end of this year. */
export const MAX_YEAR = 2040;
export const MAX_DATE = `${MAX_YEAR}-12-31`;
