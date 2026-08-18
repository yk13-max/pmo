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

/** The time, to the minute, for the pack's own footer. */
function stamp(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
/* The resourcing bars, in the colours the screens draw them: project work in the neutral the
   app uses for it, days off in the brand navy at the base, and the non-project time in the
   slate blue that stands apart from both. */
const WORK = 'B4BEC6';
const OFFWORK = '5C7F9E';
const GREEN = '92D050';
const AMBER = 'FFC000';
const RED = 'FF0000';

/** Its typeface. A machine without Poppins substitutes, exactly as it would opening the
    template itself. */
const FONT = 'Poppins';

/** The dashboard's ten columns, in the inches the template gives them. */
const DASH_COLS = [1.85, 1.9, 1.55, 0.85, 0.75, 1.15, 1.1, 0.85, 1.4, 0.9];
const DASH_HEADS = [
  'Customer / Project',
  'Current phase / gate',
  'Next Milestone',
  'Milestone Target',
  'Rev To Date',
  'PM',
  'Team',
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
   lot — and the progress bars are drawn over the table from that figure, so a row PowerPoint
   had to grow would take its bar out of line with it. The height is therefore worked out from
   the longest thing the table has to hold rather than fixed at what usually fits: a business
   whose phases are called "Material Research & Initial Design" needs three lines where one
   calling them "V&V" needs one, and guessing wrong puts a bar through the words. */
const DASH_ROW_MIN = 0.5;
const DASH_MARGIN = 0.04;
/* The phase cell holds its words and its bar. A cell cannot contain a shape, so the strip the
   bar is drawn in is reserved as the cell's own bottom inset — which is what keeps the text
   off it however long the phase is called. In points, as PowerPoint measures insets. */
/* The bar's own height, the line under it the phase marker is written on, and how far the
   two of them sit above the bottom of their cell. */
const DASH_BAR_H = 0.09;
const DASH_MARK_H = 0.11;
const DASH_BAR_LIFT = 0.03;
/** Everything the strip under the words has to hold. */
const DASH_STRIP = DASH_BAR_H + DASH_MARK_H + DASH_BAR_LIFT;
const DASH_PHASE_MARGIN: [number, number, number, number] = [2, 3, Math.round(DASH_STRIP * 72), 3];
/* The phase reads a half point smaller than the rest of the row. It is the one cell carrying
   two things — what the phase is called and how far through it the work is — and a business
   whose phases are called "Detailed Design & Verification Planning" would otherwise cost the
   whole table a line of height for every row. */
const DASH_PHASE_PT = 7.5;
/** The foot of the table: below this is the summary line. */
const DASH_BOTTOM = 6.85;

/**
 * Roughly how many lines a piece of text takes in a column of a given width.
 *
 * An estimate, because the only thing that could answer exactly is the machine the deck is
 * opened on. It is deliberately pessimistic — a shade under the characters that really fit —
 * since a row an eighth of an inch too tall costs nothing and a row too short puts a bar
 * through a phase name.
 */
function linesNeeded(text: string, widthIn: number, fontPt: number): number {
  /* About seventeen characters to the inch at 8pt, and in proportion — read off a rendered
     deck rather than assumed, because the first guess was half as generous again and let a
     two-line phase name pass for one. */
  const perInch = 130 / fontPt;
  const usable = Math.max(0.2, widthIn - 0.12);
  return text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / Math.max(4, usable * perInch))), 0);
}

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

  titleSlide(pptx, period, projects.length, view);
  dashboardSlides(pptx, view, period, today);
  resourceSlide(pptx, view, period);
  projects.forEach((project) => projectSlide(pptx, view, portfolio, project));
  familiesSlide(pptx, view, period);

  const data = (await pptx.write({ outputType: 'blob' })) as Blob;
  return data;
}

/* — the title — */

/* The mark, drawn rather than embedded: three rounded panes on a rising diagonal, each showing
   through the last, which is what the brand file says it is. Redrawing it in the deck's own
   shapes rather than dropping in a picture keeps it sharp at any size a projector asks for,
   and keeps the pack to one file with nothing linked. The geometry is the mark's own 96-unit
   box, scaled to whatever room it is given. */
