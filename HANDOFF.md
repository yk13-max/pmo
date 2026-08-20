# Project Glass — handoff

Written 17 August 2026, at commit `4ca1258` (Mk 111). This is everything a new session — on a
different account, a different machine, or both — needs to pick the work up without being told
it twice.

---

## 1. What this is

**Project Glass** is a PMO portfolio tracker: 28 projects, a team of seven, and the screens a
delivery lead actually uses — portfolio, resourcing, financials, timeline, project detail,
planning (a Gantt with a real scheduling engine), alerts, and a Data screen where everything is
entered.

- **Stack**: React 18 + Vite 5 + TypeScript. No backend, no framework beyond that. Two
  libraries do file work: SheetJS (`xlsx`) for the plan's workbook, and `pptxgenjs` for the
  review pack — the latter behind a dynamic `import()` so it stays out of the main bundle.
- **Data**: one JSON document in `localStorage`, key `pmo-tracker:portfolio:v1`. It starts from
  the sample portfolio in `src/data/seed.ts`.
- **Repo**: `https://github.com/yk13-max/pmo.git`, branch `main`. Working copy `/home/claude/repo`.
- **Origin**: it began as a Claude Design handoff bundle (see `README.md`, `chats/`, `project/`).
  Those directories are historical — the design prototypes the app was built from. The app is
  `src/`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run typecheck
```

---

## 2. Repo layout

```
src/
  App.tsx              routing (hash), the shell, every drawer/pane
  types.ts             the whole data model — read this first
  data/seed.ts         the sample portfolio (28 projects, 7 people, skills, invoices)
  data/phases.ts       default families, categories, phases, job titles
  store/portfolio.tsx  the store: load, normalise, save, every mutation
  lib/derive.ts        usePortfolioView() — the derived view every screen reads
  lib/schedule.ts      the plan's scheduling engine (constraints, links, critical path)
  lib/planLoad.ts      who is on a task, and what a plan books
  lib/csv.ts           CSV in and out (projects, people, allocations, leave, tasks, invoices)
  lib/planXlsx.ts      the plan to a workbook and back (SheetJS)
  lib/invoices.ts      an invoice against the work it waits on
  lib/dates.ts         every date and month helper
  lib/printGantt.ts    print/PDF plumbing (@page injection)
  lib/printChart.ts
  lib/route.ts, lib/theme.ts
  screens/             Portfolio, Resourcing, Financials, Timeline, ProjectDetail,
                       Planning, Alerts, DataManager, About
  components/          forms, tables, charts, the drawer, the brand mark
  styles/broadsheet.css  the design system (structure, components)
  styles/theme.css       the PolarSeal brand layer — palette and typeface, loads last
  styles/app.css         everything specific to this app
