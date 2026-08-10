import type { ReactNode } from 'react';
import type { PortfolioView } from '../lib/derive';
import { hoursToDays } from '../lib/derive';
import type { Person } from '../types';
import { PersonBars } from './PersonBars';

/** One person's month-by-month spread: which projects take their time, plus leave. */
export function PersonDetail({
  view,
  person,
  onEdit,
  onOpenProject,
}: {
  view: PortfolioView;
  person: Person;
  onEdit: () => void;
  onOpenProject: (id: string) => void;
}) {
  const row = view.peopleViews.find((p) => p.person.id === person.id);
  const spread = view.spreadFor(person.id);
  if (!row) return <p className="empty">This person is no longer in the portfolio.</p>;

  const cols = `minmax(160px, 1fr) repeat(${view.months.length}, 56px) 64px`;
  const full = person.capacity;
  const ink = (v: number) =>
    v > full ? 'var(--color-accent-2-700)' : v > (full * view.threshold) / 100 ? 'var(--color-accent-700)' : 'var(--color-text)';

  return (
    <div>
      <div className="stat-row" style={{ gap: 'var(--space-6) 56px', marginBottom: 'var(--space-6)' }}>
        <div>
          <div className="stat-value" style={{ fontSize: 34, color: ink(row.peak) }}>{row.peak}%</div>
          <div className="stat-label">Peak commitment</div>
          <div className="stat-sub">{view.monthLabels[row.peakMonthIndex] ?? '—'}, work plus leave</div>
        </div>
        <div>
          <div className="stat-value" style={{ fontSize: 34 }}>{spread.length}</div>
          <div className="stat-label">Projects</div>
          <div className="stat-sub">Booked in the next {view.months.length} months</div>
        </div>
        <div>
          <div className="stat-value" style={{ fontSize: 34 }}>{row.leaveDays.reduce((n, v) => n + v, 0)}</div>
          <div className="stat-label">Days off</div>
          <div className="stat-sub">Own leave plus public holidays</div>
        </div>
        <div>
          <div className="stat-value" style={{ fontSize: 34 }}>{row.person.overheadPct ?? 0}%</div>
          <div className="stat-label">Other</div>
          <div className="stat-sub">
            Meetings and admin · {row.overheadLoad}% of a full month
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <PersonBars person={row} monthLabels={view.monthLabels} threshold={view.threshold} showPct height={120} />
      </div>

      {spread.length === 0 ? (
        <p className="empty">Not booked on any project yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 8px', alignItems: 'center', minWidth: 560 }}>
            <span className="eyebrow">Project</span>
            {view.monthLabels.map((m) => (
              <span key={m} className="eyebrow" style={{ textAlign: 'right' }}>{m}</span>
            ))}
            <span className="eyebrow" style={{ textAlign: 'right' }}>Total days</span>

            {spread.map(({ project, hours, totalHours }) => (
              <Fragmentish key={project.id}>
                <button
                  type="button"
                  className="card-link"
                  onClick={() => onOpenProject(project.id)}
                  style={{ padding: '8px 0', minWidth: 0 }}
                >
                  <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15 }}>
                    {project.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}> · {project.client}</span>
                </button>
                {hours.map((h, i) => (
                  <span
                    key={i}
                    title={h ? `${h} hours booked` : undefined}
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 13,
                      color: h ? 'var(--color-text)' : 'var(--color-neutral-400)',
                    }}
                  >
                    {h ? `${hoursToDays(h).toFixed(1)}d` : '·'}
                  </span>
                ))}
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  {hoursToDays(totalHours).toFixed(1)}d
                </span>
              </Fragmentish>
            ))}

            <span style={{ fontSize: 13, paddingTop: 10, color: 'var(--color-accent-700)' }}>Days off</span>
            {row.leaveDays.map((d, i) => (
              <span
                key={i}
                title={d ? `${d} days ≈ ${row.leaveLoads[i]}% of the month` : undefined}
                style={{
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 13,
                  paddingTop: 10,
                  color: d ? 'var(--color-accent-700)' : 'var(--color-neutral-400)',
                }}
              >
                {d ? `${d}d` : '·'}
              </span>
            ))}
            <span style={{ paddingTop: 10 }} />

            <span style={{ fontSize: 13, fontWeight: 600, paddingTop: 8, borderTop: '1px solid var(--color-divider)' }}>
              Committed
            </span>
            {row.committed.map((v, i) => (
              <span
                key={i}
                style={{
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 13,
                  fontWeight: 600,
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-divider)',
                  color: ink(v),
                }}
              >
                {v}%
              </span>
            ))}
            {/* Carries the peak so the closing rule has content under the Total column
                rather than trailing off into an empty cell. */}
            <span
              style={{
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
                fontWeight: 600,
                paddingTop: 8,
                borderTop: '1px solid var(--color-divider)',
                color: ink(row.peak),
              }}
            >
              {row.peak}%
            </span>
          </div>
        </div>
      )}

      <p className="field-hint" style={{ marginTop: 'var(--space-4)' }}>
        Percentages are of a full-time working month. &ldquo;Committed&rdquo; adds annual leave to project work; a full
        month for {person.name} is {full}%, so anything above that is more than the month holds.
      </p>

      <div className="drawer-actions">
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          Edit person &amp; leave
        </button>
      </div>
    </div>
  );
}

/** Grid children must be siblings, so rows are spread rather than wrapped in a div. */
function Fragmentish({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
