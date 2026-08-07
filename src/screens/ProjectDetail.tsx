import type { Project } from '../types';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { money } from '../lib/derive';
import { Tabs } from '../components/Tabs';
import { PRIORITY_LABEL } from '../types';

const INVOICE_STAGES: [label: string, share: number][] = [
  ['On kick-off', 0.3],
  ['At design freeze', 0.3],
  ['At validation', 0.25],
  ['On handover', 0.15],
];

export function ProjectDetail({
  view,
  project,
  onSelect,
  onEdit,
}: {
  view: PortfolioView;
  project: ProjectView | null;
  onSelect: (id: string) => void;
  onEdit: (project: Project) => void;
}) {
  if (!project) {
    return <p className="empty">No projects yet. Use “New project” to add the first one.</p>;
  }

  const cdmo = view.projects.filter((p) => p.type === 'CDMO');
  const cs = view.projects.filter((p) => p.type === 'CS');
  const team = view.allocationsFor(project.id);

  let running = 0;
  const invoices = INVOICE_STAGES.map(([label, share]) => {
    const amount = Math.round(project.value * share);
    running += amount;
    const invoiced = running <= project.billed + 1;
    return {
      label,
      amount: money(amount),
      status: invoiced ? 'Invoiced' : 'Not yet due',
      ink: invoiced ? 'var(--color-text)' : 'var(--color-neutral-600)',
      dot: invoiced ? 'var(--color-accent)' : 'var(--color-neutral-300)',
    };
  });

  const notes: string[] = [];
  if (project.rag === 'R') notes.push('The project manager has flagged this at risk. It needs a decision this week.');
  if (project.burn > 95) notes.push(`Nearly all of the budget is spent — ${project.burnLabel} of it. More work means a new approval.`);
  if (project.load > view.threshold) notes.push(`The people on this project are booked at ${project.loadLabel} of their time. Something has to give.`);
  if (!team.length) notes.push('Nobody is booked on this project yet. Add allocations so it shows up in resourcing.');
  if (!notes.length) notes.push('Nothing outstanding. On plan, inside budget, and fully staffed.');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="eyebrow">Project</span>
          <select className="input" style={{ width: 'auto', minWidth: 320 }} value={project.id} onChange={(e) => onSelect(e.target.value)}>
            <optgroup label="CDMO">
              {cdmo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.facingLabel.toLowerCase()} · {p.client}
                </option>
              ))}
            </optgroup>
            <optgroup label="Client Solutions">
              {cs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.facingLabel.toLowerCase()} · {p.client}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(project)}>
          Edit project
        </button>
      </div>

      <div style={{ position: 'relative', paddingLeft: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: project.stripe, display: 'block' }} />
        <div className="kicker">{project.client}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 44, lineHeight: 1.05, letterSpacing: '-.025em', marginTop: 6 }}>
          {project.name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', fontSize: 14, color: 'var(--color-neutral-700)', marginTop: 'var(--space-3)' }}>
          <span>{project.typeLabel}</span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 3,
              background: project.priority <= 2 ? 'var(--color-accent-2-100)' : 'var(--color-neutral-200)',
              color: project.priority <= 2 ? 'var(--color-accent-2-800)' : 'var(--color-neutral-800)',
            }}
          >
            P{project.priority} {PRIORITY_LABEL[project.priority]}
          </span>
          <span>{project.facingLabel}</span>
          <span>Run by {project.pmName}</span>
          <span>
            {project.startLabel} → {project.endLabel}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.ragColor, display: 'block' }} />
            {project.ragLabel}
          </span>
        </div>
      </div>

      <Tabs
        storageKey="detail"
        tabs={[
          { id: 'progress', label: 'Progress & money', render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Where it has got to</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Currently in {project.phaseName} — phase {project.phaseStep}. Next due: {project.milestone} on {project.msDateLabel}.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch', marginBottom: 'var(--space-8)' }}>
        {project.phases.map((name, i) => (
          <div key={name} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                height: 6,
                display: 'block',
                background: i < project.phase ? 'var(--color-text)' : i === project.phase ? 'var(--color-accent)' : 'var(--color-neutral-300)',
              }}
            />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, lineHeight: 1.2, textWrap: 'pretty' }}>{name}</span>
            <span
              style={{
                fontSize: 11,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                color: i === project.phase ? 'var(--color-accent-700)' : 'var(--color-neutral-600)',
              }}
            >
              {i < project.phase ? 'Done' : i === project.phase ? 'In progress' : 'To come'}
            </span>
          </div>
        ))}
      </div>

      <div className="stat-row">
        <div>
          <div className="stat-value">{project.cust ? project.billedLabel : project.actualLabel}</div>
          <div className="stat-label">{project.cust ? 'Invoiced so far' : 'Drawn from the pool'}</div>
          <div className="stat-sub">
            {project.cust ? `of ${project.valueLabel} agreed with the client` : `of ${project.budgetLabel} approved`}
          </div>
        </div>
        <div>
          <div className="stat-value">{project.actualLabel}</div>
          <div className="stat-label">Spent so far</div>
          <div className="stat-sub">
            {project.burnLabel} of the {project.budgetLabel} budget · {project.remainLabel} left
          </div>
        </div>
        <div>
          <div className="stat-value" style={{ color: project.loadInk }}>
            {project.loadLabel}
          </div>
          <div className="stat-label">Of the team&rsquo;s time</div>
          <div className="stat-sub">Across the {team.length || 'no'} people below</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 6 }}>
          <span>Budget spent</span>
          <span>
            {project.actualLabel} of {project.budgetLabel}
          </span>
        </div>
        <div style={{ height: 14, background: 'var(--color-neutral-200)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, project.burn)}%`, background: 'var(--color-text)' }} />
        </div>
      </div>

      </>) },
          ...(project.cust
            ? [{ id: 'invoicing', label: 'When the client pays', count: project.toBillLabel, render: () => (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h3 style={{ margin: '0 0 4px' }}>When the client pays</h3>
          <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
            The agreed {project.valueLabel} is invoiced in four stages. {project.billedLabel} has gone out; {project.toBillLabel} is
            still to come.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 640 }}>
            {invoices.map((iv) => (
              <div key={iv.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: iv.dot, display: 'block', flex: 'none' }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: iv.ink }}>{iv.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 15, fontVariantNumeric: 'tabular-nums', color: iv.ink }}>{iv.amount}</span>
                <span style={{ width: 110, textAlign: 'right', fontSize: 12, color: 'var(--color-neutral-600)' }}>{iv.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) }]
            : []),
          { id: 'team', label: 'Who is working on it', count: team.length, render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Who is working on it</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Share of each person&rsquo;s working week committed to this project, month by month.
      </p>
      {team.length === 0 ? (
        <p className="empty" style={{ maxWidth: 640, marginBottom: 'var(--space-8)' }}>
          Nobody booked yet. Open “Edit project” to book people onto it.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 700, marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${view.months.length}, 1fr) 70px`, gap: 'var(--space-2)', alignItems: 'end' }}>
            <span />
            {view.monthLabels.map((m) => (
              <span key={m} style={{ fontSize: 11, color: 'var(--color-neutral-600)', textAlign: 'center' }}>
                {m}
              </span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--color-neutral-600)', textAlign: 'right' }}>Peak</span>
          </div>
          {team.map((row) => {
            const peak = Math.max(...row.loads);
            return (
              <div
                key={row.person.id}
                style={{ display: 'grid', gridTemplateColumns: `180px repeat(${view.months.length}, 1fr) 70px`, gap: 'var(--space-2)', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>{row.person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>{row.person.role}</div>
                </div>
                {row.loads.map((v, i) => (
                  <div key={i} title={`${v}% in ${view.monthLabels[i]}`} style={{ height: 12, background: 'var(--color-neutral-200)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, v)}%`, background: 'var(--color-text)' }} />
                  </div>
                ))}
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', textAlign: 'right' }}>{peak}%</div>
              </div>
            );
          })}
        </div>
      )}

      </>) },
          { id: 'watch', label: 'What to watch', count: notes.length, render: () => (<>
      <h3 style={{ margin: '0 0 var(--space-3)' }}>What to watch</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '64ch' }}>
        {notes.map((n) => (
          <p key={n} style={{ margin: 0, fontSize: 16, textWrap: 'pretty' }}>
            {n}
          </p>
        ))}
      </div>
      </>) },
        ]}
      />
    </div>
  );
}
