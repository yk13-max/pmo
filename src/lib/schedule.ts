import type { ConstraintType, Dep, Task } from '../types';
import { fromISO, toISO } from './dates';

/* Critical path scheduling over a working-day calendar.
   ────────────────────────────────────────────────────
   Everything here is integer arithmetic on working-day numbers, and only the edges of
   the module deal in dates. That is what keeps the awkward parts — weekends, lag,
   four kinds of link — from tangling with each other.

   Constraints are Microsoft Project's eight, and they meet the links here: a link says
   the earliest a task may go, a constraint says where it is allowed to sit, and where
   the two disagree the constraint wins and the disagreement is reported.

   Weekends are the whole of the calendar. The portfolio does record public holidays,
   but as a count of days per month rather than as dates, so there is no way to say
   which day of March a shutdown falls on; they are left to resourcing, where a count
   is all that is needed.

   No functions here touch React or the store, so the arithmetic can be checked on its
   own and reused anywhere. */

const DAY_MS = 24 * 60 * 60 * 1000;

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** The first working day on or after this one. */
export function nextWorkingDay(d: Date): Date {
  const out = new Date(d);
  while (isWeekend(out)) out.setDate(out.getDate() + 1);
  return out;
}

/** Turns dates into working-day numbers and back, counting from one origin.
    Built once per schedule so every task is measured against the same ruler. */
export class WorkingDays {
  private readonly origin: Date;
  /** Working day n, as an ISO date. Grown on demand. */
  private readonly days: string[] = [];
  private readonly index = new Map<string, number>();

  constructor(origin: Date) {
    this.origin = nextWorkingDay(origin);
    this.grow(64);
  }

  private grow(to: number) {
    const cursor = this.days.length
      ? fromISO(this.days[this.days.length - 1])
      : new Date(this.origin.getTime() - DAY_MS);
    while (this.days.length <= to) {
      cursor.setDate(cursor.getDate() + 1);
      if (isWeekend(cursor)) continue;
      this.index.set(toISO(cursor), this.days.length);
      this.days.push(toISO(cursor));
    }
  }

  /** The date of working day n. Negative numbers walk back before the origin. */
  date(n: number): string {
    if (n < 0) {
      const d = new Date(this.origin);
      let left = -n;
      while (left > 0) {
        d.setDate(d.getDate() - 1);
        if (!isWeekend(d)) left -= 1;
      }
      return toISO(d);
    }
    if (n >= this.days.length) this.grow(n + 32);
    return this.days[n];
  }

  /** Which working day a date is. A weekend counts as the working day that follows it. */
  number(iso: string): number {
    const known = this.index.get(iso);
    if (known !== undefined) return known;
    const d = nextWorkingDay(fromISO(iso));
    const key = toISO(d);
    const found = this.index.get(key);
    if (found !== undefined) return found;
    // Before the origin, or past what has been generated so far.
    if (d.getTime() < this.origin.getTime()) {
      let n = 0;
      const cursor = new Date(this.origin);
      while (cursor.getTime() > d.getTime()) {
        cursor.setDate(cursor.getDate() - 1);
        if (!isWeekend(cursor)) n += 1;
      }
      return -n;
    }
    this.grow(this.days.length + 512);
    return this.index.get(key) ?? this.days.length - 1;
  }
}

/** Which constraints are read on the way forward, and which cap the way back. */
const NEEDS_DATE = new Set<ConstraintType>(['SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO']);

export interface Scheduled {
  task: Task;
  /** Working-day numbers: earliest and latest each end may happen. */
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  /** Working days this task could slip without moving the finish. */
  float: number;
  critical: boolean;
  startDate: string;
  endDate: string;
  /** Set when the links and the constraint cannot both be honoured. */
  conflict: string;
}

export interface Schedule {
  /** Keyed by task id. */
  byId: Map<string, Scheduled>;
  /** In the order they were scheduled, earliest first. */
  ordered: Scheduled[];
  /** Ids caught in a dependency loop. They are left unscheduled rather than hanging. */
  cycles: string[];
  /** Ids named as predecessors that are not in this plan. */
  dangling: string[];
  /** Tasks whose constraint the links cannot satisfy, and why. */
  conflicts: { id: string; message: string }[];
  start: string | null;
  end: string | null;
  /** Working days from the first start to the last finish. */
  span: number;
}

const EMPTY: Schedule = {
  byId: new Map(),
  ordered: [],
  cycles: [],
  dangling: [],
  conflicts: [],
  start: null,
  end: null,
  span: 0,
};

/** Works out when every task in one plan can happen, and which of them cannot slip.

    A task occupies whole working days, so a one-day task starting on day 4 also
    finishes on day 4 — finish is the last day worked, not the day after. */
