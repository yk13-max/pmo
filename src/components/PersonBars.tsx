import { useState } from 'react';
import type { PersonView } from '../lib/derive';

/* One shared chart for every place a person's monthly commitment is drawn — the resourcing
   grid, the alerts list and the person card — so the geometry, colours and axis are
   identical wherever it appears.

   Drawn in a 0-100 user space and stretched to the room available. The vertical scale runs
   to that person's own peak (floored at their full month) so the top edge is their peak. */
const VB_W = 100;
const VB_H = 100;
const BASELINE = 92;
const PLOT_TOP = 10;

export const scaleFor = (peak: number, capacity: number) => Math.max(peak, capacity, 100);

export function PersonBars({
  person,
  monthLabels,
  threshold,
  height = 104,
  showPct = false,
  interactive = true,
}: {
  person: PersonView;
  monthLabels: string[];
  threshold: number;
  height?: number;
  /** Pin the monthly figures on rather than showing them only on hover. */
  showPct?: boolean;
  interactive?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const count = Math.max(1, person.loads.length);
  const slot = VB_W / count;
  const width = slot * 0.62;
  const x = (i: number) => i * slot + (slot - width) / 2;

  const full = person.person.capacity;
  const top = scaleFor(person.peak, full);
  const h = (pct: number) => (Math.min(pct, top) / top) * (BASELINE - PLOT_TOP);
  const y = (pct: number) => BASELINE - h(pct);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        role="img"
        aria-label={`How much of ${person.person.name}'s time is promised each month, peaking at ${person.peak}%`}
      >
        {/* Guides sit behind the bars, at a light weight. */}
        <line
          x1={0}
          y1={y((full * threshold) / 100)}
          x2={VB_W}
          y2={y((full * threshold) / 100)}
          stroke="var(--color-warning)"
          strokeWidth={1.3}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={0}
          y1={y(full)}
          x2={VB_W}
          y2={y(full)}
          stroke="var(--color-text)"
          strokeWidth={1.3}
          strokeDasharray="6 3"
          vectorEffect="non-scaling-stroke"
        />
        <line x1={0} y1={BASELINE} x2={VB_W} y2={BASELINE} stroke="var(--color-neutral-400)" strokeWidth={1} vectorEffect="non-scaling-stroke" />

        {/* The month starts with the time already gone — days off at the base, then meetings
            and admin — and project work stacks on whatever is left. */}
        {person.loads.map((_, i) => {
          const total = person.committed[i];
          const hTotal = h(total);
          const hLeave = Math.min(h(person.leaveLoads[i]), hTotal);
          const hGone = Math.min(h(person.leaveLoads[i] + person.overheadLoad), hTotal);
          return (
            <g key={i}>
              {hLeave > 0 && (
                <rect x={x(i)} y={BASELINE - hLeave} width={width} height={hLeave} fill="var(--color-accent)" />
              )}
              {hGone > hLeave && (
                <rect
                  x={x(i)}
                  y={BASELINE - hGone}
                  width={width}
                  height={hGone - hLeave}
                  fill="var(--color-accent-500)"
                />
              )}
              {hTotal > hGone && (
                <rect
                  x={x(i)}
                  y={BASELINE - hTotal}
                  width={width}
                  height={hTotal - hGone}
                  fill={
                    total > full
                      ? 'var(--color-accent-2)'
                      : total > (full * threshold) / 100
                        ? 'var(--color-warning)'
                        : 'var(--color-neutral-400)'
                  }
                />
              )}
            </g>
          );
        })}

        {interactive &&
          person.loads.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={i * slot}
              y={0}
              width={slot}
              height={BASELINE}
              fill="transparent"
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
      </svg>

      {person.loads.map((work, i) => {
        const isHover = hover === i;
        if (!showPct && !isHover) return null;
        const total = person.committed[i];
        /* Sits just inside the top of the bar, so it never collides with the guide lines
           running above it. */
        const insideTop = ((BASELINE - h(total)) / VB_H) * height + 3;
        // White only reads on the red fill; amber and grey need dark ink.
        const onRed = total > full;
        return (
          <span
            key={`pct-${i}`}
            style={{
              position: 'absolute',
              left: `${((i + 0.5) / count) * 100}%`,
              top: isHover ? insideTop - 22 : insideTop,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: isHover ? 13 : 10,
              lineHeight: 1.2,
              background: isHover ? 'var(--color-bg)' : 'transparent',
              boxShadow: isHover ? 'var(--shadow-sm)' : 'none',
              padding: isHover ? '1px 5px' : 0,
              borderRadius: 'var(--radius-md)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              color: isHover ? 'var(--color-text)' : onRed ? '#ffffff' : 'var(--color-neutral-900)',
              zIndex: 2,
            }}
          >
            {total}%
            {isHover && (person.leaveDays[i] || person.overheadLoad)
              ? ` · ${work}% work${person.leaveDays[i] ? ` + ${person.leaveDays[i]}d leave` : ''}${
                  person.overheadLoad ? ` + ${person.overheadLoad}% non-project` : ''
                }`
              : ''}
          </span>
        );
      })}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, marginTop: 5 }}>
        {monthLabels.map((m) => (
          <span key={m} style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-neutral-700)' }}>
            {m}
          </span>
        ))}
      </div>
      <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--color-neutral-600)', marginTop: 2 }}>
        top of chart = {top}%{full !== 100 && ` · full month for them = ${full}%`}
      </div>
    </div>
  );
}
