import type { Invoice, Portfolio, Project, Task } from '../types';
import { schedule } from './schedule';

/* When an invoice and the work it is tied to disagree.

   The tie is a reference, not a rule: listing an invoice against the handover gate does not
   move the invoice when the gate moves, and dating the invoice does not move the gate. What
   it buys is the disagreement being visible. An invoice raised on handover cannot be raised
   before the handover happens, so when the thing it waits on now finishes after the invoice
   is due, the date is wrong and somebody has to decide which of the two to change.

   Nothing here corrects anything. It answers one question — is this date still possible —
   and leaves the answer to a person. */

export interface InvoiceCheck {
  /** What the invoice waits on, written out. Empty when it stands on its own. */
  waitsOn: string;
  /** When that finishes, as the project currently has it. */
  finishes: string;
  /** True when the work lands after the invoice is due, so the date cannot hold. */
  late: boolean;
  /** Days between the two, positive when the work is later than the invoice. */
  by: number;
}

const DAY = 86_400_000;

/**
 * Read one invoice against whatever it is tied to.
 *
 * @param invoice The invoice.
 * @param project The project it belongs to, with its phases and gates.
 * @param phases The phase names of the project's category.
 * @param gates The gate dates in force — mirrored from the plan where that is on.
 * @param tasks The project's tasks, for an invoice tied to one.
 */
export function checkInvoice(
  invoice: Invoice,
  project: Project,
  phases: string[],
  gates: string[],
  tasks: Task[],
): InvoiceCheck {
  let waitsOn = '';
  let finishes = '';

  if (invoice.phase !== undefined && phases[invoice.phase]) {
    waitsOn = phases[invoice.phase];
    finishes = gates[invoice.phase] ?? '';
  } else if (invoice.taskId) {
    const task = tasks.find((t) => t.id === invoice.taskId);
    if (task) {
      waitsOn = task.name;
      /* The plan's own answer, not the constraint typed on the task: what matters is when
         the work actually lands once everything it waits on has had its say. */
      finishes =
        task.actualFinish ||
        schedule(tasks, project.startDate).byId.get(task.id)?.endDate ||
        '';
    }
  }

  if (!waitsOn || !finishes || !invoice.due) return { waitsOn, finishes, late: false, by: 0 };
  const by = Math.round((new Date(finishes).getTime() - new Date(invoice.due).getTime()) / DAY);
  return { waitsOn, finishes, late: by > 0, by };
}

/** Every invoice listed against one project, oldest first. */
export function invoicesOf(portfolio: Portfolio, projectId: string): Invoice[] {
  return portfolio.invoices.filter((i) => i.projectId === projectId).sort((a, b) => a.due.localeCompare(b.due));
}
