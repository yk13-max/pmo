import { Fragment, useMemo, useState } from 'react';
import type { Invoice, Task } from '../types';
import type { ProjectView } from '../lib/derive';
import { moneyExact } from '../lib/derive';
import { shortDateYear } from '../lib/dates';
import { checkInvoice } from '../lib/invoices';
import { ResizableHead, useTableWidths, type ColumnSpec } from './TableColumns';

/* The invoices a project expects to raise, on the page about being paid.

   Folded shut it is one line: what the invoices come to. That is the figure somebody arriving
   at this tab is usually after, and a project invoicing in eleven pieces should not have to
   push everything below it off the screen to say so. Open, it is the list — and the list
   answers two questions that only it can. Is this date still possible, which is the red one;
   and has the work behind it actually happened, which is the column on the right.

   The second question is the one a finance conversation actually turns on. An invoice tied to
   the validation gate is not raiseable because its date has come round; it is raiseable
   because validation is done. So the tie is read both ways here: when the work lands, and
   whether it has landed.

   The list is grouped by sales order, because that is the unit the other side of the business
   works in. Several invoices are raised against one order, and the questions asked of an order
   are asked of the whole of it: what is it worth, how much of it has been earned, is any of it
   stuck. So each order is a set with its own subtotal, and each set folds — an order that is
   settled and understood can be put away without hiding the two that are not. */

type Key = 'label' | 'so' | 'amount' | 'due' | 'waits' | 'done';

const COLUMNS: ColumnSpec<Key>[] = [
  { key: 'label', label: 'What for', width: 180, min: 90 },
  { key: 'so', label: 'Sales order', width: 120, min: 80, title: 'The order in the sales system it is raised against' },
  { key: 'amount', label: 'Amount', width: 130, min: 90, align: 'right' },
  { key: 'due', label: 'Due', width: 110, min: 80 },
  { key: 'waits', label: 'Waits on', width: 240, min: 120 },
  { key: 'done', label: 'Done?', width: 190, min: 90, title: 'Whether the work it waits on has happened yet' },
];

/** One sales order's worth of invoices, and what the set comes to. */
interface OrderSet {
  /** The order's own reference, or '' for the invoices raised against none. */
  key: string;
  label: string;
  invoices: Invoice[];
  total: number;
  /** The earliest date anything in the set is due, which is what the sets are ordered by. */
  first: string;
}

/**
 * The invoices, gathered under the sales order each is raised against.
 *
 * Matched case-insensitively and without surrounding space, since a reference typed twice is
 * the same order however it was typed; the spelling kept is the first one seen. Invoices with
 * no order are a set of their own — they are a real category, not a failure to fill something
 * in, and an invoice can perfectly well stand outside the sales system. That set sorts last;
 * the rest sort by when they first fall due, which is the order they will be dealt with in.
 */
