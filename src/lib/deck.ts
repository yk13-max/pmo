import type { Portfolio } from '../types';
import type { PortfolioView, ProjectView } from './derive';
import { moneyOrZero } from './derive';
import { fileStamp, fromISO, shortDateYear } from './dates';
import { schedule } from './schedule';
import { assigneesOf } from './planLoad';

/* The review pack, generated.

   A PRC pack is built by hand today: somebody opens the template, types each project's phase,
   dates, money, people and progress into it, and does it again next quarter. Every one of
   those figures is already here and already derived for the screens, so the only thing
   missing was somewhere to put them.

   The shape of the deck is not invented. It is the firm's own template — a title, a portfolio
   dashboard, a divider, and a one-slide-per-project — measured out of the file: 13.333 x 7.5
   inches, Poppins, the navy of its headings, the green, amber and red of its RAG key, and the
   position and width of every block on the project slide. What the tracker cannot know —
   what the product is, what has been achieved, what the risks are — is drawn as an empty
   shell of the right size, to be filled in PowerPoint by whoever presents it.

   The library is imported where the deck is built rather than at the top of a screen, so the
   megabyte it weighs is fetched by the one person exporting a pack and by nobody else. */

/** The quarter, with the year written out — "Q3 2026", as the template heads its slides. */
function periodOf(d: Date): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

/** A date the way the template dates a pack: 18 Aug 2026. */
function packDate(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
}

/** The template's page, in inches. */
const PAGE_W = 13.333;
const PAGE_H = 7.5;

/* Its palette, sampled from the file. */
const NAVY = '156082';
const INK = '16252F';
const QUIET = '5C6B79';
const RULE = 'BDC7CC';
const TRACK = 'E9EDEF';
const GREEN = '92D050';
const AMBER = 'FFC000';
const RED = 'FF0000';

/** Its typeface. A machine without Poppins substitutes, exactly as it would opening the
    template itself. */
const FONT = 'Poppins';

/** The dashboard's ten columns, in the inches the template gives them. */
const DASH_COLS = [1.81, 1.8, 1.9, 1.01, 0.78, 0.86, 0.86, 1.06, 1.27, 0.95];
const DASH_HEADS = [
  'Customer / Project',
  'Current phase / gate',
  'Next Milestone',
  'Milestone Target',
  'Rev TD. (£k)',
  'PM',
  'Eng.',
  'Project Close',
  'Customer Expectations Met?',
  'Status',
];

/* Where the dashboard's table sits and how tall its rows are. Held here because the progress
   bars are drawn over the table rather than inside it — a table cell cannot hold a shape —
   so their positions are worked out from these. */
const DASH_X = 0.55;
const DASH_Y = 1.25;
/* Every row is the same height, the heading included — pptxgenjs applies one `rowH` to the
   lot — and it is set to hold two lines of 9pt with its margins, because PowerPoint grows any
   row whose text does not fit and the progress bars are drawn over the table from these
   figures. A row that grew would take its bar out of line with it. */
const DASH_ROW_H = 0.44;
const DASH_MARGIN = 0.04;
/** How many projects fit on one dashboard before it runs into the footer. */
const DASH_ROWS = Math.floor((6.85 - DASH_Y - DASH_ROW_H) / DASH_ROW_H);

/** Somebody's initials: first name and surname, as the plan's Who column gives them. */
function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return `${words[0][0]}${words.length > 1 ? words[words.length - 1][0] : ''}`.toUpperCase();
}

const rag = (p: ProjectView) => (p.rag === 'R' ? RED : p.rag === 'A' ? AMBER : GREEN);

/** Everyone booked on a project who is not running it — the engineering side of the row. */
function engineers(view: PortfolioView, project: ProjectView) {
  return view
    .allocationsFor(project.id, view.months)
    .filter((r) => r.person.id !== project.pmId)
    .map((r) => r.person);
}

