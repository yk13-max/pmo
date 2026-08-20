import type { Allocations, Facing, Invoice, Leave, Person, Portfolio, Project, ProjectType, Rag } from '../types';
import { HOURS_PER_FULL_MONTH, WORKING_DAYS_PER_MONTH } from '../types';
import { DEFAULT_FAMILIES, DEFAULT_PROJECT_TYPES, ROLES } from './phases';
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

type PersonSeed = [
  name: string,
  role: string,
  discipline: string,
  loads: number[],
  projects: string[],
  workingDays?: number,
  /** Share of their working time on meetings, admin and line management. */
  overheadPct?: number,
];

/* The written half of a few sample projects: what the work delivers, what it has achieved,
   and what could still go wrong. Only a handful carry any, which is the honest picture of a
   portfolio — the narrative is written on the projects somebody is being asked about, and the
   rest of the sample shows what an unwritten one looks like on the screen and in the pack.
   One internal project is among them, because internal work is reviewed too. */
const NARRATIVE_SEED: Record<
  string,
  { product: string; wins: string[]; risks: [risk: string, mitigation: string, assistance: string, critical?: boolean][] }
> = {
  Rolex: {
    product:
      'A sterile pre-filled syringe for a monoclonal antibody, filled at the Aveltis site and released to EU and US markets. Two presentations: 1ml and 2.25ml.',
    wins: [
      'Process performance qualification completed on all three batches',
      'Container closure integrity method validated and transferred',
      'EU stability protocol agreed with the client’s regulatory team',
      'Second filling line released for commercial use',
    ],
    risks: [
      ['Stopper supplier has a 22-week lead time against a 14-week need', 'Second source qualified in parallel; buffer stock ordered', 'Sign-off on the dual-source change', true],
      ['Client’s own analytical transfer is four weeks behind', 'Weekly joint review; our method retained as backup', 'Escalate at the steering group'],
    ],
  },
  'Red Bull': {
    product:
      'A single-use delivery set for the client’s infusion pump, moulded and assembled at volume, CE marked under MDR.',
    wins: [
      'Design freeze reached and the design history file brought up to date',
      'Pilot tooling delivered and first articles measured',
    ],
    risks: [
      ['Notified body review slot not confirmed for the submission window', 'Application filed early; slot chased weekly', 'A director-level call with the notified body', true],
      ['Biocompatibility testing may repeat if the adhesive changes', 'Adhesive locked in the design freeze', 'None for now'],
    ],
  },
  Seiko: {
    product:
      'A rebuild of the site’s batch record system, from paper to electronic, covering every operations area on the site.',
    wins: ['Requirements agreed with all four areas', 'Supplier chosen and the validation plan written'],
    risks: [['No named owner in operations once the project team hands over', 'Handover plan drafted with the operations lead', 'Name the owner before go-live']],
  },
};

/* The standing work. Three of them, because a real portfolio has a handful and they are all
   the same handful: something that keeps the last generation of product alive, something a
   customer pays a retainer for, and something the site owes itself. Each carries the hours a
   month it typically takes and the months it actually lands in — bursts rather than a flat
   line, which is the whole character of work that comes and goes. The months are given as
   offsets from the start of the resourcing window, so the sample always has something to
   show whenever it is opened. */
const WORKSTREAM_SEED: [
  name: string,
  client: string,
  type: ProjectType,
  /** What kind of standing work it is, in the words the business would use for it. */
  kind: string,
  facing: Facing,
  pm: string,
  budget: number,
  actual: number,
  /** Who does it, and how many hours of theirs it takes in a month it is running. */
  crew: [person: string, hours: number][],
  /** Which months of the window it lands in. */
  months: number[],
][] = [
  [
    'Sustaining engineering',
    'Engineering',
    'CS',
    'Engineering',
    'I',
    'Priya',
    260,
    140,
    [['Elena', 26], ['Yusuf', 14]],
    [0, 1, 2, 3, 4, 5],
  ],
  [
    'Aveltis standing support',
    'Aveltis Bio',
    'CDMO',
    'Customer support',
    'C',
    'Saranan',
    180,
    95,
    [['Rachel', 18], ['Saranan', 10]],
    [0, 2, 3, 5],
  ],
  [
    'Lab equipment upkeep',
    'Operations',
    'CDMO',
    'Facilities',
    'I',
    'Marcus',
    120,
    64,
    [['Yusuf', 20]],
    [1, 4],
  ],
];

