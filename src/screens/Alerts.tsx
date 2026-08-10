import type { PortfolioView } from '../lib/derive';
import { money } from '../lib/derive';
import { Stat } from '../components/Stat';
import { Tabs } from '../components/Tabs';
import { PersonBars } from '../components/PersonBars';
import { PhaseBar } from '../components/PhaseBar';


export function Alerts({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const atRisk = view.projects.filter((p) => p.rag === 'R');
  const overbooked = view.peopleViews.filter((p) => p.committed.some((v) => v > p.person.capacity));
  const nearlySpent = view.projects.filter((p) => p.burn > 95);
  const unbilled = view.projects
    .filter((p) => p.cust && p.value > p.billed)
    .sort((a, b) => b.value - b.billed - (a.value - a.billed))
    .slice(0, 6);


  return (
    <div>
      <div className="stat-row">
        <Stat value={atRisk.length} label="Projects at risk" sub="Flagged by their project manager" color="var(--color-accent-2-700)" />
        <Stat value={overbooked.length} label="People overbooked" sub="Committed past a full week" color="var(--color-accent-2-700)" />
        <Stat value={nearlySpent.length} label="Budgets nearly gone" sub="More than 95% already spent" color="var(--color-accent-700)" />
        <Stat value={money(view.totals.toBill)} label="Waiting to be invoiced" sub="Agreed work not yet billed" />
      </div>

      <Tabs
        storageKey="alerts"
        tabs={[
          { id: 'risk', label: 'Projects at risk', count: atRisk.length, render: () => (<>
      <SectionHeading dot="var(--color-accent-2)" title="Projects at risk" note="One bar per phase: solid where a phase is finished, part-filled for the phase in hand." />
      {atRisk.length === 0 ? (
        <p className="empty" style={{ marginBottom: 'var(--space-8)' }}>Nothing flagged at risk.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 'var(--space-6) 64px', marginBottom: 'var(--space-8)' }}>
          {atRisk.map((p) => (
            <div key={p.id} style={{ position: 'relative', paddingLeft: 'var(--space-4)' }}>
              <span style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: 3, background: 'var(--color-accent-2)', display: 'block' }} />
              <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.15 }}>
                  {p.name}
                </div>
              </button>
              <div className="eyebrow" style={{ color: 'var(--color-accent-700)', marginTop: 3 }}>{p.client}</div>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <PhaseBar project={p} height={8} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 6 }}>
                {p.phaseName} · {p.phaseStep}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: p.loadInk }}>{p.loadDaysLabel}</div>
                  <div className="eyebrow">team draw this month</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20 }}>{p.burnLabel}</div>
                  <div className="eyebrow">budget used</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 'var(--space-3)' }}>
                Next: {p.milestone} · {p.msDateLabel} · {p.pmName}
              </div>
            </div>
          ))}
        </div>
      )}

      </>) },
          { id: 'people', label: 'People overbooked', count: overbooked.length, render: () => (<>
      <SectionHeading
        dot="var(--color-accent-2)"
        title="People booked past a full week"
        note={`Red bars are months where work plus days off exceeds the hours available. Days off sit in dark blue at the base of each bar. The dashed line is a full week, the dotted line the ${view.threshold}% threshold.`}
      />
      {overbooked.length === 0 ? (
        <p className="empty" style={{ marginBottom: 'var(--space-8)' }}>Nobody is booked past a full week.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))', gap: 'var(--space-6) 64px', marginBottom: 'var(--space-8)' }}>
          {overbooked.map((p) => {
            const months = p.committed.map((v, i) => (v > p.person.capacity ? view.monthLabels[i] : null)).filter(Boolean);
            return (
              <div key={p.person.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-6)', position: 'relative', paddingLeft: 'var(--space-4)' }}>
                <span style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: 3, background: 'var(--color-accent-2)', display: 'block' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.15 }}>{p.person.name}</div>
                  <div className="eyebrow" style={{ color: 'var(--color-accent-700)', marginTop: 3 }}>{p.person.role}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--color-accent-2-700)', marginTop: 'var(--space-3)' }}>
                    {p.peak}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Past a full week in {months.join(', ')}</div>
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 220 }}>
                  <PersonBars person={p} monthLabels={view.monthLabels} threshold={view.threshold} showPct />
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>) },
          { id: 'budgets', label: 'Budgets nearly gone', count: nearlySpent.length, render: () => (<>
      <SectionHeading dot="var(--color-accent)" title="Budgets nearly gone" note="The bar is the approved budget; the dark part has been spent." />
      {nearlySpent.length === 0 ? (
        <p className="empty" style={{ marginBottom: 'var(--space-8)' }}>No budget is above 95% spent.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 1040, marginBottom: 'var(--space-8)' }}>
          {nearlySpent.map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '250px 1fr 150px 110px', alignItems: 'center', gap: 'var(--space-4)' }}>
              <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                  {p.client} · {p.phaseName}
                </div>
              </button>
              <div style={{ height: 14, background: 'var(--color-neutral-200)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, p.burn)}%`, background: 'var(--color-accent-2)' }} />
              </div>
              <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                {p.actualLabel} <span style={{ color: 'var(--color-neutral-600)' }}>/ {p.budgetLabel}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 14, color: 'var(--color-neutral-700)' }}>
                {p.budget - p.actual > 0 ? `${money(p.budget - p.actual)} left` : 'nothing left'}
              </div>
            </div>
          ))}
        </div>
      )}

      </>) },
          { id: 'invoice', label: 'Waiting to be invoiced', count: unbilled.length, render: () => (<>
      <SectionHeading dot="var(--color-accent)" title="Money waiting to be invoiced" note="The bar is what the client agreed; the dark part has been invoiced. The pale remainder is money still to ask for." />
      {unbilled.length === 0 ? (
        <p className="empty">Everything agreed has been invoiced.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 1040 }}>
          {unbilled.map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '250px 1fr 150px 130px', alignItems: 'center', gap: 'var(--space-4)' }}>
              <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                <div className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                  {p.client} · {Math.round((p.billed / p.value) * 100)}% invoiced
                </div>
              </button>
              <div style={{ height: 14, background: 'var(--color-neutral-300)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(p.billed / p.value) * 100}%`, background: 'var(--color-text)' }} />
              </div>
              <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                {p.billedLabel} <span style={{ color: 'var(--color-neutral-600)' }}>/ {p.valueLabel}</span>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>{p.toBillLabel}</div>
            </div>
          ))}
        </div>
      )}
      </>) },
        ]}
      />
    </div>
  );
}

function SectionHeading({ dot, title, note }: { dot: string; title: string; note: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'block', flex: 'none' }} />
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      <p className="lede" style={{ margin: '4px 0 var(--space-6) 22px' }}>
        {note}
      </p>
    </>
  );
}