/**
 * How far through each phase of a project the work is, and whether that is a problem.
 *
 * A planned project answers from its tasks; one without a plan answers from the phase it says
 * it is in and how far through that phase it says it is. The colour is about the gate rather
 * than the progress: a phase still ahead of its date is on plan whatever it has done, one
 * inside a month of it is worth watching, and one past its date and unfinished is late.
 */
function phaseProgress(portfolio: Portfolio, view: PortfolioView, project: ProjectView) {
  const tasks = portfolio.tasks.filter((t) => t.projectId === project.id);
  const today = view.today.getTime();
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  return project.phases.map((name, i) => {
    const mine = tasks.filter((t) => t.phase === i);
    const done = mine.length
      ? Math.round(
          mine.reduce((n, t) => n + Math.min(100, Math.max(0, t.done)) * t.days, 0) /
            Math.max(1, mine.reduce((n, t) => n + t.days, 0)),
        )
      : i < project.phase
        ? 100
        : i === project.phase
          ? project.pct
          : 0;
    const gate = project.phaseDates[i] ?? '';
    const due = gate ? fromISO(gate).getTime() : 0;
    const colour = done >= 100 || !due || due - today > MONTH ? GREEN : due >= today ? AMBER : RED;
    return { name, done, gate, colour };
  });
}

/** The next few pieces of work the plan has coming, for the "next steps" block. */
function nextSteps(portfolio: Portfolio, view: PortfolioView, project: ProjectView, want = 3) {
  const tasks = portfolio.tasks.filter((t) => t.projectId === project.id);
  if (!tasks.length) return [];
  const plan = schedule(tasks, project.startDate);
  const today = view.today.getTime();
  return tasks
    .filter((t) => t.done < 100)
    .map((t) => ({ task: t, at: plan.byId.get(t.id) }))
    .filter((r) => r.at)
    .sort((a, b) => (a.at as { endDate: string }).endDate.localeCompare((b.at as { endDate: string }).endDate))
    .slice(0, want)
    .map((r) => ({
      activity: r.task.name,
      owner: assigneesOf(r.task)
        .map((a) => view.people.find((p) => p.id === a.personId)?.name ?? a.name ?? '')
        .filter(Boolean)
        .join(', '),
      due: shortDateYear((r.at as { endDate: string }).endDate),
      late: fromISO((r.at as { endDate: string }).endDate).getTime() < today,
    }));
}

/** Who a project is drawing on over the planning window, and how hard. */
function forwardResources(view: PortfolioView, project: ProjectView) {
  return view.allocationsFor(project.id, view.months).map((row) => {
    const months = row.hours.map((h, i) => (h > 0 ? i : -1)).filter((i) => i >= 0);
    const first = months[0] ?? 0;
    const last = months[months.length - 1] ?? 0;
    return {
      name: row.person.name,
      fte: `${Math.round(Math.max(...row.loads))}%`,
      duration:
        months.length === 0
          ? '—'
          : first === last
            ? view.monthLabels[first]
            : `${view.monthLabels[first]}–${view.monthLabels[last]}`,
    };
  });
}

/** What the deck is called. Stamped like every other export, so two are never confused. */
export function deckFileName(view: PortfolioView): string {
  return `pmo-review-pack-${fileStamp(view.today)}.pptx`;
}

/**
 * Build the pack for the work currently in progress.
 *
 * Running projects only: archived work is finished with and work on hold is out of the
 * portfolio everywhere else, so neither belongs in a review of what is under way.
 */
export async function buildDeck(view: PortfolioView, portfolio: Portfolio): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PRC', width: PAGE_W, height: PAGE_H });
  pptx.layout = 'PRC';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const period = periodOf(view.today);
  const today = packDate(view.today).toUpperCase();
  const projects = view.projects;

  titleSlide(pptx, period, projects.length);
  dashboardSlides(pptx, view, period, today);
  resourceSlide(pptx, view, period);
  projects.forEach((project) => projectSlide(pptx, view, portfolio, project));

  const data = (await pptx.write({ outputType: 'blob' })) as Blob;
  return data;
}

