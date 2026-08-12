import type { PortfolioView, ProjectView } from '../lib/derive';
import { money, RAG_ORDER } from '../lib/derive';
import { SortHeaders, useSortedRows, type SortColumn } from '../components/SortHeaders';
import { BASE_CURRENCY, CURRENCIES } from '../types';
import { Stat } from '../components/Stat';
import { Tabs } from '../components/Tabs';

/* The customer table sorts the same way the project list on Data does. Money columns sort
   on the base-currency figure, so a portfolio billed in three currencies still ranks
   honestly while each row goes on showing what that client is actually charged. */
const CUSTOMER_COLUMNS: SortColumn<ProjectView>[] = [
  { id: 'name', label: 'Project', sortBy: (p) => p.name.toLowerCase() },
  { id: 'type', label: 'Type', width: 64, sortBy: (p) => p.typeShort },
  { id: 'budget', label: 'Budget', width: 96, align: 'right', sortBy: (p) => p.budget, firstDir: 'desc' },
  { id: 'actual', label: 'Spent so far', width: 110, align: 'right', sortBy: (p) => p.actual, firstDir: 'desc' },
  { id: 'burn', label: 'Budget used', width: 96, align: 'right', sortBy: (p) => p.burn, firstDir: 'desc' },
  { id: 'currency', label: 'Billed in', width: 82, sortBy: (p) => p.currencyLabel },
  { id: 'value', label: 'Client agreed', width: 110, align: 'right', sortBy: (p) => p.valueBase, firstDir: 'desc' },
  { id: 'billed', label: 'Invoiced', width: 96, align: 'right', sortBy: (p) => p.billedBase, firstDir: 'desc' },
  { id: 'tobill', label: 'Still to invoice', width: 110, align: 'right', sortBy: (p) => p.valueBase - p.billedBase, firstDir: 'desc' },
  { id: 'rag', label: 'Status', width: 100, sortBy: (p) => RAG_ORDER[p.rag] },
];

