import type { Dep, Task } from '../types';
import { fromISO, toISO } from './dates';

/* Critical path scheduling over a working-day calendar.
   ────────────────────────────────────────────────────
   Everything here is integer arithmetic on working-day numbers, and only the edges of
   the module deal in dates. That is what keeps the awkward parts — weekends, lag,
   four kinds of link — from tangling with each other.

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
  start: null,
  end: null,
  span: 0,
};

/** Works out when every task in one plan can happen, and which of them cannot slip.

    A task occupies whole working days, so a one-day task starting on day 4 also
    finishes on day 4 — finish is the last day worked, not the day after. */
export function schedule(tasks: Task[]): Schedule {
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

  const earliest = tasks.reduce((min, t) => (t.start && t.start < min ? t.start : min), tasks[0].start);
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
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  /* Forward pass. Each link says the earliest day this task may start; the task takes
     the latest of them, and its own start date is the floor when nothing binds it. */
  order.forEach((id) => {
    const t = byId.get(id) as Task;
    const d = duration(t);
    let start = clock.number(t.start);
    depsOf(t).forEach((link) => {
      const ps = es.get(link.id) ?? 0;
      const pf = ef.get(link.id) ?? 0;
      const wants =
        link.type === 'FS' ? pf + 1 + link.lag
        : link.type === 'SS' ? ps + link.lag
        // Finish-to-finish and start-to-finish constrain this task's finish, so the
        // start is read back off the duration.
        : link.type === 'FF' ? pf + link.lag - d + 1
        : ps + link.lag - d + 1;
      if (wants > start) start = wants;
    });
    es.set(id, start);
    ef.set(id, start + d - 1);
  });

  const finish = order.length ? Math.max(...order.map((id) => ef.get(id) ?? 0)) : 0;

  /* Backward pass. Walking the same order in reverse, each task may finish as late as
     its successors allow — and if it has none, as late as the plan itself ends. */
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  [...order].reverse().forEach((id) => {
    const t = byId.get(id) as Task;
    const d = duration(t);
    let latest = finish;
    (feeds.get(id) ?? []).filter((s) => placed.has(s)).forEach((sid) => {
      const s = byId.get(sid) as Task;
      const link = depsOf(s).find((x) => x.id === id);
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
    lf.set(id, latest);
    ls.set(id, latest - d + 1);
  });

  const ordered = order
    .map((id) => {
      const task = byId.get(id) as Task;
      const earlyStart = es.get(id) ?? 0;
      const earlyFinish = ef.get(id) ?? 0;
      const lateStart = ls.get(id) ?? earlyStart;
      const slack = lateStart - earlyStart;
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
      };
    })
    .sort((a, b) => a.earlyStart - b.earlyStart || a.earlyFinish - b.earlyFinish);

  const first = ordered.length ? Math.min(...ordered.map((s) => s.earlyStart)) : 0;
  return {
    byId: new Map(ordered.map((s) => [s.task.id, s])),
    ordered,
    cycles,
    dangling: [...dangling],
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