/* — the title — */
function titleSlide(pptx: any, period: string, count: number) {
  const slide = pptx.addSlide();
  slide.addText('Project One-slides', {
    x: 0.9, y: 3.01, w: 11.81, h: 1.03, fontFace: FONT, fontSize: 40, bold: true, color: NAVY,
  });
  slide.addText(`${period}  ·  ${count} project${count === 1 ? '' : 's'} in progress`, {
    x: 0.9, y: 4.04, w: 11.81, h: 0.6, fontFace: FONT, fontSize: 18, color: QUIET,
  });
}

/* — the portfolio dashboard —

   One row per project, and as many slides as that takes: the template has room for six, and a
   portfolio of thirty would otherwise be six projects and a lie. Each slide carries the key
   and the count, and the ones after the first say they are a continuation. */
function dashboardSlides(pptx: any, view: PortfolioView, period: string, today: string) {
  const projects = view.projects;
  const green = projects.filter((p) => p.rag === 'G').length;
  const amber = projects.filter((p) => p.rag === 'A').length;
  const red = projects.filter((p) => p.rag === 'R').length;
  const pages = Math.max(1, Math.ceil(projects.length / DASH_ROWS));

  for (let page = 0; page < pages; page += 1) {
    const mine = projects.slice(page * DASH_ROWS, (page + 1) * DASH_ROWS);
    const slide = pptx.addSlide();
    slide.addText(`${period} – Projects Dashboard${pages > 1 ? ` (${page + 1} of ${pages})` : ''}`, {
      x: 0.55, y: 0.4, w: 9, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: NAVY,
    });
    slide.addText(`Last Updated: ${today}`, {
      x: 0.02, y: 0.02, w: 2.24, h: 0.29, fontFace: FONT, fontSize: 11, color: QUIET,
    });
    // The key, in the corner the template puts it in.
    [
      ['On track', GREEN, 9.4],
      ['At Risk', AMBER, 10.55],
      ['Off Plan', RED, 11.7],
    ].forEach(([label, colour, x]) => {
      slide.addShape(pptx.ShapeType.rect, { x: x as number, y: 0.58, w: 0.2, h: 0.2, fill: { color: colour as string } });
      slide.addText(label as string, {
        x: (x as number) + 0.15, y: 0.52, w: 1, h: 0.32, fontFace: FONT, fontSize: 11, color: INK,
      });
    });

    const rows: any[] = [
      DASH_HEADS.map((h) => ({
        text: h,
        options: { bold: true, color: 'FFFFFF', fill: { color: NAVY }, fontSize: 10, valign: 'middle' },
      })),
    ];
    mine.forEach((p) => {
      const eng = engineers(view, p);
      rows.push([
        { text: `${p.client}\n${p.number ? `${p.number} · ` : ''}${p.name}`, options: { fontSize: 9, color: INK } },
        // The bar for this row is drawn over the cell below; the words go above it.
        { text: `${p.phaseName}\n${p.phaseStep} · ${p.overallPct}%`, options: { fontSize: 9, color: QUIET } },
        { text: p.milestone || '—', options: { fontSize: 9, color: INK } },
        { text: p.msDateLabel || '—', options: { fontSize: 9, color: INK } },
        { text: p.cust ? p.billedLabel : moneyOrZero(p.actual), options: { fontSize: 9, color: INK, align: 'right' } },
        { text: initials(p.pmName), options: { fontSize: 9, color: INK } },
        { text: eng.map((x) => initials(x.name)).join(' ') || '—', options: { fontSize: 9, color: INK } },
        { text: p.endLabel, options: { fontSize: 9, color: INK } },
        // Nobody but a person can answer this one.
        { text: '', options: {} },
        { text: p.ragLabel, options: { fontSize: 9, bold: true, color: 'FFFFFF', fill: { color: rag(p) }, align: 'center' } },
      ]);
    });

    slide.addTable(rows, {
      x: DASH_X, y: DASH_Y, w: 12.3, colW: DASH_COLS,
      rowH: DASH_ROW_H, margin: DASH_MARGIN, fontFace: FONT, valign: 'middle',
      border: { type: 'solid', color: RULE, pt: 0.5 },
      autoPage: false,
    });

    /* The progress bars, drawn over the phase column. A table cell cannot hold a shape, so
       each one is placed from the table's own geometry — which is why the row height is
       fixed above rather than left to the text. */
    mine.forEach((p, i) => {
      // Row i runs from the heading's bottom; the bar sits just above the row's own bottom.
      const y = DASH_Y + DASH_ROW_H * (i + 2) - 0.13;
      const x = DASH_X + DASH_COLS[0] + 0.06;
      const w = DASH_COLS[1] - 0.12;
      slide.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.06, fill: { color: TRACK } });
      slide.addShape(pptx.ShapeType.rect, {
        x, y, w: Math.max(0.02, (w * Math.min(100, p.overallPct)) / 100), h: 0.06, fill: { color: rag(p) },
      });
    });

    slide.addText(
      `${projects.length} active project${projects.length === 1 ? '' : 's'}  ·  ${green} on track  ·  ${amber} at risk · ${red} off plan.   RAG is reported against the next milestone.`,
      { x: 0.55, y: 6.95, w: 12.2, h: 0.35, fontFace: FONT, fontSize: 11, color: INK },
    );
    slide.slideNumber = { x: 12.79, y: 7.0, fontFace: FONT, fontSize: 9, color: QUIET };
  }
}