/** Monthly loads are the mockup's tuned figures; they become allocations spread over each
    person's projects, so the resourcing screens still read the same. */
const PEOPLE_SEED: PersonSeed[] = [
  ['Saranan', 'Project manager', 'CDMO', [72, 78, 82, 80, 76, 70],
    ['Rolex', 'Omega', 'Patek', 'Cartier', 'Seiko', 'Breitling'], undefined, 15],
  ['Priya', 'Project manager', 'CS', [84, 90, 96, 93, 88, 82],
    ['Ferrari', 'Mercedes', 'Aston Martin', 'Racing Bulls', 'Tyrrell', 'Renault', 'Minardi', 'Ligier'], undefined, 15],
  ['Marcus', 'Project manager', 'CS', [104, 120, 150, 138, 118, 98],
    ['McLaren', 'Red Bull', 'Haas', 'Lotus', 'Benetton', 'Toro Rosso', 'Arrows'], undefined, 20],
  ['Dermot', 'Project manager', 'CS', [66, 72, 78, 75, 71, 64],
    ['Williams', 'Alpine', 'Sauber', 'Brabham', 'Jordan', 'Force India', 'March'], 16, 15],
  ['Yusuf', 'Process engineer', '', [98, 114, 142, 132, 112, 96],
    ['Patek', 'Rolex', 'Seiko', 'Toro Rosso', 'Red Bull'], undefined, 10],
  ['Elena', 'Design engineer', '', [88, 94, 99, 96, 92, 86],
    ['Red Bull', 'Benetton', 'Ferrari', 'March', 'Cartier'], 17, 10],
  ['Rachel', 'Regulatory support', '', [102, 118, 148, 136, 116, 100],
    ['Breitling', 'Cartier', 'Force India', 'Rolex', 'Patek'], undefined, 12],
];

/* The skills the sample team holds and the sample work asks for. Tags rather than titles:
   several people hold sterile fill, and one person holds four of these — which is the shape
   the matrix on the Data screen is for. */
const SKILLS_SEED: [id: string, label: string, note: string][] = [
  ['skill-aseptic', 'Aseptic process design', 'Designing a process that holds sterility end to end.'],
  ['skill-fill', 'Sterile fill–finish', 'Filling, stoppering and sealing under grade A conditions.'],
  ['skill-transfer', 'Tech transfer', 'Moving a process between sites or scales without losing it.'],
  ['skill-validation', 'Validation (IQ/OQ/PQ)', 'Qualifying equipment and processes to a written protocol.'],
  ['skill-reg', 'Regulatory submissions', 'Assembling and defending a submission to a regulator.'],
  ['skill-ce', 'CE marking', 'Taking a device through conformity assessment.'],
  ['skill-dfm', 'Design for manufacture', 'Designing a part so it can actually be made at volume.'],
  ['skill-cost', 'Cost modelling', 'Costing a programme before anybody has agreed to it.'],
];

/** Who holds what. */
const PERSON_SKILLS: Record<string, string[]> = {
  Saranan: ['skill-transfer', 'skill-cost'],
  Priya: ['skill-ce', 'skill-cost'],
  Marcus: ['skill-dfm', 'skill-cost', 'skill-ce'],
  Dermot: ['skill-transfer', 'skill-validation'],
  Yusuf: ['skill-aseptic', 'skill-fill', 'skill-transfer', 'skill-validation'],
  Elena: ['skill-dfm', 'skill-ce'],
  Rachel: ['skill-reg', 'skill-validation'],
};

