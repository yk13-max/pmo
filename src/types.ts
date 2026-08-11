/** A project type's id. Types are user-defined, so this is a plain string. */
export type ProjectType = string;

export interface ProjectTypeDef {
  id: string;
  label: string;
  /** The type written out in full. Short labels do the work everywhere space is tight;
      this is what gets said where there is room to say it properly. */
  fullName?: string;
  /** Ordered phases a project of this type passes through. */
  phases: string[];
  /** The milestone that closes each phase, offered as the default. */
  milestones: string[];
}
export type Facing = 'C' | 'I';
export type Rag = 'G' | 'A' | 'R';

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
  /** Archived projects keep all their data but drop out of every screen. */
  archived?: boolean;
  /** Currency the client is invoiced in. Budget and spend stay in the base currency. */
  currency: CurrencyCode;
  /** Whether the product is sterile. Only asked of Client Solutions work. */
  sterile?: boolean;
}

/** The delivery type that carries the sterile question. */
export const STERILE_TYPE = 'CS';

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
  /** Who is doing it — a name, not a person on the team. Resourcing is not linked yet. */
  owner: string;
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
  people: Person[];
  /** Every project's plan, in one list. A project with none simply has no plan yet. */
  tasks: Task[];
  allocations: Allocations;
  leave: Leave;
  /** Job titles available when adding someone. Editable on the Data screen. */
  roles: string[];
  /** Delivery types and their phase lists. Editable on the Data screen. */
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