docs/                  design decks, the logo GIFs, docs/shared-data-options.md (parked)
tools/make-logo-gif.mjs
project/, chats/       the original design bundle — historical
```

Roughly 14,400 lines of TS/TSX/CSS in `src`.

---

## 3. How the app is put together

**One document in, one document out.** `store/portfolio.tsx` loads the JSON blob, runs it
through `normalise()`, keeps it in React state, and writes it back to `localStorage` on every
change. `normalise()` is where every field added since a blob was written gets backfilled — it
is the migration path, and it is the reason an old store still opens.

**Two unit migrations live there** and are the pattern to copy:

- `allocationUnit: 'hours'` — bookings used to be percentages; a store without the marker is
  converted once on the way in.
- `invoiceUnit: 'units'` — invoice amounts used to be in thousands like the rest of a project's
  money; a store without the marker is multiplied up once and marked.

**Screens never read the store directly.** `usePortfolioView(portfolio)` in `lib/derive.ts`
returns a `PortfolioView`: projects as `ProjectView`s (every label, colour and derived figure
precomputed), `peopleViews`, `skillViews`, months, totals, and a set of lookup functions
(`allocationsFor`, `spreadFor`, `monthsFor`, `loadsExcluding`). If a screen is doing arithmetic,
it usually belongs in `derive.ts`.

**Money**: everything on a project is in **thousands** (`money()`), because a portfolio is read
in millions. **Invoices are the exception** — whole currency units, `moneyExact()`.

**Time**: booked in hours, reported in days, and expressed as a percentage only where the
question is "how full is this person" — and that percentage is a share of **that person's own
month**, so 100% is all the time they have whether they work five days a week or three. Every
figure counted across the team is summed in hours and turned into people at the end, because
half of two different months is not one person. `HOURS_PER_FULL_MONTH = 21 × 8`; a person's own
month is `capacity/100 × that`.

**Workstreams**: a `Project` with `workstream: true` and blank `startDate`/`endDate`. The
derived view splits the running work in two — `view.projects` (dated work, what every
date-shaped screen reads) and `view.workstreams` — while everything counting hours reads
both. That split is the whole feature; there is no second collection and no second form.

**Skills**: tags on `Portfolio.skills`, held by people (`Person.skills`) and
asked for by work (`Project.skills`). Both sides point at the same tag, which is what lets
Resourcing answer "does the work have anybody behind it".

**Preference keys in `localStorage`** (all separate from the portfolio blob):

```
pmo-tracker:portfolio:v1        the data
pmo-tracker:theme               light/dark
pmo-tracker:drawer-full         the edit pane expanded to a full page
pmo-tracker:brand-small         the folded logo
pmo-tracker:plan-columns        the Gantt grid's column widths
pmo-tracker:invoice-columns     the invoice table on the detail screen
pmo-tracker:invoice-edit-columns  the invoice table in the edit pane
pmo-tracker:tab:<screen>        which tab each screen was left on
```

That last one bites during testing: navigating to a screen restores the tab you left it on.

---

## 4. The working contract

This project has been built to a specific rhythm, and the next session should keep it.

1. **Implement what was asked**, in the app's own idiom.
2. **Verify in the browser, by measurement.** Not "it should work" — a Playwright probe that
   reads the built page and prints numbers. Every commit message below quotes the figures it
   was verified with.
3. **Commit with a long, explanatory message**: what changed, why that shape rather than
   another, and what was measured. The history reads as an account of the reasoning, not as a
   changelog.
4. **Push to `main`.**

**Prose style**, in comments and commit messages alike: British English, plain words, full
sentences. Comments explain *why*, and are unusually generous by normal standards — that is
deliberate and the user likes it. Never state a fact about behaviour you have not measured.

**Probes are throwaway.** Write `check-*.mjs` in the repo root, run them, then delete them
before committing. They are scaffolding, not tests. There is no test suite and none is wanted
so far.

---

## 5. How to verify by measurement

The recipe, exactly as it has been used:

```bash
npm run build
npx vite preview --port 5250 --strictPort &     # dist/ on :5250
node check-thing.mjs
```

```js
import { chromium } from 'playwright';
// The bundled browser download is absent in this environment; this path is the one that exists.
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:5250/');
await page.evaluate(() => localStorage.clear());   // back to the sample portfolio
await page.reload();
```

Hard-won gotchas, all of which have cost time at least once:

- **Seed state through `localStorage`, then `page.reload()`.** Navigating to a different
  `#/hash` does *not* reload the document, so the running store will write its own state back
  over anything you poked into storage.
- **Tabs are remembered.** Click the tab you mean before looking for its content.
- **The dark palette is declared on `:root[data-theme='dark'] .shell`**, not on `:root`. Sample
  computed styles from inside `.shell` or you will always read the light values.
- **CSV export downloads five or six files.** Collect every `download` event, don't await one.
- **`page.click('button:has-text("Add")')` matches "Add project" too** — `has-text` is a
  substring match. Use `getByRole('button', { name: 'Add', exact: true })`.
- **Line count and Mk number are build-time constants** (`vite.config.ts` `define:`), so they
  only change after `npm run build`.

---

## 6. What exists, screen by screen

- **Portfolio** — the scatter of every project by value/budget against phase, leader lines for
  crowded labels, clickable metrics, export the chart as a PDF with a table of what is on it,
  and **Export the review pack**: a PowerPoint deck built to the firm's PRC template (title,
  dashboard, resource overview, one slide per project in progress) from `src/lib/deck.ts`.
- **Resourcing** — person-by-person bars (project work, leave, other work, threshold line),
  people the work needs, **Skillset with no cover**, **Skill by skill**, where the overspill
  comes from, annual leave and public holidays.
- **Financials** — value, billed, to bill, budget burn.
- **Timeline** — every project's span, phase gates, family tabs.
- **Project detail** — phases with baseline and actuals, budget burn, **When the client pays**
  (the invoice list folds to its total; each line says what it waits on and whether that work
  is done), the team grid, what to watch.
