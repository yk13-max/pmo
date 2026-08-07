import type { PortfolioView, ProjectView } from '../lib/derive';
import { money } from '../lib/derive';
import { Stat } from '../components/Stat';
import { Tabs } from '../components/Tabs';

export function Financials({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const customer = view.projects.filter((p) => p.cust);
  const internal = view.projects.filter((p) => !p.cust);
  const nearlySpent = view.projects.filter((p) => p.burn > 95);

  const maxValue = Math.max(1, ...customer.map((p) => Math.max(p.value, Math.round(p.budget * 1.35))));
  const maxInternal = Math.max(1, ...internal.map((p) => p.budget));

  const invoiceBars = [...customer].sort((a, b) => b.value - b.billed - (a.value - a.billed));
  /* An indicative view of what a project could still grow to: the share of its budget not
     yet covered by agreed value. Shown in a third colour so it never reads as committed. */
  const prospect = (p: ProjectView) => Math.max(0, Math.round(p.budget * 1.35) - p.value);
  const drawBars = [...internal].sort((a, b) => b.budget - a.budget);

  return (
    <div>
      <div className="stat-row">
        <Stat
          value={money(view.totals.value)}
          label="Agreed with clients"
          sub={`Across ${view.totals.customerCount} customer projects`}
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
        first.
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
        <p className="empty" style={{ maxWidth: 1040 }}>No customer-facing projects yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 1040 }}>
          {invoiceBars.map((p) => (
            <MoneyBar
              key={p.id}
              project={p}
              onOpen={() => onOpenProject(p.id)}
              trackWidth={(p.value / maxValue) * 100}
              prospectWidth={((p.value + prospect(p)) / maxValue) * 100}
              fillWidth={(p.billed / maxValue) * 100}
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
            label: 'Customer-facing detail',
            count: customer.length,
            render: () => (
              <>
      <h3 style={{ margin: '0 0 4px' }}>Customer-facing detail</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ marginTop: 'var(--space-4)' }}>
          <thead>
            <tr>
              <th>Project</th>
              <th style={{ width: 64 }}>Type</th>
              <th style={{ textAlign: 'right', width: 96 }}>Budget</th>
              <th style={{ textAlign: 'right', width: 110 }}>Spent so far</th>
              <th style={{ textAlign: 'right', width: 96 }}>Budget used</th>
              <th style={{ textAlign: 'right', width: 110 }}>Client agreed</th>
              <th style={{ textAlign: 'right', width: 96 }}>Invoiced</th>
              <th style={{ textAlign: 'right', width: 110 }}>Still to invoice</th>
              <th style={{ width: 100 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {customer.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                    <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      {p.name}
                    </span>
                    <span style={{ color: 'var(--color-neutral-600)', fontSize: 12 }}> · {p.client}</span>
                  </button>
                </td>
                <td style={{ color: 'var(--color-neutral-700)', fontSize: 12 }}>{p.typeShort}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.budgetLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.actualLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.burnInk }}>{p.burnLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.valueLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.billedLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>{p.toBillLabel}</td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr 108px 100px', alignItems: 'center', gap: 'var(--space-4)' }}>
      <button type="button" className="card-link" onClick={onOpen}>
        <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>
          {project.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
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
