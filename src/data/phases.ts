import type { ProjectType } from '../types';

export const PHASES: Record<ProjectType, string[]> = {
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
export const PHASE_MILESTONES: Record<ProjectType, string[]> = {
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

export const TYPE_LABEL: Record<ProjectType, string> = {
  CS: 'Client Solutions',
  CDMO: 'CDMO',
};

export const RAG_LABEL = { G: 'On track', A: 'Watch', R: 'At risk' } as const;

export const ROLES = [
  'Project manager',
  'Process engineer',
  'Design engineer',
  'Regulatory support',
] as const;
