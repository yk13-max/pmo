import type { ProjectFamily, ProjectTypeDef } from '../types';

const PHASES: Record<string, string[]> = {
  CS: ['Production Trial', 'V&V', 'Sterilisation', 'Handover'],
  CDMO: [
    'Pre-Project',
    'Planning & Feasibility',
    'Design Inputs',
    'Design Outputs',
    'Product & Process V&V',
    'Production & Market Readiness',
    'Product Launch & Post-Launch',
  ],
};

/** The milestone that closes each phase — the default offered when a phase is picked. */
const PHASE_MILESTONES: Record<string, string[]> = {
  CS: ['Trial batch released', 'V&V protocol sign-off', 'Sterilisation validation', 'Handover pack accepted'],
  CDMO: [
    'Kick-off approved',
    'Feasibility report issued',
    'Design inputs frozen',
    'Design outputs released',
    'V&V report complete',
    'PPQ lots released',
    'Post-launch review',
  ],
};

/** The name a category gets when it is the only way a family is run. */
export const DEFAULT_CATEGORY = 'Full';

/** Shipped defaults. Once a portfolio exists these live in its own data and are editable. */
export const DEFAULT_FAMILIES: ProjectFamily[] = [
  { id: 'CS', label: 'Client Solutions', fullName: 'Client Solutions' },
  { id: 'CDMO', label: 'CDMO', fullName: 'Contract Development Manufacturing Organisation' },
];

/* One category each to begin with, holding the phases each kind of work has always had.
   Another way of running either — a shorter route, a sterile variant — is a category added
   beside these with its own phases. */
export const DEFAULT_PROJECT_TYPES: ProjectTypeDef[] = [
  {
    id: 'CS',
    label: DEFAULT_CATEGORY,
    fullName: 'The full Client Solutions route',
    family: 'CS',
    phases: PHASES.CS,
    milestones: PHASE_MILESTONES.CS,
  },
  {
    id: 'CDMO',
    label: DEFAULT_CATEGORY,
    fullName: 'The full CDMO route',
    family: 'CDMO',
    phases: PHASES.CDMO,
    milestones: PHASE_MILESTONES.CDMO,
  },
];

export const RAG_LABEL = { G: 'On track', A: 'Watch', R: 'At risk' } as const;

export const ROLES = [
  'Project manager',
  'Process engineer',
  'Design engineer',
  'Regulatory support',
] as const;