/* — the resource overview —

   A divider in the template, and an empty page in a generated pack is a wasted one, so it
   carries the team behind the work: who they are, how full their busiest month is, and how
   many months they are booked past what they have. */
function resourceSlide(pptx: any, view: PortfolioView, period: string) {
  const slide = pptx.addSlide();
  slide.addText(`${period} – Resource Overview`, {
    x: 0.76, y: 0.56, w: 11.81, h: 1.03, fontFace: FONT, fontSize: 28, bold: true, color: NAVY,
  });
  const peak = Math.max(0, ...view.demand);
  slide.addText(
    `${view.people.length} people  ·  ${view.capacity.toFixed(1)} people of capacity  ·  ${peak.toFixed(1)} needed at the peak  ·  ${view.skillShortages.length} skill${view.skillShortages.length === 1 ? '' : 's'} with no cover`,
    { x: 0.76, y: 1.5, w: 11.81, h: 0.3, fontFace: FONT, fontSize: 12, color: QUIET },
  );

  const rows: any[] = [
    ['Person', 'Job title', 'Peak month', 'Peak load', 'Months over'].map((h) => ({
      text: h,
      options: { bold: true, color: 'FFFFFF', fill: { color: NAVY }, fontSize: 10 },
    })),
  ];
  view.peopleViews.forEach((p) => {
    const over = p.committed.filter((v) => v > p.person.capacity).length;
    rows.push([
      { text: p.person.name, options: { fontSize: 10, color: INK } },
      { text: p.person.role, options: { fontSize: 10, color: QUIET } },
      { text: view.monthLabels[p.peakMonthIndex] ?? '—', options: { fontSize: 10, color: INK } },
      {
        text: `${p.peak}%`,
        options: { fontSize: 10, align: 'right', color: p.peak > p.person.capacity ? RED : INK },
      },
      { text: over ? String(over) : '—', options: { fontSize: 10, align: 'right', color: over ? RED : QUIET } },
    ]);
  });
  slide.addTable(rows, {
    x: 0.76, y: 2.0, w: 11.81, colW: [3.2, 3.6, 1.8, 1.6, 1.61], rowH: 0.3,
    fontFace: FONT, valign: 'middle', border: { type: 'solid', color: RULE, pt: 0.5 }, autoPage: false,
  });
  slide.slideNumber = { x: 12.79, y: 7.0, fontFace: FONT, fontSize: 9, color: QUIET };
}