/** What the work asks for. Everything else asks for nothing in particular. */
const PROJECT_SKILLS: Record<string, string[]> = {
  Rolex: ['skill-aseptic', 'skill-fill', 'skill-validation'],
  Omega: ['skill-transfer', 'skill-validation'],
  Patek: ['skill-fill', 'skill-reg'],
  Cartier: ['skill-aseptic', 'skill-reg'],
  Seiko: ['skill-transfer'],
  Breitling: ['skill-validation', 'skill-reg'],
  Ferrari: ['skill-dfm', 'skill-ce'],
  McLaren: ['skill-ce'],
  Williams: ['skill-dfm', 'skill-cost'],
  'Red Bull': ['skill-dfm', 'skill-ce', 'skill-cost'],
  Benetton: ['skill-ce', 'skill-reg'],
  'Toro Rosso': ['skill-transfer', 'skill-dfm'],
};

/* A few projects invoice in named pieces rather than the four standing stages, so the
   sample shows what that looks like: a sales order number against each, a sum to the pound,
   and a gate it waits on. The share is of the project's agreed value; the gate is an index
   into its phases. */
const INVOICE_SEED: [project: string, label: string, salesOrder: string, share: number, phase: number][] = [
  ['Rolex', 'On kick-off', 'SO-48120', 0.15, 0],
  ['Rolex', 'At design freeze', 'SO-48121', 0.3, 2],
  ['Rolex', 'At validation', 'SO-48122', 0.35, 4],
  ['Rolex', 'On handover', 'SO-48123', 0.2, 6],
  ['Patek', 'Stage payment 1', 'SO-47902', 0.4, 1],
  ['Patek', 'Stage payment 2', 'SO-47903', 0.6, 4],
  ['Ferrari', 'Design package', 'SO-49015', 0.5, 0],
  ['Ferrari', 'Build and hand over', 'SO-49016', 0.5, 2],
];

