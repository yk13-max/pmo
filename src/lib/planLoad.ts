import type { Portfolio } from '../types';
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

/** Hours per working day of a task, from its weight. Unset means the whole day. */
function hoursPerDay(weight: number | undefined): number {
  const pct = weight === undefined ? 100 : Math.max(0, Math.min(100, weight));
  return (pct / 100) * WORKING_HOURS_PER_DAY;
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
      /* No one named, or someone who has since left the list, means nothing to book —
         the task still sits in the plan and still drives the dates. */
      if (!task.ownerId || !known.has(task.ownerId)) return;
      const at = plan.byId.get(task.id);
      if (!at) return;
      const perDay = hoursPerDay(task.weight);
      if (perDay <= 0) return;
      /* Walk the task's days and drop each one's hours in the month it falls in. Walking
         the calendar beats arithmetic here: a task straddling a month end splits itself,
         and the weekends it skips are the same ones the scheduler skipped. */
      const day = fromISO(at.startDate);
      const last = fromISO(at.endDate);
      while (day <= last) {
        const weekend = day.getDay() === 0 || day.getDay() === 6;
        if (!weekend) {
          const key = `${project.id}|${task.ownerId}|${monthKey(day)}`;
          out[key] = (out[key] ?? 0) + perDay;
        }
        day.setDate(day.getDate() + 1);
      }
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