/* — one slide per project —

   Every block sits where the template puts it, to the inch. The left half is what the project
   is and how far it has got; the right half is the conversation — what has been achieved,
   what is at risk, who is on it next, what happens before the next review. */
function projectSlide(pptx: any, view: PortfolioView, portfolio: Portfolio, project: ProjectView) {
  const slide = pptx.addSlide();
  const head = (text: string, x: number, y: number, w: number) =>
    slide.addText(text, { x, y, w, h: 0.24, fontFace: FONT, fontSize: 11, bold: true, color: NAVY });
  const shell = (x: number, y: number, w: number, h: number) =>
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: RULE, width: 0.75, dashType: 'dash' },
    });

  slide.addText(`${project.cust ? 'Customer Solution' : 'Internal Project'}: ${project.client} – ${project.name}`, {
    x: 0.62, y: 0.54, w: 11.81, h: 1.03, fontFace: FONT, fontSize: 25, bold: true, color: NAVY,
  });
  slide.addText(`Date: ${packDate(view.today)}`, {
    x: 0.62, y: 0.23, w: 2.33, h: 0.29, fontFace: FONT, fontSize: 11, color: QUIET,
  });
  slide.addTable([[{ text: 'Owner', options: { bold: true } }, { text: project.pmName }]], {
    x: 10.29, y: 0.06, w: 3.0, colW: [0.83, 2.17], rowH: 0.21, fontFace: FONT, fontSize: 8,
    color: INK, border: { type: 'solid', color: RULE, pt: 0.5 },
  });

  // The facts, in the four rows the template asks for.
  slide.addTable(
    [
      [{ text: 'Project phase', options: { bold: true } }, { text: `${project.phaseName} · ${project.phaseStep}` }],
      [{ text: 'Customer delivery date', options: { bold: true } }, { text: shortDateYear(project.endDate) }],
      [{ text: 'Project start date', options: { bold: true } }, { text: shortDateYear(project.startDate) }],
      [
        { text: 'Budget Invoice / spend', options: { bold: true } },
        { text: `${project.cust ? project.valueLabel : project.budgetLabel} / ${project.actualLabel}` },
      ],
    ],
    {
      x: 0.6, y: 1.21, w: 6.1, colW: [2.16, 3.94], rowH: 0.22, fontFace: FONT, fontSize: 9,
      color: INK, border: { type: 'solid', color: RULE, pt: 0.5 }, valign: 'middle',
    },
  );

  head('Description of final product', 0.6, 2.23, 6.1);
  shell(0.6, 2.5, 6.1, 1.4);

  head('Project status – vital few tasks', 0.6, 4.04, 6.09);
  slide.addText('On Plan', { x: 4.93, y: 4.05, w: 0.6, h: 0.21, fontFace: FONT, fontSize: 8, color: GREEN, bold: true });
  slide.addText('At risk', { x: 5.53, y: 4.05, w: 0.6, h: 0.21, fontFace: FONT, fontSize: 8, color: AMBER, bold: true });
  slide.addText('Late', { x: 6.13, y: 4.05, w: 0.53, h: 0.21, fontFace: FONT, fontSize: 8, color: RED, bold: true });
  slide.addText('% complete            0%                    50%                  100%', {
    x: 0.6, y: 4.33, w: 6.12, h: 0.2, fontFace: FONT, fontSize: 9, color: QUIET,
  });

  /* The bars: the whole project first, then a row per phase. Track and fill, at the width and
     the left edge the template's own rectangles use. */
  const phases = phaseProgress(portfolio, view, project);
  const bars = [{ name: 'Total Project', done: project.overallPct, colour: rag(project) }, ...phases];
  const BAR_X = 2.74;
  const BAR_W = 3.56;
  bars.slice(0, 9).forEach((bar, i) => {
    const y = 4.62 + i * 0.24;
    slide.addText(bar.name, { x: 0.6, y: y - 0.05, w: 2.05, h: 0.2, fontFace: FONT, fontSize: 8, color: INK });
    slide.addShape(pptx.ShapeType.rect, { x: BAR_X, y, w: BAR_W, h: 0.15, fill: { color: TRACK } });
    slide.addShape(pptx.ShapeType.rect, {
      x: BAR_X, y, w: Math.max(0.02, (BAR_W * Math.min(100, Math.max(0, bar.done))) / 100), h: 0.15,
      fill: { color: bar.colour },
    });
    slide.addText(`${Math.round(bar.done)}%`, {
      x: BAR_X + BAR_W + 0.06, y: y - 0.05, w: 0.45, h: 0.2, fontFace: FONT, fontSize: 8, color: QUIET,
    });
  });

  // The rule down the middle, and the right-hand half.
  slide.addShape(pptx.ShapeType.line, { x: 6.9, y: 1.2, w: 0, h: 6.02, line: { color: RULE, width: 1 } });

  head('Key accomplishments to date (update monthly)', 7.1, 1.05, 5.89);
  shell(7.1, 1.32, 5.89, 0.95);

  head('Risks & mitigations', 7.1, 2.34, 5.89);
  slide.addText('Critical', {
    x: 12.43, y: 2.37, w: 0.54, h: 0.21, fontFace: FONT, fontSize: 8, color: 'FFFFFF', fill: { color: RED }, align: 'center',
  });
  slide.addTable(
    [
      ['Risk', 'Mitigation/plan', 'Assistance required'].map((t) => ({ text: t, options: { bold: true } })),
      ['', '', ''],
      ['', '', ''],
    ],
    {
      x: 7.1, y: 2.6, w: 5.89, colW: [2.07, 2.32, 1.5], rowH: 0.25, fontFace: FONT, fontSize: 9,
      color: INK, border: { type: 'solid', color: RULE, pt: 0.5 },
    },
  );

  head('Resources (forward view)', 7.1, 4.17, 5.89);
  const team = forwardResources(view, project);
  const pairs: any[] = [
    ['Resource', '% FTE', 'Duration', '', 'Resource', '% FTE', 'Duration'].map((t) => ({
      text: t, options: { bold: true },
    })),
  ];
  for (let i = 0; i < Math.max(2, Math.ceil(team.length / 2)); i += 1) {
    const left = team[i * 2];
    const right = team[i * 2 + 1];
    pairs.push([
      left?.name ?? '', left?.fte ?? '', left?.duration ?? '', '',
      right?.name ?? '', right?.fte ?? '', right?.duration ?? '',
    ]);
  }
  slide.addTable(pairs, {
    x: 7.1, y: 4.44, w: 5.89, colW: [1.21, 0.54, 1.05, 0.23, 1.18, 0.84, 0.84], rowH: 0.22,
    fontFace: FONT, fontSize: 8, color: INK, border: { type: 'solid', color: RULE, pt: 0.5 },
  });

  head('Next steps (before next review)', 7.1, 5.63, 5.89);
  const steps = nextSteps(portfolio, view, project);
  const stepRows: any[] = [
    ['Activity', 'Owner', 'Due by date'].map((t) => ({ text: t, options: { bold: true } })),
  ];
  for (let i = 0; i < 3; i += 1) {
    const step = steps[i];
    stepRows.push([
      { text: step?.activity ?? '' },
      { text: step?.owner ?? '' },
      { text: step?.due ?? '', options: step?.late ? { color: RED, bold: true } : {} },
    ]);
  }
  slide.addTable(stepRows, {
    x: 7.1, y: 5.9, w: 5.89, colW: [2.81, 1.58, 1.5], rowH: 0.25, fontFace: FONT, fontSize: 9,
    color: INK, border: { type: 'solid', color: RULE, pt: 0.5 },
  });

  slide.slideNumber = { x: 12.79, y: 7.0, fontFace: FONT, fontSize: 9, color: QUIET };
}