function glassMark(pptx: any, slide: any, x: number, y: number, size: number): number {
  const at = (v: number) => (v / 96) * size;
  const panes: [number, number, number, string, number][] = [
    [11, 47, 38, '0A4B75', 68],
    [27, 27, 41, '0A4B75', 40],
    [44, 8, 44, '12AEBE', 12],
  ];
  panes.forEach(([px, py, pw, colour, transparency]) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x + at(px), y: y + at(py), w: at(pw), h: at(pw),
      rectRadius: at(9), fill: { color: colour, transparency },
    });
  });
  /* Where the ink actually sits, which is not the middle of the box it is drawn in: the panes
     run from 11 to 88 across a 96-unit square, so the mark's own centre is a shade right of
     centre. Anything lining up under it should line up with this. */
  return x + at((11 + 88) / 2);
}

function titleSlide(pptx: any, period: string, count: number, view: PortfolioView) {
  const slide = pptx.addSlide();
  slide.addText('Project One-slides', {
    x: 0.9, y: 3.01, w: 11.81, h: 1.03, fontFace: FONT, fontSize: 40, bold: true, color: NAVY,
  });
  slide.addText(`${period}  ·  ${count} project${count === 1 ? '' : 's'} in progress`, {
    x: 0.9, y: 4.04, w: 11.81, h: 0.6, fontFace: FONT, fontSize: 18, color: QUIET,
  });
  // The mark in the top corner, and its name under it at the size a credit is set.
  const centre = glassMark(pptx, slide, 11.55, 0.55, 1.15);
  // Centred on the mark itself rather than ranged off the edge of the slide.
  const wordW = 2.0;
  slide.addText('Project Glass', {
    x: centre - wordW / 2, y: 1.78, w: wordW, h: 0.24, fontFace: FONT, fontSize: 10,
    color: QUIET, align: 'center', margin: 0, valign: 'middle',
  });
  /* When the pack was made, in the corner nobody looks at until they need to know whether the
     copy in their hand is the current one. */
  slide.addText(`Generated ${packDate(view.today)} at ${stamp(view.today)}`, {
    x: 8.33, y: 6.85, w: 4.4, h: 0.24, fontFace: FONT, fontSize: 9, color: RULE,
    align: 'right', margin: 0, valign: 'middle',
  });
}

/**
 * A project's progress, drawn as the run of its phases rather than as one flat bar.
 *
 * The bar is the whole project, divided into its phases; it is filled to how far through the
 * project the work is, which means the fill stops part way along the phase it is in — so the
 * same picture says both things at once. Which phase that is can be read off the dividers, and
 * how far through it is, is the part of that segment that is coloured. A flat bar could only
 * ever say one of the two.
 */
function phaseBar(pptx: any, slide: any, project: ProjectView, x: number, y: number, w: number, h: number) {
  const phases = Math.max(1, project.phases.length);
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: TRACK } });
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: Math.max(0.02, (w * Math.min(100, Math.max(0, project.overallPct))) / 100), h,
    fill: { color: rag(project) },
  });
  /* The phase boundaries, cut through the fill in the colour of the page so they read as
     divisions of the bar rather than as marks on top of it. */
  for (let i = 1; i < phases; i += 1) {
    slide.addShape(pptx.ShapeType.rect, {
      x: x + (w * i) / phases - 0.005, y, w: 0.01, h, fill: { color: 'FFFFFF' },
    });
  }
  /* Where the work has got to inside the phase it is in, written under the point the fill
     reaches. The bar says how far through the project the work is; this says how far through
     the phase, which is the figure a review asks for next and the one the bar can only imply.
     Small, and pinned to the fill rather than to the cell, so it reads as a mark on the bar. */
  const fillEnd = x + (w * Math.min(100, Math.max(0, project.overallPct))) / 100;
  const label = 0.62;
  slide.addText(`▲ ${project.pct}% of phase`, {
    x: Math.min(x + w - label, Math.max(x, fillEnd - label / 2)),
    y: y + h, w: label + 0.5, h: DASH_MARK_H,
    fontFace: FONT, fontSize: 6, color: QUIET, margin: 0, valign: 'middle', wrap: false,
  });
}

/* — the portfolio dashboard —

   One row per project, and as many slides as that takes: the template has room for six, and a
   portfolio of thirty would otherwise be six projects and a lie. Each slide carries the key
   and the count, and the ones after the first say they are a continuation. */
