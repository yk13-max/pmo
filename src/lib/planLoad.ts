import type { Assignee, Portfolio, Task } from '../types';
import { WORKING_HOURS_PER_DAY } from '../types';
import { schedule } from './schedule';
import { fromISO, monthKey } from './dates';

/* Turning a plan into bookings.

   A task occupies a run of working days and takes some share of the person's day while it
   runs — a two-day task at half weight is one day of their time, eight hours, not two. The
   hours land in the months the work actually falls in: a task straddling the turn of a
   month gives each month the hours for its own days, rather than dropping the lot in the
   month it starts.

   Weekends are already out, because the scheduler only ever places work on weekdays. Days
   off are not netted here — leave is capacity, not demand, and the resourcing screen
   already reads the two against each other. */
export type PlanLoad = Record<string, number>;

/** Hours per working day of a task, from a share of a day. Unset means the whole day. */
function hoursPerDay(weight: number | undefined): number {
  const pct = weight === undefined ? 100 : Math.max(0, Math.min(100, weight));
  return (pct / 100) * WORKING_HOURS_PER_DAY;
}

/**
 * Everybody on a task, however the task was written.
 *
 * A plan written before a task could carry more than one person has an owner and a weight
 * instead of a list; it reads as a list of one. Nothing downstream needs to know which it
 * is looking at, which is what keeps every screen and both exports on one answer.
 */
export function assigneesOf(task: Task): Assignee[] {
  if (task.assignees?.length) return task.assignees;
  if (!task.ownerId) return [];
  return [{ personId: task.ownerId, name: task.owner, weight: task.weight ?? 100 }];
}

/** Everybody on a task as one cell of text: "Yusuf 100%; Rachel 20%". */
export function peopleText(task: Task, name: (id: string) => string | undefined): string {
  return assigneesOf(task)
    .map((a) => `${name(a.personId) ?? a.name ?? ''} ${a.weight}%`.trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * That text back into a list. A cell with no percentage is read as somebody's whole day,
 * which is what a person typing one name into a sheet means; a name that matches nobody on
 * the team is kept as written and simply books no time.
 */
export function parsePeople(text: string, people: { id: string; name: string }[]): Assignee[] {
  return String(text ?? '')
    .split(/[;,]/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => {
      const m = piece.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*%?$/);
      const name = (m ? m[1] : piece).trim();
      const weight = m ? Math.max(0, Math.min(100, Math.round(Number(m[2])))) : 100;
      const person = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
      return { personId: person?.id ?? '', name: person?.name ?? name, weight };
    })
    .filter((a) => a.name);
}

/** What a task asks of the team per working day, across everybody on it. */
export function taskDayShare(task: Task): number {
  return assigneesOf(task).reduce((n, a) => n + Math.max(0, Math.min(100, a.weight)), 0);
}

/**
 * Bookings implied by the plans of every project set to book its own people, keyed
 * `${projectId}|${personId}|${month}` in hours — the same shape the stored bookings use,
 * so a screen reading one can read the other without knowing which it has.
 */
export function planAllocations(portfolio: Portfolio): PlanLoad {
  const out: PlanLoad = {};
  const booking = portfolio.projects.filter((p) => p.usesPlan && p.plansResource && !p.archived);
  if (!booking.length) return out;

  const known = new Set(portfolio.people.map((p) => p.id));
  booking.forEach((project) => {
    const tasks = portfolio.tasks.filter((t) => t.projectId === project.id);
    if (!tasks.length) return;
    const plan = schedule(tasks, project.startDate);
    tasks.forEach((task) => {
      const at = plan.byId.get(task.id);
      if (!at) return;
      /* Everybody on it books their own share of their own day. Nobody named, or somebody
         who has since left the list, means nothing to book for them — the task still sits
         in the plan and still drives the dates. */
      assigneesOf(task).forEach((who) => {
        if (!who.personId || !known.has(who.personId)) return;
        const perDay = hoursPerDay(who.weight);
        if (perDay <= 0) return;
        /* Walk the task's days and drop each one's hours in the month it falls in. Walking
           the calendar beats arithmetic here: a task straddling a month end splits itself,
           and the weekends it skips are the same ones the scheduler skipped. */
        const day = fromISO(at.startDate);
        const last = fromISO(at.endDate);
        while (day <= last) {
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          if (!weekend) {
            const key = `${project.id}|${who.personId}|${monthKey(day)}`;
            out[key] = (out[key] ?? 0) + perDay;
          }
          day.setDate(day.getDate() + 1);
        }
      });
    });
  });
  // Half-hours are as fine as the bookings grid goes, so the totals match what it shows.
  Object.keys(out).forEach((k) => {
    out[k] = Math.round(out[k] * 2) / 2;
  });
  return out;
}

/** The projects whose bookings come from their plan, so a screen can say so and lock them. */
export function planBookedProjects(portfolio: Portfolio): Set<string> {
  return new Set(portfolio.projects.filter((p) => p.usesPlan && p.plansResource).map((p) => p.id));
}

/**
 * The stored bookings with plan-driven projects replaced by what their plans imply. Every
 * screen reads this rather than the raw store, so turning the switch on moves the
 * resourcing, the alerts and the portfolio's draw together and by the same numbers.
 *
 * What was typed by hand is not thrown away — it is only set aside while the plan is in
 * charge, and comes back the moment the switch goes off.
 */
export function effectiveAllocations(portfolio: Portfolio): PlanLoad {
  const booked = planBookedProjects(portfolio);
  if (!booked.size) return portfolio.allocations;
  const out: PlanLoad = {};
  Object.entries(portfolio.allocations).forEach(([key, hours]) => {
    if (!booked.has(key.split('|')[0])) out[key] = hours;
  });
  return { ...out, ...planAllocations(portfolio) };
}
