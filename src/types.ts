export type ProjectType = 'CS' | 'CDMO';
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
}

export interface Person {
  id: string;
  name: string;
  role: string;
  /** Which delivery type a project manager works across; blank for specialists. */
  discipline: string;
  /** Working week available to projects, %. */
  capacity: number;
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
  /** Load above which a person counts as over-allocated, %. */
  threshold: number;
}

/** Working days in an average month, for turning leave days into a share of capacity. */
export const WORKING_DAYS_PER_MONTH = 21;
