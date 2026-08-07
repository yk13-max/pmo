import type { Allocations, Facing, Leave, Person, Portfolio, Project, ProjectType, Rag } from '../types';
import { WORKING_DAYS_PER_MONTH } from '../types';
import { DEFAULT_PROJECT_TYPES, ROLES } from './phases';
import { addMonths, planningMonths, startOfMonth, toISO } from '../lib/dates';

type ProjectSeed = [
  name: string,
  client: string,
  type: ProjectType,
  facing: Facing,
  phase: number,
  pct: number,
  rag: Rag,
  budget: number,
  actual: number,
  value: number,
  billed: number,
  load: number,
];

/** CDMO programmes are code-named after watch brands, Client Solutions after F1 teams. */
const PROJECT_SEED: ProjectSeed[] = [
  ['Rolex', 'Aveltis Bio', 'CDMO', 'C', 4, 62, 'A', 4200, 2780, 6100, 3400, 92],
  ['Omega', 'Norhaven Therapeutics', 'CDMO', 'C', 2, 45, 'G', 3100, 1180, 4400, 1500, 74],
  ['Patek', 'Kestrel Medical', 'CDMO', 'C', 5, 80, 'G', 5600, 4390, 7900, 6100, 81],
  ['Cartier', 'Pallas Pharma', 'CDMO', 'C', 1, 30, 'R', 2400, 980, 3200, 600, 97],
  ['Seiko', 'Operations', 'CDMO', 'I', 3, 52, 'A', 1200, 760, 0, 0, 84],
  ['Breitling', 'Quality', 'CDMO', 'I', 4, 66, 'R', 1450, 1120, 0, 0, 99],
  ['Ferrari', 'Brightpath Surgical', 'CS', 'C', 1, 46, 'G', 680, 300, 940, 350, 72],
  ['McLaren', 'Lumen Ortho', 'CS', 'C', 2, 72, 'A', 410, 320, 560, 380, 89],
  ['Williams', 'Ashcroft Devices', 'CS', 'C', 0, 28, 'G', 890, 240, 1250, 200, 66],
  ['Mercedes', 'Ferrowick', 'CS', 'C', 3, 90, 'G', 320, 290, 470, 430, 41],
  ['Red Bull', 'Cordelia Health', 'CS', 'C', 1, 54, 'R', 1100, 760, 1500, 600, 101],
  ['Alpine', 'Tanner & Voss', 'CS', 'C', 2, 68, 'G', 540, 370, 720, 480, 77],
  ['Aston Martin', 'Maple Ridge Med', 'CS', 'C', 0, 18, 'G', 260, 60, 380, 0, 49],
  ['Haas', 'Otterline', 'CS', 'C', 3, 84, 'A', 470, 420, 640, 560, 87],
  ['Sauber', 'Brightpath Surgical', 'CS', 'C', 2, 60, 'G', 730, 470, 990, 610, 69],
  ['Racing Bulls', 'Lumen Ortho', 'CS', 'C', 1, 42, 'G', 620, 290, 850, 300, 64],
  ['Lotus', 'Ashcroft Devices', 'CS', 'C', 3, 95, 'G', 340, 330, 450, 440, 29],
  ['Brabham', 'Cordelia Health', 'CS', 'C', 0, 22, 'A', 510, 120, 700, 0, 83],
  ['Tyrrell', 'Ferrowick', 'CS', 'C', 2, 74, 'G', 180, 130, 240, 160, 46],
  ['Benetton', 'Otterline', 'CS', 'C', 1, 50, 'R', 960, 690, 1300, 520, 95],
  ['Jordan', 'Maple Ridge Med', 'CS', 'C', 2, 66, 'G', 290, 190, 400, 240, 58],
  ['Renault', 'Tanner & Voss', 'CS', 'C', 3, 88, 'G', 420, 380, 570, 510, 36],
  ['Toro Rosso', 'Manufacturing', 'CS', 'I', 2, 58, 'A', 760, 470, 0, 0, 86],
  ['Force India', 'Regulatory', 'CS', 'I', 1, 34, 'G', 240, 90, 0, 0, 68],
  ['Minardi', 'Quality', 'CS', 'I', 3, 92, 'G', 120, 110, 0, 0, 24],
  ['Arrows', 'Engineering', 'CS', 'I', 0, 16, 'G', 480, 80, 0, 0, 55],
  ['March', 'Engineering', 'CS', 'I', 2, 62, 'G', 190, 120, 0, 0, 61],
  ['Ligier', 'Procurement', 'CS', 'I', 1, 38, 'A', 150, 70, 0, 0, 81],
];

