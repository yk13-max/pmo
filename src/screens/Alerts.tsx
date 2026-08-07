import type { PortfolioView } from '../lib/derive';
import { money } from '../lib/derive';
import { Stat } from '../components/Stat';

const BAR_W = 200;
const BAR_H = 60;
const BAR_TOP = 46;
const BASELINE = 58;
const CEILING = 150;

export function Alerts({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const atRisk = view.projects.filter((p) => p.rag === 'R');
  const overbooked = view.peopleViews.filter((p) => p.loads.some((v) => v > 100));
  const nearlySpent = view.projects.filter((p) => p.burn > 95);
  const unbilled = view.projects
    .filter((p) => p.cust && p.value > p.billed)
    .sort((a, b) => b.value - b.billed - (a.value - a.billed))
    .slice(0, 6);

  const slot = (BAR_W - 8) / Math.max(1, view.months.length);
  const barWidth = Math.min(24, slot - 6);
  const capY = BASELINE - (100 / CEILING) * BAR_TOP;

  return (
    <div>
      <div className="stat-row">
        <Stat value={atRisk.length} label="Projects at risk" sub="Flagged by their project manager" color="var(--color-accent-2-700)" />
        <Stat value={overbooked.length} label="People overbooked" sub="Committed past a full week" color="var(--color-accent-2-700)" />
        <Stat value={nearlySpent.length} label="Budgets nearly gone" sub="More than 95% already spent" color="var(--color-accent-700)" />
        <Stat value={money(view.totals.toBill)} label="Waiting to be invoiced" sub="Agreed work not yet billed" />
      </div>

      <SectionHeading dot="var(--color-accent-2)" title="Projects at risk" note="Filled squares are phases finished, the navy square is where the project is now." />
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
              <div style={{ display: 'flex', gap: 4, height: 8, marginTop: 'var(--space-3)' }}>
                {p.pips.map((q, i) => (
                  <span key={i} style={{ display: 'block', flex: 1, background: q.bg }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 6 }}>
                {p.phaseName} · {p.phaseStep}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: p.loadInk }}>{p.loadLabel}</div>
                  <div className="eyebrow">of team time</div>
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

      <SectionHeading dot="var(--color-accent-2)" title="People booked past a full week" note="Red bars are months where more work is promised than there are hours to do it." />
      {overbooked.length === 0 ? (
        <p className="empty" style={{ marginBottom: 'var(--space-8)' }}>Nobody is booked past a full week.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))', gap: 'var(--space-6) 64px', marginBottom: 'var(--space-8)' }}>
          {overbooked.map((p) => {
            const months = p.loads.map((v, i) => (v > 100 ? view.monthLabels[i] : null)).filter(Boolean);
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
                <div style={{ flex: 'none', width: BAR_W }}>
                  <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} style={{ width: BAR_W, height: BAR_H, display: 'block' }} role="img" aria-label={`${p.person.name} monthly load`}>
                    <line x1={0} y1={capY} x2={BAR_W} y2={capY} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={0} y1={BASELINE} x2={BAR_W} y2={BASELINE} stroke="var(--color-neutral-400)" strokeWidth={1} />
                    {p.loads.map((v, i) => {
                      const h = (Math.min(v, CEILING) / CEILING) * BAR_TOP;
                      return (
                        <rect
                          key={i}
                          x={4 + i * slot + (slot - barWidth) / 2}
                          y={BASELINE - h}
                          width={barWidth}
                          height={h}
                          fill={v > 100 ? 'var(--color-accent-2)' : v > view.threshold ? 'var(--color-warning)' : 'var(--color-neutral-400)'}
                        >
                          <title>{`${view.monthLabels[i]}: ${v}%`}</title>
                        </rect>
                      );
                    })}
                  </svg>
                  <div style={{ display: 'flex', paddingLeft: 4, marginTop: 5 }}>
                    {view.monthLabels.map((m) => (
                      <span key={m} style={{ width: slot, textAlign: 'center', fontSize: 12, color: 'var(--color-neutral-700)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
