import type { ReactNode } from 'react';

export function Stat({
  value,
  label,
  sub,
  color = 'var(--color-text)',
  spark,
}: {
  value: ReactNode;
  label: string;
  sub: string;
  color?: string;
  spark?: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
        <div className="stat-value" style={{ color }}>
          {value}
        </div>
        {spark}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

/** The small bar cluster that sits beside a portfolio metric. */
export function Spark({ cells, gap = 3 }: { cells: { flex: number; height: number; bg: string; title?: string }[]; gap?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: `${gap}px`, width: 78, height: 22, flex: 'none', paddingBottom: 5 }}>
      {cells.map((c, i) => (
        <span
          key={i}
          title={c.title}
          style={{ display: 'block', flex: c.flex, height: c.height, alignSelf: 'flex-end', background: c.bg }}
        />
      ))}
    </div>
  );
}
