import { useMemo, useState } from 'react';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { addMonths, fromISO, quarterLabel, startOfMonth } from '../lib/dates';
import { Tabs } from '../components/Tabs';
import { Stripe } from '../components/Stripe';

const WINDOW_BEFORE = 6;
const WINDOW_MONTHS = 24;

export function Timeline({ view, onOpenProject }: { view: PortfolioView; onOpenProject: (id: string) => void }) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { windowStart, span, quarters, todayLeft } = useMemo(() => {
    const start = addMonths(startOfMonth(view.today), -WINDOW_BEFORE);
    const end = addMonths(start, WINDOW_MONTHS);
    const total = end.getTime() - start.getTime();
    const marks: { key: string; label: string; left: number }[] = [];
    for (let i = 0; i <= WINDOW_MONTHS; i += 1) {
      const d = addMonths(start, i);
      if (d.getMonth() % 3 !== 0) continue;
      marks.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: quarterLabel(d), left: ((d.getTime() - start.getTime()) / total) * 100 });
    }
    return {
      windowStart: start,
      span: total,
      quarters: marks,
      todayLeft: ((view.today.getTime() - start.getTime()) / total) * 100,
    };
  }, [view.today]);

  const pos = (iso: string) => ((fromISO(iso).getTime() - windowStart.getTime()) / span) * 100;


  const row = (p: ProjectView) => (
    <TimelineRow
      key={p.id}
      project={p}
      left={Math.max(0, Math.min(100, pos(p.startDate)))}
      right={Math.max(0, Math.min(100, pos(p.endDate)))}
      milestoneLeft={Math.max(0, Math.min(100, pos(p.milestoneDate)))}
      quarters={quarters}
      todayLeft={todayLeft}
      team={view.allocationsFor(p.id).map((a) => a.person.name)}
      hovered={hoverId === p.id}
      onHover={setHoverId}
      onOpen={() => onOpenProject(p.id)}
    />
  );

  return (
    <div>
      <div className="legend" style={{ marginBottom: 'var(--space-6)' }}>
        <span>
          <span style={{ width: 26, height: 8, background: 'var(--color-neutral-500)', display: 'block' }} />
          How long the project runs
        </span>
        <span>
          <span style={{ width: 9, height: 9, background: 'var(--color-text)', display: 'block', transform: 'rotate(45deg)' }} />
          Next thing due
        </span>
        <span>
          <span style={{ width: 1, height: 14, background: 'var(--color-text)', display: 'block' }} />
          Today
        </span>
        <span>
          <span style={{ width: 26, height: 8, background: 'var(--color-accent-2)', display: 'block' }} />
          At risk
        </span>
        <span>
          <span style={{ width: 26, height: 8, background: 'var(--color-warning)', display: 'block' }} />
          Watch
        </span>
        <span>Hover a bar for its dates and team</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 'var(--space-4)', alignItems: 'end', marginBottom: 'var(--space-2)' }}>
        <div className="eyebrow">Project</div>
        <div style={{ position: 'relative', height: 22 }}>
          {quarters.map((q) => (
            <span
              key={q.key}
              style={{
                position: 'absolute',
                left: `${q.left}%`,
                bottom: 0,
                transform: 'translateX(-50%)',
                fontSize: 13,
                color: 'var(--color-neutral-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {q.label}
            </span>
          ))}
          <span
            style={{
              position: 'absolute',
              left: `${todayLeft}%`,
              top: -19,
              transform: 'translateX(-50%)',
              fontSize: 11,
              letterSpacing: '.09em',
              textTransform: 'uppercase',
              color: 'var(--color-accent-700)',
            }}
          >
            Today
          </span>
        </div>
      </div>

      <Tabs
        storageKey="timeline"
        tabs={[
          {
            id: 'all',
            label: 'All projects',
            count: view.projects.length,
            render: () => <div style={{ display: 'flex', flexDirection: 'column' }}>{view.projects.map(row)}</div>,
          },
          ...view.projectTypes.map((t) => ({
            id: t.id,
            label: t.label,
            count: view.projects.filter((p) => p.type === t.id).length,
            render: () => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {view.projects.filter((p) => p.type === t.id).map(row)}
              </div>
            ),
          })),
        ]}
      />
    </div>
  );
}

function TimelineRow({
  project,
  left,
  right,
  milestoneLeft,
  quarters,
  todayLeft,
  team,
  hovered,
  onHover,
  onOpen,
}: {
  project: ProjectView;
  left: number;
  right: number;
  milestoneLeft: number;
  quarters: { key: string; left: number }[];
  todayLeft: number;
  team: string[];
  hovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: () => void;
}) {
  const width = Math.max(0.8, right - left);
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 'var(--space-4)', alignItems: 'center', padding: '7px 0' }}
      onMouseEnter={() => onHover(project.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button type="button" className="card-link" onClick={onOpen} style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
        <Stripe project={project} height={15} />
        <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>
          {project.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {project.client}
        </span>
      </button>
      <div style={{ position: 'relative', height: 18, cursor: 'pointer' }}>
        <span style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 1, background: 'var(--color-neutral-200)', display: 'block' }} />
        {quarters.map((q) => (
          <span key={q.key} style={{ position: 'absolute', left: `${q.left}%`, top: -4, bottom: -4, width: 1, background: 'var(--color-neutral-300)', display: 'block' }} />
        ))}
        <span style={{ position: 'absolute', left: `${todayLeft}%`, top: -3, bottom: -3, width: 1, background: 'var(--color-text)', display: 'block' }} />
        <span style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 5, height: 8, background: project.ragColor, display: 'block' }} />
        <span
          style={{ position: 'absolute', left: `${milestoneLeft}%`, top: 4, width: 9, height: 9, background: 'var(--color-text)', transform: 'rotate(45deg)', display: 'block' }}
        />
        {hovered && (
          <div
            style={{
              position: 'absolute',
              left: `${right}%`,
              top: 20,
              transform: right > 60 ? 'translateX(-100%)' : 'translateX(-6px)',
              minWidth: 300,
              maxWidth: 380,
              padding: 'var(--space-3)',
              background: 'var(--color-bg)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-md)',
              zIndex: 4,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18 }}>{project.name}</div>
            <div className="eyebrow" style={{ color: 'var(--color-accent-700)', marginTop: 3 }}>
              {project.durationMonths} months long
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px var(--space-3)', fontSize: 13, marginTop: 10 }}>
              <span style={{ color: 'var(--color-neutral-600)' }}>Started</span>
              <span>{project.startLabel}</span>
              <span style={{ color: 'var(--color-neutral-600)' }}>Next due</span>
              <span>
                {project.milestone} · {project.msDateLabel}
              </span>
              <span style={{ color: 'var(--color-neutral-600)' }}>Finishes</span>
              <span>{project.endLabel}</span>
              <span style={{ color: 'var(--color-neutral-600)' }}>Team</span>
              <span>{team.length ? team.join(', ') : `${project.pmName} (project manager)`}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