/** Annual leave in days, per person, across the six planning months. */
const LEAVE_SEED: Record<string, number[]> = {
  Saranan: [0, 0, 3, 0, 5, 0],
  Priya: [5, 0, 0, 2, 4, 0],
  Marcus: [0, 2, 0, 0, 6, 0],
  Dermot: [3, 0, 0, 5, 3, 0],
  Yusuf: [0, 0, 2, 0, 5, 0],
  Elena: [4, 0, 0, 0, 4, 0],
  Rachel: [0, 3, 0, 0, 5, 2],
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

  const people: Person[] = PEOPLE_SEED.map(([name, role, discipline, , , workingDays, overheadPct]) => {
    const days = workingDays ?? WORKING_DAYS_PER_MONTH;
    return {
      id: `person-${name.toLowerCase()}`,
      name,
      role,
      types: discipline ? [discipline] : [],
      skills: PERSON_SKILLS[name] ?? [],
      workingDays: days,
      capacity: Math.round((days / WORKING_DAYS_PER_MONTH) * 100),
      overheadPct: overheadPct ?? 0,
    };
  });

  const pmByProject = new Map<string, string>();
  PEOPLE_SEED.forEach(([name, role, , , projects]) => {
    if (role !== 'Project manager') return;
    projects.forEach((p) => pmByProject.set(p, `person-${name.toLowerCase()}`));
  });

  const projects: Project[] = PROJECT_SEED.map((row, i) => {
    const said = NARRATIVE_SEED[row[0]];
    const [name, client, type, facing, phase, pct, rag, budget, actual, value, billed, load] = row;
    const duration = type === 'CDMO' ? 18 + (i % 4) * 6 : 6 + (i % 3) * 3;
    const elapsed = Math.round((pct / 100) * duration);
    const start = addMonths(anchor, -elapsed);
    return {
      id: `project-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      /* Every business numbers its work, so the sample portfolio is numbered too — the
         kind of work and a serial, which is what most of them come to. */
      number: `${type}-${String(i + 1).padStart(3, '0')}`,
      skills: PROJECT_SKILLS[name] ?? [],
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
      // What somebody has written about this project for the review, where anybody has.
      productDescription: said?.product,
      accomplishments: said?.wins.join('\n'),
      risks: (said?.risks ?? []).map(([risk, mitigation, assistance, critical], k) => ({
        id: `risk-${name.toLowerCase().replace(/\s+/g, '-')}-${k + 1}`,
        risk,
        mitigation,
        assistance,
        critical,
      })),
    };
  });

  /* The workstreams, as projects with no dates on them. Everything else about the record is
     the same, which is the point: they are booked, planned, budgeted and archived by the
     same code, and only the screens built on dates leave them out. */
  const workstreams: Project[] = WORKSTREAM_SEED.map(([name, client, type, kind, facing, pm, budget, actual]) => ({
    id: `project-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    client,
    type,
    facing,
    workstream: true,
    workstreamType: kind,
    phase: 0,
    pct: 0,
    rag: 'G' as const,
    pmId: people.find((x) => x.name === pm)?.id ?? people[0].id,
    budget,
    actual,
    value: 0,
    billed: 0,
    load: 0,
    startDate: '',
    endDate: '',
    milestone: '',
    milestoneDate: '',
    currency: 'GBP' as const,
    priority: 4,
    phaseDates: [],
    invoiceDates: [],
    skills: [],
    risks: [],
  }));
  projects.push(...workstreams);

  const byName = new Map(projects.map((p) => [p.name, p]));
  const months = planningMonths(today);
  const allocations: Allocations = {};
  PEOPLE_SEED.forEach(([name, , , loads, projectNames]) => {
    const personId = `person-${name.toLowerCase()}`;
    const targets = projectNames.map((n) => byName.get(n)).filter((p): p is Project => Boolean(p));
    months.forEach((month, mi) => {
      const shares = splitWhole(loads[mi], targets.map((p) => p.load));
      targets.forEach((project, pi) => {
        // The tuned figures are shares of a full-time month; bookings are kept in hours.
        if (shares[pi] > 0) {
          allocations[`${project.id}|${personId}|${month}`] =
            Math.round((shares[pi] / 100) * HOURS_PER_FULL_MONTH * 2) / 2;
        }
      });
    });
  });

  /* What the standing work actually takes, month by month. Only the months it runs in get a
     booking at all: a workstream with something in every cell would be a project in all but
     name, and the gaps are the reading. */
  WORKSTREAM_SEED.forEach(([name, , , , , , , , crew, activeMonths]) => {
    const stream = byName.get(name);
    if (!stream) return;
    crew.forEach(([person, hours]) => {
      const personId = `person-${person.toLowerCase()}`;
      activeMonths.forEach((mi) => {
        const month = months[mi];
        if (month) allocations[`${stream.id}|${personId}|${month}`] = hours;
      });
    });
  });

  /* The named invoices, priced off each project's agreed value and dated to the gate they
     wait on. Held to the pound: an invoice is a document with an exact figure on it, and the
     project's value is in thousands, so the share is multiplied up here. */
  const invoices: Invoice[] = INVOICE_SEED.flatMap(([projectName, label, salesOrder, share, phase], i) => {
    const project = byName.get(projectName);
    if (!project) return [];
    return [
      {
        id: `invoice-seed-${i + 1}`,
        projectId: project.id,
        label,
        salesOrder,
        amount: Math.round(project.value * 1000 * share),
        due: project.phaseDates[phase] ?? project.endDate,
        phase,
      },
    ];
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
    // Plans are the planner's own work, so the sample portfolio ships without any.
    tasks: [],
    invoices,
    allocations,
    leave,
    roles: [...ROLES],
    skills: SKILLS_SEED.map(([id, label, note]) => ({ id, label, note })),
    families: DEFAULT_FAMILIES.map((f) => ({ ...f })),
    projectTypes: DEFAULT_PROJECT_TYPES.map((t) => ({ ...t })),
    threshold: 85,
    window: { startMonth: months[0], months: months.length },
    // A shutdown over the winter and the usual spring cluster, so nobody enters them by hand.
    publicHolidays: { [months[0]]: 1, [months[4]]: 2, [months[5]]: 2 },
    fxToBase: { GBP: 1, USD: 0.79, EUR: 0.85 },
    allocationUnit: 'hours',
    invoiceUnit: 'units',
  };
}