function groupBySalesOrder(invoices: Invoice[]): OrderSet[] {
  const sets = new Map<string, OrderSet>();
  invoices.forEach((invoice) => {
    const written = (invoice.salesOrder ?? '').trim();
    const key = written.toLowerCase();
    const set =
      sets.get(key) ??
      { key, label: written || 'No sales order', invoices: [], total: 0, first: '' };
    set.invoices.push(invoice);
    set.total += invoice.amount;
    if (invoice.due && (!set.first || invoice.due < set.first)) set.first = invoice.due;
    sets.set(key, set);
  });
  const out = [...sets.values()];
  out.forEach((set) => set.invoices.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')));
  return out.sort((a, b) => {
    if (!a.key !== !b.key) return a.key ? -1 : 1;
    return (a.first || '9999').localeCompare(b.first || '9999');
  });
}

export function InvoiceList({
  project,
  invoices,
  tasks,
}: {
  project: ProjectView;
  invoices: Invoice[];
  tasks: Task[];
}) {
  const [open, setOpen] = useState(false);
  /* Which sets are folded away. Held as the exception rather than the rule, so a set opens
     the moment an invoice is added to it and a project's sets do not all have to be listed
     here to be shown. */
  const [shut, setShut] = useState<Set<string>>(new Set());
  const { widths, resize, reset, isDefault } = useTableWidths('pmo-tracker:invoice-columns', COLUMNS);
  const width = COLUMNS.reduce((n, c) => n + widths[c.key], 0);
  const total = invoices.reduce((n, i) => n + i.amount, 0);
  const body = `invoices-${project.id}`;
  const sets = useMemo(() => groupBySalesOrder(invoices), [invoices]);
  /* Sales orders proper — the unnumbered set is not one, so it is not counted as one. */
  const orderCount = sets.filter((s) => s.key).length;
  const allShut = sets.every((s) => shut.has(s.key));
  const fold = (key: string) =>
    setShut((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
          aria-expanded={open}
          aria-controls={body}
          title={open ? 'Fold the invoices away' : 'Show each invoice, what it waits on and whether that is done'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}
          >
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h3 style={{ margin: 0 }}>The invoices</h3>
        {/* Shut, this is the whole of it: what they come to, and how many they are. */}
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
          {moneyExact(total, project.currency)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          across {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
          {orderCount ? ` in ${orderCount} sales order${orderCount === 1 ? '' : 's'}` : ''}
        </span>
        {open && (
          <span style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            {/* One click to the summary and back: every set shut is the list read as orders
                and what each is worth, which is a different question from the invoices. */}
            {sets.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShut(allShut ? new Set() : new Set(sets.map((s) => s.key)))}
              >
                {allShut ? 'Unfold all' : 'Fold all'}
              </button>
            )}
            {!isDefault && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Reset columns
              </button>
            )}
          </span>
        )}
      </div>
      {open && (
        <div id={body}>
          <p className="lede" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>
            A date in red is one the work it waits on now lands after — which of the two moves is a decision, not a
            correction, so nothing here has been adjusted. Drag a heading&rsquo;s right edge to give a column more room.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ tableLayout: 'fixed', width }}>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <ResizableHead key={c.key} col={c} width={widths[c.key]} onResize={resize} />
                  ))}
                </tr>
              </thead>
              {sets.map((set) => {
                const folded = shut.has(set.key);
                const rowsId = `${body}-set-${set.key ? set.key.replace(/[^a-z0-9]+/gi, '-') : 'none'}`;
                const checks = set.invoices.map((inv) =>
                  checkInvoice(inv, project, project.phases, project.phaseDates, tasks),
                );
                /* What the set says about itself while it is shut. The subtotal is the
                   figure the order is discussed in; the rest is why you might open it. */
                const tied = checks.filter((c) => c.done !== null);
                const done = tied.filter((c) => c.done).length;
                const late = checks.filter((c) => c.late).length;
                return (
                  <Fragment key={set.key || '(none)'}>
                    <tbody className="invoice-set">
                      <tr>
                        <td colSpan={COLUMNS.length}>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '2px 5px', display: 'inline-flex', alignItems: 'center', alignSelf: 'center' }}
                              aria-expanded={!folded}
                              aria-controls={rowsId}
                              title={folded ? `Show the invoices under ${set.label}` : `Fold ${set.label} away`}
                              onClick={() => fold(set.key)}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 12 12"
                                aria-hidden="true"
                                focusable="false"
                                style={{ transform: folded ? 'none' : 'rotate(90deg)', transition: 'transform 120ms ease' }}
                              >
                                <path
                                  d="M4 2l4 4-4 4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <span
                              style={{
                                fontFamily: 'var(--font-heading)',
                                fontWeight: 600,
                                fontVariantNumeric: 'tabular-nums',
                                color: set.key ? undefined : 'var(--color-neutral-700)',
                              }}
                            >
                              {set.label}
                            </span>
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {moneyExact(set.total, project.currency)}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                              {set.invoices.length} invoice{set.invoices.length === 1 ? '' : 's'}
                              {tied.length ? ` · ${done} of ${tied.length} earned` : ''}
                            </span>
                            {late > 0 && (
                              <span style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>
                                {late === 1 ? 'one date the work lands after' : `${late} dates the work lands after`}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                    {/* Hidden rather than removed, so the button above always controls
                        something a screen reader can find. */}
                    <tbody id={rowsId} hidden={folded}>
                {set.invoices.map((inv, i) => {
                  const check = checks[i];
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{inv.label}</td>
                      <td style={{ fontSize: 13, color: 'var(--color-neutral-700)', fontVariantNumeric: 'tabular-nums' }}>
                        {inv.salesOrder || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {moneyExact(inv.amount, project.currency)}
                      </td>
                      <td
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          color: check.late ? 'var(--color-accent-2-700)' : undefined,
                          fontWeight: check.late ? 600 : undefined,
                        }}
                      >
                        {inv.due ? shortDateYear(inv.due) : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                        {check.waitsOn ? (
                          <>
                            {check.waitsOn}
                            {check.finishes && ` · ${shortDateYear(check.finishes)}`}
                            {check.late && (
                              <span style={{ color: 'var(--color-accent-2-700)' }}> · {check.by}d after the invoice</span>
                            )}
                          </>
                        ) : (
                          'Nothing — it stands on its own'
                        )}
                      </td>
                      {/* Teal for done, amber for not yet — the same amber the tracker uses
                          everywhere for "watch this". An invoice tied to nothing is neither,
                          and says so. */}
                      <td style={{ fontSize: 13 }}>
                        {check.done === null ? (
                          <span style={{ color: 'var(--color-neutral-600)' }}>—</span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                flex: 'none',
                                alignSelf: 'center',
                                background: check.done ? 'var(--color-teal-700)' : 'var(--color-warning)',
                              }}
                            />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ fontWeight: 600 }}>{check.done ? 'Done' : 'Not yet'}</span>
                              <span style={{ display: 'block', color: 'var(--color-neutral-700)', fontSize: 12 }}>
                                {check.doneNote}
                              </span>
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                    </tbody>
                  </Fragment>
                );
              })}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
