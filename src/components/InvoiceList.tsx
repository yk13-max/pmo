import { useState } from 'react';
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
   whether it has landed. */

type Key = 'label' | 'so' | 'amount' | 'due' | 'waits' | 'done';

const COLUMNS: ColumnSpec<Key>[] = [
  { key: 'label', label: 'What for', width: 180, min: 90 },
  { key: 'so', label: 'Sales order', width: 120, min: 80, title: 'The order in the sales system it is raised against' },
  { key: 'amount', label: 'Amount', width: 130, min: 90, align: 'right' },
  { key: 'due', label: 'Due', width: 110, min: 80 },
  { key: 'waits', label: 'Waits on', width: 240, min: 120 },
  { key: 'done', label: 'Done?', width: 190, min: 90, title: 'Whether the work it waits on has happened yet' },
];

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
  const { widths, resize, reset, isDefault } = useTableWidths('pmo-tracker:invoice-columns', COLUMNS);
  const width = COLUMNS.reduce((n, c) => n + widths[c.key], 0);
  const total = invoices.reduce((n, i) => n + i.amount, 0);
  const body = `invoices-${project.id}`;

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
        </span>
        {open && !isDefault && (
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={reset}>
            Reset columns
          </button>
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
              <tbody>
                {invoices.map((inv) => {
                  const check = checkInvoice(inv, project, project.phases, project.phaseDates, tasks);
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
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
