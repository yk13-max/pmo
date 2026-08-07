import { useState, type ReactNode } from 'react';

export function Stat({
  value,
  label,
  sub,
  color = 'var(--color-text)',
  spark,
  onClick,
  hover,
}: {
  value: ReactNode;
  label: string;
  sub: string;
  color?: string;
  spark?: ReactNode;
  /** Makes the whole tile a button. */
  onClick?: () => void;
  /** Panel shown while the pointer is over the tile. */
  hover?: ReactNode;
}) {
  const [showing, setShowing] = useState(false);
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
        <div className="stat-value" style={{ color }}>
          {value}
        </div>
        {spark}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </>
  );

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => hover && setShowing(true)}
      onMouseLeave={() => hover && setShowing(false)}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="stat-button"
          style={{ background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
        >
          {body}
          <span className="stat-more">See the detail →</span>
        </button>
      ) : (
        body
      )}
      {hover && showing && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 6,
            minWidth: 260,
            maxWidth: 380,
            padding: 'var(--space-3)',
            background: 'var(--color-bg)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-md)',
            zIndex: 8,
            pointerEvents: 'none',
          }}
        >
          {hover}
        </div>
      )}
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