type PersonSeed = [name: string, role: string, discipline: string, loads: number[], projects: string[], workingDays?: number];

/** Monthly loads are the mockup's tuned figures; they become allocations spread over each
    person's projects, so the resourcing screens still read the same. */
const PEOPLE_SEED: PersonSeed[] = [
  ['Saranan', 'Project manager', 'CDMO', [72, 78, 82, 80, 76, 70],
    ['Rolex', 'Omega', 'Patek', 'Cartier', 'Seiko', 'Breitling']],
  ['Andy', 'Project manager', 'CS', [84, 90, 96, 93, 88, 82],
    ['Ferrari', 'Mercedes', 'Aston Martin', 'Racing Bulls', 'Tyrrell', 'Renault', 'Minardi', 'Ligier']],
  ['Neil', 'Project manager', 'CS', [104, 120, 150, 138, 118, 98],
    ['McLaren', 'Red Bull', 'Haas', 'Lotus', 'Benetton', 'Toro Rosso', 'Arrows']],
  ['Toby', 'Project manager', 'CS', [66, 72, 78, 75, 71, 64],
    ['Williams', 'Alpine', 'Sauber', 'Brabham', 'Jordan', 'Force India', 'March'], 16],
  ['Josh', 'Process engineer', '', [98, 114, 142, 132, 112, 96],
    ['Patek', 'Rolex', 'Seiko', 'Toro Rosso', 'Red Bull']],
  ['Anna', 'Design engineer', '', [88, 94, 99, 96, 92, 86],
    ['Red Bull', 'Benetton', 'Ferrari', 'March', 'Cartier'], 17],
  ['Carrie', 'Regulatory support', '', [102, 118, 148, 136, 116, 100],
    ['Breitling', 'Cartier', 'Force India', 'Rolex', 'Patek']],
];

/** Annual leave in days, per person, across the six planning months. */
const LEAVE_SEED: Record<string, number[]> = {
  Saranan: [0, 0, 3, 0, 5, 0],
  Andy: [5, 0, 0, 2, 4, 0],
  Neil: [0, 2, 0, 0, 6, 0],
  Toby: [3, 0, 0, 5, 3, 0],
  Josh: [0, 0, 2, 0, 5, 0],
  Anna: [4, 0, 0, 0, 4, 0],
  Carrie: [0, 3, 0, 0, 5, 2],
};

/** Month offset and day-of-month for each project's next milestone. */
const MILESTONE_OFFSETS: [months: number, day: number][] = [
  [0, 14], [0, 28], [1, 4], [1, 12], [1, 25], [2, 9],
  [2, 16], [2, 30], [3, 13], [3, 27], [4, 11], [5, 8],
];

function milestoneDate(anchor: Date, index: number): string {
  const [months, day] = MILESTONE_OFFSETS[index % MILESTONE_OFFSETS.length];
  const month = addMonths(startOfMonth(anchor), months);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return toISO(new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastDay)));
}

/** Split `total` across `weights` as whole percentages that still add up to `total`. */
function splitWhole(total: number, weights: number[]): number[] {
  const sum = weights.reduce((n, w) => n + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / sum) * total);
  const out = exact.map(Math.floor);
  let remainder = total - out.reduce((n, v) => n + v, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (remainder > 0) {
        out[i] += 1;
        remainder -= 1;
      }
    });
  return out;
}