function dashboardSlides(pptx: any, view: PortfolioView, period: string, today: string) {
  const projects = view.projects;
  /* What every row is made of, worked out once so the height can be taken from the tallest of
     them and the bars placed from that. */
  const rowsData = projects.map((p) => {
    const eng = engineers(view, p);
    return {
      project: p,
      cells: [
        `${p.client}\n${p.number ? `${p.number} · ` : ''}${p.name}`,
        `${p.phaseName}\n${p.phaseStep} · ${p.overallPct}% of project`,
        p.milestone || '—',
        p.msDateLabel || '—',
        /* Revenue to date is what the client has been invoiced. Internal work invoices nobody,
           so it is nought rather than its spend — a figure in that column that was not revenue
           read as revenue. A customer project with nothing raised yet is nought too, not a
           dash: nought is the answer, and the column is a column of figures. */
        p.cust ? moneyOrZero(p.billed, p.currency) : moneyOrZero(0, p.currency),
        p.pmName,
        eng.map((x) => initials(x.name)).join(', ') || '—',
        p.endLabel,
        '',
        p.ragLabel,
      ],
    };
  });
  /* Nine points a line at 9pt, the cell's own insets, and — for the phase column — the strip
     the bar is drawn in, which is reserved as that cell's bottom inset. */
  const lineH = (9 * 1.25) / 72;
  const phaseLineH = (DASH_PHASE_PT * 1.25) / 72;
  const tallest = rowsData.reduce((most, row) => {
    const lines = Math.max(
      ...row.cells.map((text, i) => linesNeeded(text, DASH_COLS[i], i === 1 ? DASH_PHASE_PT : 9)),
    );
    const phaseLines = linesNeeded(row.cells[1], DASH_COLS[1], DASH_PHASE_PT);
    return Math.max(most, lines * lineH + 0.1, phaseLines * phaseLineH + 0.12 + DASH_STRIP);
  }, DASH_ROW_MIN);
  const DASH_ROW_H = Math.min(0.9, Math.round(tallest * 100) / 100);
  const DASH_ROWS = Math.max(1, Math.floor((DASH_BOTTOM - DASH_Y - DASH_ROW_H) / DASH_ROW_H));
  const green = projects.filter((p) => p.rag === 'G').length;
  const amber = projects.filter((p) => p.rag === 'A').length;
  const red = projects.filter((p) => p.rag === 'R').length;
  const pages = Math.max(1, Math.ceil(projects.length / DASH_ROWS));

  for (let page = 0; page < pages; page += 1) {
    const mine = rowsData.slice(page * DASH_ROWS, (page + 1) * DASH_ROWS);
    const slide = pptx.addSlide();
    // Short of the key in the corner, so a long "(2 of 4)" never runs into it.
    slide.addText(`${period} – Projects Dashboard${pages > 1 ? ` (${page + 1} of ${pages})` : ''}`, {
      x: 0.55, y: 0.4, w: 8.6, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: NAVY,
    });
    slide.addText(`Last Updated: ${today}`, {
      x: 0.02, y: 0.02, w: 3.4, h: 0.29, fontFace: FONT, fontSize: 11, color: QUIET, margin: 0.02,
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
    mine.forEach(({ project: p, cells }) => {
      rows.push([
        { text: cells[0], options: { fontSize: 9, color: INK } },
        // The bar for this row is drawn over the cell; the strip it sits in is the cell's
        // own bottom inset, so the words can never come down onto it.
        { text: cells[1], options: { fontSize: DASH_PHASE_PT, color: QUIET, valign: 'top', margin: DASH_PHASE_MARGIN } },
        { text: cells[2], options: { fontSize: 9, color: INK } },
        { text: cells[3], options: { fontSize: 9, color: INK } },
        { text: cells[4], options: { fontSize: 9, color: INK, align: 'right' } },
        { text: cells[5], options: { fontSize: 9, color: INK } },
        { text: cells[6], options: { fontSize: 9, color: INK } },
        { text: cells[7], options: { fontSize: 9, color: INK } },
        // Nobody but a person can answer this one, so it is left set in the row's own type.
        { text: '', options: { fontSize: 9, color: INK } },
        { text: cells[9], options: { fontSize: 9, bold: true, color: 'FFFFFF', fill: { color: rag(p) }, align: 'center' } },
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
    mine.forEach(({ project: p }, i) => {
      /* Row i runs from the bottom of the heading. The bar sits on the floor of its own
         cell rather than in the middle of it — a bar floating between two lines of text
         reads as a third line rather than as the measure of them. */
      const y = DASH_Y + DASH_ROW_H * (i + 2) - DASH_STRIP;
      const x = DASH_X + DASH_COLS[0] + 0.06;
      const w = DASH_COLS[1] - 0.12;
      phaseBar(pptx, slide, p, x, y, w, DASH_BAR_H);
    });

    slide.addText(
      `${projects.length} active project${projects.length === 1 ? '' : 's'}  ·  ${green} on track  ·  ${amber} at risk · ${red} off plan.   RAG is reported against the next milestone.`,
      { x: 0.55, y: 6.95, w: 12.2, h: 0.35, fontFace: FONT, fontSize: 11, color: INK },
    );
    slide.slideNumber = { x: 12.79, y: 7.0, w: 0.4, h: 0.24, fontFace: FONT, fontSize: 9, color: QUIET };
  }
}

/* — the resource overview —

   A divider in the template, and an empty page in a generated pack is a wasted one. It carries
   the team behind the work: the table of who they are and how full their busiest month is, and
   then a card for each of them — six months of bars against the line of what they have to
   give, which is the one reading a table cannot do. The cards run twelve to a slide and take
   another slide when the team is bigger than that. */
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
  slide.slideNumber = { x: 12.79, y: 7.0, w: 0.4, h: 0.24, fontFace: FONT, fontSize: 9, color: QUIET };

  personChartSlides(pptx, view, period);
}

/* How the cards are laid out: four across, three down, on a slide of their own, inside the
   same margin every other slide keeps. The block is centred rather than started at the left
   margin and left to run where it runs — four cards begun at the margin finished a tenth of
   an inch from the right edge of the page, which read as a mistake even though it was not. */
const CARD_COLS = 4;
const CARD_ROWS = 3;
const CARD_MARGIN = 0.62;
const CARD_GAP_X = 0.28;
const CARD_GAP_Y = 0.28;
const CARD_W = (PAGE_W - CARD_MARGIN * 2 - CARD_GAP_X * (CARD_COLS - 1)) / CARD_COLS;
const CARD_H = 1.62;
const CARD_Y = 1.35;

/**
 * A card per person: six months of what they have promised, drawn the way the resourcing
 * screen draws them.
 *
 * The bar is everything that consumes their month — project work, days off and the non-project
 * time that is left once those have taken their share — and the dashed line across it is their
 * own full month. A bar over the line is a month somebody has to do something about, which is
 * the whole reason for putting the picture on the page rather than another column of figures.
 */
function personChartSlides(pptx: any, view: PortfolioView, period: string) {
  const people = view.peopleViews;
  const perSlide = CARD_COLS * CARD_ROWS;
  const pages = Math.ceil(people.length / perSlide);
  const months = Math.min(6, view.months.length);

  for (let page = 0; page < pages; page += 1) {
    const slide = pptx.addSlide();
    slide.addText(`${period} – Resource Overview · person by person${pages > 1 ? ` (${page + 1} of ${pages})` : ''}`, {
      x: CARD_MARGIN, y: 0.45, w: 11.81, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: NAVY,
    });
    slide.addText(
      `One bar a month, ${view.monthLabels[0]} to ${view.monthLabels[months - 1]}. The dashed line is their full month; a bar above it is oversold.`,
      { x: CARD_MARGIN, y: 0.92, w: 8.4, h: 0.3, fontFace: FONT, fontSize: 10, color: QUIET, margin: 0, valign: 'middle' },
    );
    // The same key the resourcing screen carries, in the same order the bars stack.
    ([['Project work', WORK], ['Days off', NAVY], ['Other work', OFFWORK]] as [string, string][]).forEach(
      ([label, colour], i) => {
        const x = 9.05 + i * 1.35;
        slide.addShape(pptx.ShapeType.rect, { x, y: 1.0, w: 0.16, h: 0.12, fill: { color: colour } });
        slide.addText(label, {
          x: x + 0.2, y: 0.94, w: 1.15, h: 0.24, fontFace: FONT, fontSize: 8, color: QUIET,
          margin: 0, valign: 'middle',
        });
      },
    );

    /* A page holding fewer cards than a full row is centred on what it actually has, so a
       team of three does not sit in the left-hand quarter of an empty slide. */
    const mine = people.slice(page * perSlide, (page + 1) * perSlide);
    const cols = Math.min(CARD_COLS, mine.length);
    const gridW = cols * CARD_W + (cols - 1) * CARD_GAP_X;
    const startX = (PAGE_W - gridW) / 2;
    mine.forEach((p, i) => {
      const col = i % CARD_COLS;
      const row = Math.floor(i / CARD_COLS);
      const x = startX + col * (CARD_W + CARD_GAP_X);
      const y = CARD_Y + row * (CARD_H + CARD_GAP_Y);
      personCard(pptx, slide, view, p, x, y, months);
    });
    slide.slideNumber = { x: 12.79, y: 7.0, w: 0.4, h: 0.24, fontFace: FONT, fontSize: 9, color: QUIET };
  }
}

function personCard(pptx: any, slide: any, view: PortfolioView, p: PortfolioView['peopleViews'][number], x: number, y: number, months: number) {
  const full = p.person.capacity;
  /* The chart reaches the taller of a full month and the fullest month they have, so nobody's
     overspill is drawn off the top of their own card. */
  const top = Math.max(full, ...p.committed.slice(0, months), 100);
  const plotY = y + 0.42;
  const plotH = 0.85;
  const slot = CARD_W / months;
  const barW = slot * 0.62;
  const height = (pct: number) => (Math.max(0, Math.min(pct, top)) / top) * plotH;

  slide.addText(p.person.name, {
    x, y, w: CARD_W - 0.5, h: 0.22, fontFace: FONT, fontSize: 11, bold: true, color: INK, margin: 0, valign: 'middle',
  });
  slide.addText(`${p.peak}%`, {
    x: x + CARD_W - 0.5, y, w: 0.5, h: 0.22, fontFace: FONT, fontSize: 11, bold: true, margin: 0,
    align: 'right', valign: 'middle', color: p.peak > full ? RED : INK,
  });
  slide.addText(p.person.role, {
    x, y: y + 0.2, w: CARD_W, h: 0.18, fontFace: FONT, fontSize: 8, color: QUIET, margin: 0, valign: 'middle',
  });

  for (let i = 0; i < months; i += 1) {
    const bx = x + i * slot + (slot - barW) / 2;
    const project = p.loads[i] ?? 0;
    const leave = p.leaveLoads[i] ?? 0;
    const other = p.overheadLoads[i] ?? 0;
    // Days off at the base, as the screens draw them, then project work, then what is left.
    let stack = 0;
    ([[leave, NAVY], [project, WORK], [other, OFFWORK]] as [number, string][]).forEach(([pct, colour]) => {
      const h = height(pct);
      if (h <= 0.004) return;
      slide.addShape(pptx.ShapeType.rect, {
        x: bx, y: plotY + plotH - stack - h, w: barW, h, fill: { color: colour },
      });
      stack += h;
    });
    slide.addText(view.monthLabels[i] ?? '', {
      x: x + i * slot, y: plotY + plotH + 0.02, w: slot, h: 0.16, fontFace: FONT, fontSize: 7,
      color: QUIET, align: 'center', margin: 0, valign: 'middle',
    });
  }

  // Their own full month, and the baseline the bars stand on.
  slide.addShape(pptx.ShapeType.line, {
    x, y: plotY + plotH - height(full), w: CARD_W, h: 0,
    line: { color: INK, width: 0.75, dashType: 'dash' },
  });
  slide.addShape(pptx.ShapeType.line, {
    x, y: plotY + plotH, w: CARD_W, h: 0, line: { color: RULE, width: 0.75 },
  });
}

/* — the last slide: how the work is classified —

   Every slide before this one names a family and a phase and assumes the reader knows what
   they mean. Somebody in the room will not, and the answer is not in the pack anywhere else.
   So it closes with the shape of the business as the tracker holds it: each kind of work, the
   ways of running it, and the phases each of those passes through — which is also the scale
   the dashboards' bars are divided against. */
function familiesSlide(pptx: any, view: PortfolioView, period: string) {
  const slide = pptx.addSlide();
  slide.addText(`${period} – Delivery types and their phases`, {
    x: 0.62, y: 0.4, w: 11.81, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: NAVY,
  });
  slide.addText(
    'For reference: the families of work, the ways each is run, and the gates a project passes through. A project is counted against these phases wherever this pack shows how far through it is.',
    { x: 0.62, y: 1.0, w: 11.81, h: 0.3, fontFace: FONT, fontSize: 10, color: QUIET, margin: 0, valign: 'middle' },
  );

  const rows: any[] = [
    ['Family', 'Way of running it', 'Phases, in order', 'Live'].map((h) => ({
      text: h,
      options: { bold: true, color: 'FFFFFF', fill: { color: NAVY }, fontSize: 10, valign: 'middle' },
    })),
  ];
  view.families.forEach((family) => {
    const categories = view.categoriesOf(family.id);
    categories.forEach((category, i) => {
      const live = view.projects.filter((p) => p.type === category.id).length;
      rows.push([
        {
          // The family is named once against its first category, not repeated down the column.
          text: i === 0 ? family.fullName ?? family.label : '',
          options: { fontSize: 10, bold: true, color: INK, valign: 'middle' },
        },
        { text: category.fullName ?? category.label, options: { fontSize: 10, color: INK, valign: 'middle' } },
        {
          text: category.phases.map((phase, n) => `${n + 1}. ${phase}`).join('   ·   '),
          options: { fontSize: 9, color: QUIET, valign: 'middle' },
        },
        {
          text: live ? `${live} project${live === 1 ? '' : 's'}` : '—',
          options: { fontSize: 10, color: live ? INK : RULE, align: 'right', valign: 'middle' },
        },
      ]);
    });
  });

  slide.addTable(rows, {
    x: 0.62, y: 1.45, w: 12.09, colW: [2.1, 2.1, 6.79, 1.1], rowH: 0.34, margin: 0.05,
    fontFace: FONT, border: { type: 'solid', color: RULE, pt: 0.5 }, autoPage: false,
  });
  slide.slideNumber = { x: 12.79, y: 7.0, w: 0.4, h: 0.24, fontFace: FONT, fontSize: 9, color: QUIET };
}

/* — one slide per project —

   Every block sits where the template puts it, to the inch. The left half is what the project
   is and how far it has got; the right half is the conversation — what has been achieved,
   what is at risk, who is on it next, what happens before the next review. */
function projectSlide(pptx: any, view: PortfolioView, portfolio: Portfolio, project: ProjectView) {
  const slide = pptx.addSlide();
  const head = (text: string, x: number, y: number, w: number) =>
    slide.addText(text, { x, y, w, h: 0.24, fontFace: FONT, fontSize: 11, bold: true, color: NAVY });
  /* Somewhere to write, rather than a box drawn to look like it. Every empty space on this
     slide is an empty text box carrying the deck's own typeface, size and colour, so the first
     thing somebody types into it comes out in the pack's type rather than in PowerPoint's
     default eighteen-point Calibri. */
  const shell = (x: number, y: number, w: number, h: number, fontSize = 10) =>
    slide.addText('', {
      x, y, w, h, fontFace: FONT, fontSize, color: INK, valign: 'top', margin: 0.06,
      fill: { color: 'FFFFFF' }, line: { color: RULE, width: 0.75, dashType: 'dash' },
    });

  /* The kind of work, whose it is, and what it is called: "CDMO: Aveltis Bio – Rolex". The
     box is anchored to its bottom rather than its top, so a title long enough to take two
     lines grows up the slide instead of down into the headings under it — and the type comes
     down a step for the longest of them, which is what keeps two lines to two. */
  const title = `${project.typeShort}: ${project.client} – ${project.name}`;
  slide.addText(title, {
    x: 0.62, y: 0.22, w: 11.81, h: 0.78, fontFace: FONT, fontSize: title.length > 58 ? 20 : 25,
    bold: true, color: NAVY, valign: 'bottom', margin: 0,
  });
  slide.addText(`Date: ${packDate(view.today)}`, {
    x: 7.6, y: 0.06, w: 2.5, h: 0.21, fontFace: FONT, fontSize: 9, color: QUIET, margin: 0,
    valign: 'middle', align: 'right',
  });
  slide.addTable([[{ text: 'Owner', options: { bold: true } }, { text: project.pmName }]], {
    x: 10.29, y: 0.06, w: 3.0, colW: [0.83, 2.17], rowH: 0.21, fontFace: FONT, fontSize: 8,
    color: INK, border: { type: 'solid', color: RULE, pt: 0.5 },
  });

  // The facts, in the four rows the template asks for.
  slide.addTable(
    [
      [
        { text: 'Project phase', options: { bold: true } },
        { text: `${project.phaseName} · ${project.phaseStep} · ${project.overallPct}% of project` },
      ],
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
  shell(0.6, 2.5, 6.1, 1.0);

  /* "Vital few tasks" was the template's phrase for a block that now carries the project's
     own progress as well as room to write in, so it says what it is. */
  head('Project status and progress', 0.6, 3.66, 6.09);
  /* Three words, each kept on its own line: the template's boxes are cut to its own type and
     anything else breaks "On Plan" in half. */
  ([['On Plan', GREEN, 4.86], ['At risk', AMBER, 5.53], ['Late', RED, 6.2]] as [string, string, number][]).forEach(
    ([label, colour, x]) => {
      slide.addText(label, {
        x, y: 3.67, w: 0.66, h: 0.21, fontFace: FONT, fontSize: 8, color: colour, bold: true,
        margin: 0, valign: 'middle', wrap: false,
      });
    },
  );
  /* The scale, each mark over the point of the bar it names rather than spaced out in one
     string and hoped for. */
  slide.addText('% complete', { x: 0.6, y: 3.94, w: 1.2, h: 0.2, fontFace: FONT, fontSize: 9, color: QUIET, margin: 0, valign: 'middle' });
  ([['0%', 2.74], ['50%', 4.52], ['100%', 6.3]] as [string, number][]).forEach(([label, at]) => {
    slide.addText(label, {
      x: at - 0.25, y: 3.94, w: 0.5, h: 0.2, fontFace: FONT, fontSize: 9, color: QUIET,
      align: 'center', margin: 0, valign: 'middle',
    });
  });

  /* Two phases and the room between them.

     The slide used to list every phase, which for a seven-phase project was seven bars of
     which five were nothing anybody was going to talk about — a hundred per cent behind and
     nought per cent ahead. What a review actually turns on is the phase the work is in and
     the one it is going into next, so those are the two that are drawn.

     Between them the slide leaves room to write: a box the size of a bar to name whatever is
     being worked through, and an empty bar under it to shade in. They are dashed, so an
     untouched slide reads as a form rather than as a mistake, and they print as they are for
     anybody filling one in by hand.
   */
  const phases = phaseProgress(portfolio, view, project);
  const now = phases[project.phase];
  const next = phases[project.phase + 1];
  const BAR_X = 2.74;
  const BAR_W = 3.56;
  const BAR_H = 0.13;
  const LABEL_W = 2.05;
  /* Thirteen rows now — the project, the two phases and five places to write, each of those
     being a line to name the work and a bar to shade — so the step is cut to what holds them
     between the scale above and the foot of the slide. */
  const STEP = 0.19;
  let row = 0;
  const rowY = () => 4.18 + row * STEP;

  /** One phase, named on the left and measured on the right. */
  const drawnPhase = (label: string, bar: { name: string; done: number; colour: string }) => {
    const y = rowY();
    const beside = { y, h: BAR_H, valign: 'middle', margin: 0, fontFace: FONT, fontSize: 8 };
    /* Phase names run long — "Now · Speed & Endurance Verification" is two lines in this
       column — so the label keeps its bar's middle, is given the height to hold two lines,
       and the row it is on is spaced a little wider than the rest so the second line does not
       come down on whatever is under it. */
    const text = `${label} ${bar.name}`.trim();
    const twoLines = linesNeeded(text, LABEL_W, 8) > 1;
    slide.addText(text, {
      ...beside, x: 0.6, y: y - 0.06, h: BAR_H + 0.12, w: LABEL_W, color: INK, bold: true,
      fontSize: twoLines ? 7.5 : 8,
    });
    slide.addShape(pptx.ShapeType.rect, { x: BAR_X, y, w: BAR_W, h: BAR_H, fill: { color: TRACK } });
    slide.addShape(pptx.ShapeType.rect, {
      x: BAR_X, y, w: Math.max(0.02, (BAR_W * Math.min(100, Math.max(0, bar.done))) / 100), h: BAR_H,
      fill: { color: bar.colour },
    });
    slide.addText(`${Math.round(bar.done)}%`, { ...beside, x: BAR_X + BAR_W + 0.06, w: 0.5, color: QUIET });
    row += twoLines ? 1.3 : 1;
  };

  /** A line to write on, and a bar to shade. */
  const blankEntry = () => {
    const writable = {
      h: BAR_H, fontFace: FONT, fontSize: 8, color: INK, margin: 0.02, valign: 'middle',
      fill: { color: 'FFFFFF' }, line: { color: RULE, width: 0.75, dashType: 'dash' },
    };
    slide.addText('', { ...writable, x: 0.6, y: rowY(), w: LABEL_W });
    slide.addText('', { ...writable, x: BAR_X, y: rowY(), w: BAR_W });
    row += 1;
    slide.addShape(pptx.ShapeType.rect, { x: BAR_X, y: rowY(), w: BAR_W, h: BAR_H, fill: { color: TRACK } });
    slide.addText('', {
      x: BAR_X + BAR_W + 0.06, y: rowY(), w: 0.5, h: BAR_H, fontFace: FONT, fontSize: 8,
      color: INK, margin: 0, valign: 'middle',
    });
    row += 1;
  };

  /* The whole project first — the headline everything under it explains — then where the work
     is, four lines to fill in, and where it goes next. */
  drawnPhase('', { name: 'Total Project', done: project.overallPct, colour: rag(project) });
  if (now) drawnPhase('Now ·', now);
  blankEntry();
  blankEntry();
  blankEntry();
  blankEntry();
  blankEntry();
  if (next) drawnPhase('Next ·', next);
  else {
    slide.addText('Last phase — nothing after it', {
      x: 0.6, y: rowY(), w: LABEL_W + BAR_W, h: BAR_H, fontFace: FONT, fontSize: 8, color: QUIET,
      margin: 0, valign: 'middle',
    });
  }

  // The rule down the middle, and the right-hand half.
  slide.addShape(pptx.ShapeType.line, { x: 6.9, y: 1.2, w: 0, h: 6.02, line: { color: RULE, width: 1 } });

  head('Key accomplishments to date (update monthly)', 7.1, 1.05, 5.89);
  shell(7.1, 1.32, 5.89, 0.95);

  head('Risks & mitigations', 7.1, 2.34, 5.89);
  /* The template's chip is 0.54in wide, which holds the word only in its own type at its own
     size; anything else spills it onto a second line inside a box drawn for one. Given the
     room it needs, with the inset taken off so the word is not squeezed by it. */
  slide.addText('Critical', {
    x: 12.19, y: 2.35, w: 0.8, h: 0.24, fontFace: FONT, fontSize: 8, color: 'FFFFFF',
    fill: { color: RED }, align: 'center', valign: 'middle', margin: 0.02, wrap: false,
  });
  slide.addTable(
    [
      ['Risk', 'Mitigation/plan', 'Assistance required'].map((t) => ({ text: t, options: { bold: true } })),
      ['', '', ''],
      ['', '', ''],
    ],
    {
      x: 7.1, y: 2.6, w: 5.89, colW: [2.07, 2.32, 1.5], rowH: 0.25, fontFace: FONT, fontSize: 9,
      color: INK, border: { type: 'solid', color: RULE, pt: 0.5 }, valign: 'middle',
    },
  );

  head('Resources (forward view)', 7.1, 4.17, 5.89);
  const team = forwardResources(view, project);
  const pairs: any[] = [
    ['Resource', '% FTE', 'Duration', '', 'Resource', '% FTE', 'Duration'].map((t) => ({
      text: t, options: { bold: true },
    })),
  ];
  /* Two people to a row, and only as many rows as there is room for between this table and
     the heading beneath it. A project with a dozen people on it would otherwise grow the
     table straight through "Next steps" — so the ones that do not fit are counted instead of
     being drawn, which is the honest way for a fixed slide to hold a list that is not. */
  const RES_ROW_H = 0.2;
  const RES_ROWS = Math.max(1, Math.floor((5.63 - 0.08 - 4.44) / RES_ROW_H) - 1);
  const shownPairs = Math.min(RES_ROWS, Math.max(2, Math.ceil(team.length / 2)));
  for (let i = 0; i < shownPairs; i += 1) {
    const left = team[i * 2];
    const right = team[i * 2 + 1];
    const last = i === shownPairs - 1;
    const spare = team.length - shownPairs * 2;
    pairs.push([
      left?.name ?? '', left?.fte ?? '', left?.duration ?? '', '',
      last && spare > 0 ? `+${spare} more` : right?.name ?? '',
      last && spare > 0 ? '' : right?.fte ?? '',
      last && spare > 0 ? '' : right?.duration ?? '',
    ]);
  }
  slide.addTable(pairs, {
    x: 7.1, y: 4.44, w: 5.89, colW: [1.21, 0.54, 1.05, 0.23, 1.18, 0.84, 0.84], rowH: RES_ROW_H,
    margin: 0.02, valign: 'middle',
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
    color: INK, border: { type: 'solid', color: RULE, pt: 0.5 }, valign: 'middle',
  });

  slide.slideNumber = { x: 12.79, y: 7.0, w: 0.4, h: 0.24, fontFace: FONT, fontSize: 9, color: QUIET };
}
