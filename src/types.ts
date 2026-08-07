/** A project type's id. Types are user-defined, so this is a plain string. */
export type ProjectType = string;

export interface ProjectTypeDef {
  id: string;
  label: string;
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
}

/** The invoice schedule every customer-facing project bills against. */
export const INVOICE_STAGES: [label: string, share: number][] = [
  ['On kick-off', 0.3],
  ['At design freeze', 0.3],
  ['At validation', 0.25],
  ['On handover', 0.15],
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
}

/** Keyed `${projectId}|${personId}|${YYYY-MM}` → % of that person's week. */
export type Allocations = Record<string, number>;

/** Keyed `${personId}|${YYYY-MM}` → days of annual leave booked that month. */
export type Leave = Record<string, number>;

export interface Portfolio {
  projects: Project[];
  people: Person[];
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
}

/** A full-time month, the yardstick every load percentage is measured against. */
export const WORKING_DAYS_PER_MONTH = 21;

/** Projects and resourcing can be planned out to the end of this year. */
export const MAX_YEAR = 2040;
export const MAX_DATE = `${MAX_YEAR}-12-31`;