- **Workstreams** — standing work with no start and no end (`Project.workstream`). One
  swimlane each across the resourcing window, the plan for whichever is picked, and who is on
  it. Out of the portfolio chart, timeline, financial totals, alerts and the review pack; in
  every resourcing reading. Added and edited by the same project form, which drops every
  dated block for them.
- **Planning** — MS-Project-shaped grid plus Gantt: constraints, four link types, lag, critical
  path, per-task baseline and actuals, multiple people per task each at their own share of a
  day, draggable columns, print to PDF, XLSX out and back.
- **Alerts** — everything the tracker thinks is worth a look.
- **Data** — projects (filter, sort, Project No.), workstreams, people, project types (collapsible families
  and categories), job titles, **Skills** (the matrix), settings (guarded reset and clear),
  JSON and CSV import/export.
- **About** — hidden; double-click the mark. Credit and build number appear on hover.

Versioning is automatic: **Mk N is the commit count**, and the source line count is counted at
build time. Neither is ever typed by hand.

---

## 7. The last three commits (the work in flight)

- `09562ed` **Put the build number in the corner of the About page** — Arabic digits, pinned
  top-right, revealed on logo hover.
- `c526e6d` **Invoices: sales orders, exact sums, what is done, and a list that folds** — plus
  the `invoiceUnit` migration, adjustable invoice columns (`components/TableColumns.tsx`), and
  the Project No. column on the projects table.
- `4ca1258` **A skills matrix, and skills in place of job titles for cover** — Data → Skills,
  skills on both forms, "Skillset with no cover" replacing "Job titles with no cover", and the
  skill-by-skill graphs.

One judgement call worth carrying forward: the job-title shortage reading was **replaced**, not
kept alongside, when skills arrived. Job titles themselves are untouched and still do their
other jobs.

---

## 8. Known gaps and parked decisions

- **No sharing between devices.** Deliberate, and thought through in
  `docs/shared-data-options.md` (parked 11 Aug 2026). The single-document shape means a server
  would be a small change, and that note says how it would be done.
- **No tests, no linter config.** Verification is by browser measurement.
- **The bundle chunk is ~830 kB** and Vite says so on every build. Nobody has minded yet.
- **`tsconfig.tsbuildinfo` and `dist/` are in the working tree**; `.gitignore` covers what
  matters.
- **The plan file** `/root/.claude/plans/snazzy-dreaming-hamming.md` describes work that is
  already committed. It is stale; ignore it.
- **Skills do not yet drive booking.** They report cover; they do not stop you booking somebody
  who lacks the skill, which is how project *families* work today (`Person.types`). That may or
  may not be wanted.

---

## 9. Moving to another Claude Code account

**What travels with the repo** (i.e. everything that matters): the code, the history, the
commit messages, this document.

**What does not travel**:

- The session transcript and its task list. This document replaces them.
- **The data in the browser.** The portfolio lives in `localStorage` on whichever browser
  profile it was entered in. To move real work: **Data → Export JSON** on the old machine,
  **Import JSON** on the new one. CSV export is per-sheet and lossier; JSON is the whole
  portfolio in one file.
- Git credentials. The new account needs push access to `yk13-max/pmo`.

**Checklist**

1. New account: clone `https://github.com/yk13-max/pmo.git`, confirm push access.
2. `npm install`, then `npm run build` to confirm a green build.
3. Read, in this order: `HANDOFF.md` (this file), `src/types.ts`, `src/lib/derive.ts`,
   `src/store/portfolio.tsx`.
4. Export the portfolio JSON from the old browser and import it into the new one, if there is
   real data to keep. The sample portfolio is otherwise a fine starting point.
5. Keep the working contract in §4 — measure, commit with a long message, push.

**Opening prompt for the new session** (paste as-is):

> This repo is Project Glass, a PMO portfolio tracker (React + Vite + TypeScript, browser-local
> storage). Read `HANDOFF.md` at the repo root first, then `src/types.ts`, `src/lib/derive.ts`
> and `src/store/portfolio.tsx` before changing anything.
>
> Work the way that document describes: implement what I ask in the app's own idiom, verify it
> in the browser by measurement with a Playwright probe against the built app, delete the probe,
> commit with a long message explaining the reasoning and quoting what you measured, and push to
> `main`. British English, plain words, generous comments explaining why.