export function schedule(tasks: Task[], planStart?: string): Schedule {
  if (!tasks.length) return EMPTY;

  const known = new Set(tasks.map((t) => t.id));
  const dangling = new Set<string>();
  /** Only links to tasks in this plan can be honoured; the rest are reported. */
  const depsOf = (t: Task) =>
    t.deps.filter((d) => {
      if (known.has(d.id) && d.id !== t.id) return true;
      if (!known.has(d.id)) dangling.add(d.id);
      return false;
    });

  /* The ruler starts at the earliest date anybody named, or at the project's own start —
     which is also where a task that is as-soon-as-possible with nothing to wait on goes. */
  const dated = tasks.filter((t) => NEEDS_DATE.has(t.constraint) && t.constraintDate).map((t) => t.constraintDate);
  const earliest = [planStart, ...dated].filter(Boolean).sort()[0] ?? tasks[0].constraintDate ?? toISO(new Date());
  const clock = new WorkingDays(fromISO(earliest));
  const duration = (t: Task) => Math.max(1, Math.round(t.days));

  /* Kahn's algorithm: peel off tasks whose predecessors are all placed. Anything still
     standing at the end is in a loop, and is reported rather than scheduled — a plan
     that eats itself should say so, not spin. */
  const waitingOn = new Map<string, number>();
  const feeds = new Map<string, string[]>();
  tasks.forEach((t) => {
    waitingOn.set(t.id, depsOf(t).length);
    depsOf(t).forEach((d) => feeds.set(d.id, [...(feeds.get(d.id) ?? []), t.id]));
  });
  const queue = tasks.filter((t) => (waitingOn.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    (feeds.get(id) ?? []).forEach((next) => {
      const left = (waitingOn.get(next) ?? 0) - 1;
      waitingOn.set(next, left);
      if (left === 0) queue.push(next);
    });
  }
  const placed = new Set(order);
  const cycles = tasks.filter((t) => !placed.has(t.id)).map((t) => t.id);

  const byId = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const origin = clock.number(earliest);
  const anchorOf = (t: Task) => clock.number(t.constraintDate || earliest);

  /** The earliest day the links alone would allow, or null when nothing waits on. */
  const drivenStart = (t: Task, es: Map<string, number>, ef: Map<string, number>) => {
    const links = depsOf(t);
    if (!links.length) return null;
    const d = duration(t);
    return Math.max(
      ...links.map((link) => {
        const ps = es.get(link.id) ?? 0;
        const pf = ef.get(link.id) ?? 0;
        return link.type === 'FS' ? pf + 1 + link.lag
          : link.type === 'SS' ? ps + link.lag
          // Finish-to-finish and start-to-finish constrain this task's finish, so the
          // start is read back off the duration.
          : link.type === 'FF' ? pf + link.lag - d + 1
          : ps + link.lag - d + 1;
      }),
    );
  };

  /* One pass of the arithmetic. `pinned` holds tasks whose start has been fixed for this
     round, which is how as-late-as-possible is settled: it needs the backward pass to
     know how late "as late" is, so it is solved, pinned, and solved again. */
  const solve = (pinned: Map<string, number>) => {
    const es = new Map<string, number>();
    const ef = new Map<string, number>();
    const conflicts: { id: string; message: string }[] = [];

    order.forEach((id) => {
      const t = byId.get(id) as Task;
      const d = duration(t);
      const driven = drivenStart(t, es, ef);
      const anchor = anchorOf(t);
      let start: number;
      switch (t.constraint) {
        // Nothing to wait on means nothing to be early relative to, so it goes at the top.
        case 'ASAP':
        case 'ALAP':
          start = driven ?? origin;
          break;
        case 'SNET':
          start = Math.max(driven ?? anchor, anchor);
          break;
        case 'FNET':
          start = Math.max(driven ?? anchor - d + 1, anchor - d + 1);
          break;
        // The "no later than" pair do not pull a task earlier; they cap it on the way
        // back, and say so when the links have already pushed it past the date.
        case 'SNLT':
          start = driven ?? anchor;
          if (start > anchor) conflicts.push({ id, message: `cannot start by ${clock.date(anchor)} — what it waits on pushes it to ${clock.date(start)}` });
          break;
        case 'FNLT':
          start = driven ?? anchor - d + 1;
          if (start + d - 1 > anchor) conflicts.push({ id, message: `cannot finish by ${clock.date(anchor)} — what it waits on pushes it to ${clock.date(start + d - 1)}` });
          break;
        // The two "must" constraints are pins: the date wins over the links outright.
        case 'MSO':
          start = anchor;
          if (driven !== null && driven > anchor) conflicts.push({ id, message: `pinned to start ${clock.date(anchor)}, but what it waits on is not done until ${clock.date(driven - 1)}` });
          break;
        default:
          start = anchor - d + 1;
          if (driven !== null && driven > start) conflicts.push({ id, message: `pinned to finish ${clock.date(anchor)}, but what it waits on would not let it start until ${clock.date(driven)}` });
          break;
      }
      const fixed = pinned.get(id);
      if (fixed !== undefined) start = fixed;
      es.set(id, start);
      ef.set(id, start + d - 1);
    });

    const finish = order.length ? Math.max(...order.map((id) => ef.get(id) ?? 0)) : 0;

    /* Backward pass. Each task may finish as late as its successors allow — and if it has
       none, as late as the plan itself ends — then a constraint may pull that in further. */
    const lf = new Map<string, number>();
    const ls = new Map<string, number>();
    [...order].reverse().forEach((id) => {
      const t = byId.get(id) as Task;
      const d = duration(t);
      let latest = finish;
      (feeds.get(id) ?? []).filter((sid) => placed.has(sid)).forEach((sid) => {
        const succ = byId.get(sid) as Task;
        const link = depsOf(succ).find((x) => x.id === id);
        if (!link) return;
        const sls = ls.get(sid) ?? finish;
        const slf = lf.get(sid) ?? finish;
        const allows =
          link.type === 'FS' ? sls - 1 - link.lag
          : link.type === 'SS' ? sls - link.lag + d - 1
          : link.type === 'FF' ? slf - link.lag
          : slf - link.lag + d - 1;
        if (allows < latest) latest = allows;
      });
      const anchor = anchorOf(t);
      if (t.constraint === 'SNLT') latest = Math.min(latest, anchor + d - 1);
      if (t.constraint === 'FNLT') latest = Math.min(latest, anchor);
      if (t.constraint === 'MSO') latest = anchor + d - 1;
      if (t.constraint === 'MFO') latest = anchor;
      lf.set(id, latest);
      ls.set(id, latest - d + 1);
    });

    return { es, ef, ls, lf, finish, conflicts };
  };

  /* As-late-as-possible needs to know how much room it has before it can use it, so the
     plan is solved, those tasks are pinned to their late starts, and it is solved again.
     Moving a task inside its own float cannot push the finish out, so this settles — the
     loop stops as soon as the pins stop moving. */
  const alap = order.filter((id) => (byId.get(id) as Task).constraint === 'ALAP');
  let pinned = new Map<string, number>();
  let run = solve(pinned);
  for (let i = 0; alap.length && i < 4; i += 1) {
    const next = new Map(alap.map((id) => [id, run.ls.get(id) ?? run.es.get(id) ?? 0]));
    if (alap.every((id) => next.get(id) === pinned.get(id))) break;
    pinned = next;
    run = solve(pinned);
  }
  const { es, ef, ls, lf, finish, conflicts } = run;

  const ordered = order
    .map((id) => {
      const task = byId.get(id) as Task;
      const earlyStart = es.get(id) ?? 0;
      const earlyFinish = ef.get(id) ?? 0;
      const lateStart = ls.get(id) ?? earlyStart;
      const slack = lateStart - earlyStart;
      const clash = conflicts.find((c) => c.id === id)?.message ?? '';
      return {
        task,
        earlyStart,
        earlyFinish,
        lateStart,
        lateFinish: lf.get(id) ?? earlyFinish,
        float: slack,
        // Zero slack means every day of delay here is a day of delay for the whole plan.
        critical: slack <= 0,
        startDate: clock.date(earlyStart),
        endDate: clock.date(earlyFinish),
        conflict: clash,
      };
    })
    .sort((a, b) => a.earlyStart - b.earlyStart || a.earlyFinish - b.earlyFinish);

  const first = ordered.length ? Math.min(...ordered.map((s) => s.earlyStart)) : 0;
  return {
    byId: new Map(ordered.map((s) => [s.task.id, s])),
    ordered,
    cycles,
    dangling: [...dangling],
    conflicts,
    start: ordered.length ? clock.date(first) : null,
    end: ordered.length ? clock.date(finish) : null,
    span: ordered.length ? finish - first + 1 : 0,
  };
}

/** Predecessors written the way a planner writes them: `3FS+2, 5SS-1`. */
export function depsToText(deps: Dep[], numberOf: (id: string) => number | null): string {
  return deps
    .map((d) => {
      const n = numberOf(d.id);
      if (n === null) return '';
      const lag = d.lag > 0 ? `+${d.lag}` : d.lag < 0 ? `${d.lag}` : '';
      // Finish-to-start with no lag is the ordinary case and goes without saying.
      return d.type === 'FS' && !d.lag ? `${n}` : `${n}${d.type}${lag}`;
    })
    .filter(Boolean)
    .join(', ');
}

export interface ParsedDeps {
  deps: Dep[];
  /** What was wrong, in words, if anything was. */
  error: string;
}

/** Reads that notation back. Anything it cannot make sense of is reported rather than
    quietly dropped, so a typo does not silently unlink two tasks. */
export function parseDeps(text: string, idOf: (n: number) => string | null, selfNumber: number): ParsedDeps {
  const deps: Dep[] = [];
  const parts = text.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = /^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+)?$/i.exec(part);
    if (!m) return { deps: [], error: `“${part}” is not a task number, optionally with FS, SS, FF or SF and a lag.` };
    const n = Number(m[1]);
    if (n === selfNumber) return { deps: [], error: 'A task cannot wait on itself.' };
    const id = idOf(n);
    if (!id) return { deps: [], error: `There is no task ${n} in this plan.` };
    if (deps.some((d) => d.id === id)) return { deps: [], error: `Task ${n} is listed twice.` };
    deps.push({
      id,
      type: (m[2]?.toUpperCase() as Dep['type']) ?? 'FS',
      lag: m[3] ? Number(m[3].replace(/\s+/g, '')) : 0,
    });
  }
  return { deps, error: '' };
}
