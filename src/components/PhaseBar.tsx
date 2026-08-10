import type { ProjectView } from '../lib/derive';

/* The phase stepper, one pip per phase. Each is a track that fills left to right: solid
   for a phase already done, empty for one still ahead, and part-filled for the phase in
   hand — the share of it reported as complete. Shared by the portfolio cards, the alerts
   list and the project detail so a project reads the same wherever it appears. */
export function PhaseBar({
  project,
  height = 6,
  gap = 4,
}: {
  project: ProjectView;
  height?: number;
  gap?: number;
}) {
  return (
    <div
      style={{ display: 'flex', gap, height }}
      title={`${project.phaseName} — phase ${project.phaseStep}, ${project.pct}% through it`}
    >
      {project.pips.map((q, i) => (
        <span key={i} style={{ position: 'relative', display: 'block', flex: 1, background: 'var(--color-neutral-300)' }}>
          {q.fill > 0 && (
            <span
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${q.fill}%`, background: q.bg, display: 'block' }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