export function buildSeedPortfolio(today = new Date()): Portfolio {
  const anchor = startOfMonth(today);

  const people: Person[] = PEOPLE_SEED.map(([name, role, discipline, , , workingDays]) => {
    const days = workingDays ?? WORKING_DAYS_PER_MONTH;
    return {
      id: `person-${name.toLowerCase()}`,
      name,
      role,
      types: discipline ? [discipline] : [],
      workingDays: days,
      capacity: Math.round((days / WORKING_DAYS_PER_MONTH) * 100),
    };
  });

  const pmByProject = new Map<string, string>();
  PEOPLE_SEED.forEach(([name, role, , , projects]) => {
    if (role !== 'Project manager') return;
    projects.forEach((p) => pmByProject.set(p, `person-${name.toLowerCase()}`));
  });

  const projects: Project[] = PROJECT_SEED.map((row, i) => {
    const [name, client, type, facing, phase, pct, rag, budget, actual, value, billed, load] = row;
    const duration = type === 'CDMO' ? 18 + (i % 4) * 6 : 6 + (i % 3) * 3;
    const elapsed = Math.round((pct / 100) * duration);
    const start = addMonths(anchor, -elapsed);
    return {
      id: `project-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      client,
      type,
      facing,
      phase,
      pct,
      rag,
      pmId: pmByProject.get(name) ?? people[0].id,
      budget,
      actual,
      value,
      billed,
      load,
      startDate: toISO(start),
      endDate: toISO(addMonths(start, duration)),
      milestone: (DEFAULT_PROJECT_TYPES.find((t) => t.id === type)?.milestones ?? [])[phase] ?? '',
      milestoneDate: milestoneDate(anchor, i),
      currency: 'GBP' as const,
      priority: rag === 'R' ? 1 : budget >= 1000 ? 2 : rag === 'A' ? 3 : facing === 'I' ? 4 : 3,
      // Phases spread evenly across the project's run; invoices at the quarter points.
      phaseDates: (DEFAULT_PROJECT_TYPES.find((t) => t.id === type)?.phases ?? []).map((_, k, all) =>
        toISO(addMonths(start, Math.round(((k + 1) / all.length) * duration))),
      ),
      invoiceDates:
        facing === 'C'
          ? [0.1, 0.35, 0.7, 1].map((share) => toISO(addMonths(start, Math.round(share * duration))))
          : [],
    };
  });

  const byName = new Map(projects.map((p) => [p.name, p]));
  const months = planningMonths(today);
  const allocations: Allocations = {};
  PEOPLE_SEED.forEach(([name, , , loads, projectNames]) => {
    const personId = `person-${name.toLowerCase()}`;
    const targets = projectNames.map((n) => byName.get(n)).filter((p): p is Project => Boolean(p));
    months.forEach((month, mi) => {
      const shares = splitWhole(loads[mi], targets.map((p) => p.load));
      targets.forEach((project, pi) => {
        if (shares[pi] > 0) allocations[`${project.id}|${personId}|${month}`] = shares[pi];
      });
    });
  });

  const leave: Leave = {};
  PEOPLE_SEED.forEach(([name]) => {
    const days = LEAVE_SEED[name];
    if (!days) return;
    months.forEach((month, i) => {
      if (days[i] > 0) leave[`person-${name.toLowerCase()}|${month}`] = days[i];
    });
  });

  return {
    projects,
    people,
    allocations,
    leave,
    roles: [...ROLES],
    projectTypes: DEFAULT_PROJECT_TYPES.map((t) => ({ ...t })),
    threshold: 85,
    window: { startMonth: months[0], months: months.length },
    // A shutdown over the winter and the usual spring cluster, so nobody enters them by hand.
    publicHolidays: { [months[0]]: 1, [months[4]]: 2, [months[5]]: 2 },
    fxToBase: { GBP: 1, USD: 0.79, EUR: 0.85 },
  };
}