export function Financials({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const customer = view.projects.filter((p) => p.cust);
  const { rows: customerRows, sort: customerSort, setSort: setCustomerSort } = useSortedRows(
    customer,
    CUSTOMER_COLUMNS,
    { id: 'name', dir: 'asc' },
    (p) => p.name,
  );
  const internal = view.projects.filter((p) => !p.cust);
  const nearlySpent = view.projects.filter((p) => p.burn > 95);

  /* Clients are billed in their own currency, so every bar and total is measured in the base
     currency — the figures beside them stay in what the client actually pays. */
  const maxValue = Math.max(1, ...customer.map((p) => Math.max(p.valueBase, Math.round(p.budget * 1.35))));
  const maxInternal = Math.max(1, ...internal.map((p) => p.budget));

  const invoiceBars = [...customer].sort((a, b) => b.valueBase - b.billedBase - (a.valueBase - a.billedBase));
  /* An indicative view of what a project could still grow to: the share of its budget not
     yet covered by agreed value. Shown in a third colour so it never reads as committed. */
  const prospect = (p: ProjectView) => Math.max(0, Math.round(p.budget * 1.35) - p.valueBase);
  const drawBars = [...internal].sort((a, b) => b.budget - a.budget);
  const mixed = new Set(customer.map((p) => p.currency)).size > 1;
  const inBase = `In ${CURRENCIES[BASE_CURRENCY].symbol}${BASE_CURRENCY}${mixed ? ', converted from mixed currencies' : ''}`;

  return (
    <div>
      <div className="stat-row">
        <Stat
          value={money(view.totals.value)}
          label="Agreed with clients"
          sub={`Across ${view.totals.customerCount} customer projects · ${inBase}`}
        />
        <Stat
          value={money(view.totals.billed)}
          label="Invoiced so far"
          sub={view.totals.value ? `${Math.round((view.totals.billed / view.totals.value) * 100)}% of what was agreed` : 'Nothing agreed yet'}
        />
        <Stat
          value={money(view.totals.internalBudget - view.totals.internalDrawn)}
          label="Internal budget left"
          sub={`${money(view.totals.internalDrawn)} of ${money(view.totals.internalBudget)} spent`}
        />
        <Stat
          value={nearlySpent.length}
          label="Budgets nearly gone"
          sub={nearlySpent.map((p) => `${p.name} at ${p.burnLabel} spent`).join(' · ') || 'Nothing above 95% spent'}
          color="var(--color-accent-2-700)"
        />
      </div>

      <Tabs
        storageKey="financials"
        tabs={[
          {
            id: 'invoiced',
            label: 'Invoicing',
            count: money(view.totals.toBill),
            render: () => (
              <>
      <h3 style={{ margin: '0 0 4px' }}>How much we have invoiced</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        The full bar is what the client agreed to pay, the dark part what we have invoiced, and the pale teal beyond it an
        indicative view of further scope this work could still grow into. The projects with the most left to bill come
        first. Bars are drawn in {CURRENCIES[BASE_CURRENCY].symbol}
        {BASE_CURRENCY} so they compare; the figures are what each client is billed.
      </p>
      <div className="legend" style={{ marginBottom: 'var(--space-6)' }}>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-text)', display: 'block' }} />
          Invoiced
        </span>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-neutral-300)', display: 'block' }} />
          Agreed but not yet invoiced
        </span>
        <span>
          <span style={{ width: 14, height: 12, background: 'var(--color-teal-300)', display: 'block' }} />
          Scope in prospect — indicative, not agreed
        </span>
      </div>
      {invoiceBars.length === 0 ? (
        <p className="empty" style={{ maxWidth: 1040 }}>No customer projects yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 1040 }}>
          {invoiceBars.map((p) => (
            <MoneyBar
              key={p.id}
              project={p}
              onOpen={() => onOpenProject(p.id)}
              trackWidth={(p.valueBase / maxValue) * 100}
              prospectWidth={((p.valueBase + prospect(p)) / maxValue) * 100}
              fillWidth={(p.billedBase / maxValue) * 100}
              fillColor="var(--color-text)"
              main={
                <>
                  {p.billedLabel} <span style={{ color: 'var(--color-neutral-600)' }}>/ {p.valueLabel}</span>
                </>
              }
              trailing={p.toBillLabel}
            />
          ))}
        </div>
      )}

              </>
            ),
          },
          {
            id: 'detail',
            label: 'Customer detail',
            count: customer.length,
            render: () => (
              <>
      <h3 style={{ margin: '0 0 4px' }}>Customer detail</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ marginTop: 'var(--space-4)' }}>
          <thead>
            <SortHeaders columns={CUSTOMER_COLUMNS} sort={customerSort} setSort={setCustomerSort} />
          </thead>
          <tbody>
            {customerRows.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                    <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      {p.name}
                    </span>
                    <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}> · {p.client}</span>
                  </button>
                </td>
                <td style={{ color: 'var(--color-neutral-700)', fontSize: 13 }}>{p.typeShort}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.budgetLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.actualLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.burnInk }}>{p.burnLabel}</td>
                <td style={{ color: 'var(--color-neutral-700)', fontSize: 13 }}>{p.currencyLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.valueLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.billedLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>{p.toBillLabel}</td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: p.ragColor }} />
                    {p.ragLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

              </>
            ),
          },
          {
            id: 'internal',
            label: 'Internal draw-down',
            count: internal.length,
            render: () => (
              <>
      <h3 style={{ margin: '0 0 4px' }}>Internal draw-down</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-6)' }}>
        Cost-tracked only. Each calls against an approved pool; there is no invoice side.
      </p>
      {drawBars.length === 0 ? (
        <p className="empty" style={{ maxWidth: 1040 }}>No internal projects yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 1040 }}>
          {drawBars.map((p) => (
            <MoneyBar
              key={p.id}
              project={p}
              onOpen={() => onOpenProject(p.id)}
              trackWidth={(p.budget / maxInternal) * 100}
              fillWidth={(p.actual / maxInternal) * 100}
              fillColor={p.burnInk2}
              main={
                <>
                  {p.actualLabel} <span style={{ color: 'var(--color-neutral-600)' }}>/ {p.budgetLabel}</span>
                </>
              }
              trailing={`${p.burnLabel} drawn`}
            />
          ))}
        </div>
      )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

function MoneyBar({
  project,
  trackWidth,
  prospectWidth,
  fillWidth,
  fillColor,
  main,
  trailing,
  onOpen,
}: {
  project: ProjectView;
  trackWidth: number;
  /** Optional third band beyond the agreed value — indicative scope, not committed. */
  prospectWidth?: number;
  fillWidth: number;
  fillColor: string;
  main: React.ReactNode;
  trailing: string;
  onOpen: () => void;
}) {
  return (
    <div className="money-row" style={{ display: 'grid', gridTemplateColumns: '236px 1fr 108px 100px', alignItems: 'center', gap: 'var(--space-4)' }}>
      <button type="button" className="card-link" onClick={onOpen}>
        <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>
          {project.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          {project.client} · {project.typeShort}
        </div>
      </button>
      <div style={{ height: 14, background: 'var(--color-neutral-200)', position: 'relative' }}>
        {prospectWidth !== undefined && (
          <div
            title="Indicative further scope — not agreed"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prospectWidth}%`, background: 'var(--color-teal-300)' }}
          />
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${trackWidth}%`, background: 'var(--color-neutral-300)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fillWidth}%`, background: fillColor }} />
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{main}</div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--color-neutral-700)' }}>
        {trailing}
      </div>
    </div>
  );
}
