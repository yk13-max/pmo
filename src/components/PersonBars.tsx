import { useEffect, useRef, useState } from 'react';
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
  scrollLeft,
  onScrollLeft,
}: {
  person: PersonView;
  monthLabels: string[];
  threshold: number;
  height?: number;
  /** Pin the monthly figures on rather than showing them only on hover. */
  showPct?: boolean;
  interactive?: boolean;
  /* Charts shown side by side share one scroll position, so two people read as the same
     months. Left out, the strip scrolls on its own. */
  scrollLeft?: number;
  onScrollLeft?: (left: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  /* Which way there is more chart. Drives the edge fade, so a month cut in half by the
     boundary reads as "keep scrolling" rather than as broken text. */
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = strip.current;
    // The tolerance stops the two charts nudging each other back and forth.
    if (el && scrollLeft !== undefined && Math.abs(el.scrollLeft - scrollLeft) > 1) el.scrollLeft = scrollLeft;
  }, [scrollLeft]);

  const measure = () => {
    const el = strip.current;
    if (!el) return;
    const next = {
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    };
    setMore((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  };

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // Re-measured when the number of months changes the content width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.loads.length, monthLabels.length]);

  const count = Math.max(1, person.loads.length);
  const slot = VB_W / count;
  const width = slot * 0.62;
  const x = (i: number) => i * slot + (slot - width) / 2;

  const full = person.person.capacity;
  const top = scaleFor(person.peak, full);
  const h = (pct: number) => (Math.min(pct, top) / top) * (BASELINE - PLOT_TOP);
  const y = (pct: number) => BASELINE - h(pct);

  /* Below this a month is too narrow to read its own label, so a long window makes the
     chart wider than its card and the strip scrolls — the same as the demand chart.
     Windows past a year carry the year in the label, which needs the extra room. */
  const minSlot = monthLabels.some((m) => m.length > 4) ? 56 : 38;
  const minWidth = count * minSlot;

  return (
    <div>
    <div
      ref={strip}
      style={{
        overflowX: 'auto',
        // Fades only on the side that has more to show, so nothing dims needlessly.
        maskImage:
          more.left || more.right
            ? `linear-gradient(to right, ${more.left ? 'transparent' : '#000'} 0, #000 22px, #000 calc(100% - 22px), ${
                more.right ? 'transparent' : '#000'
              } 100%)`
            : undefined,
      }}
      onScroll={(e) => {
        onScrollLeft?.(e.currentTarget.scrollLeft);
        measure();
      }}
    >
    <div style={{ position: 'relative', minWidth }}>
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
            and admin — then the standing work, and project work on whatever is left. The
            workstreams sit under the projects rather than over them so the top of the bar
            keeps saying how full the month is, which is the colour the eye goes to. */}
        {person.loads.map((_, i) => {
          const total = person.committed[i];
          const hTotal = h(total);
          const hLeave = Math.min(h(person.leaveLoads[i]), hTotal);
          const hGone = Math.min(h(person.leaveLoads[i] + person.overheadLoads[i]), hTotal);
          /* Standing work, drawn on top of what is already gone. Bounded by the total so a
             rounding of a per-cent never draws a band past the top of its own bar. */
          const hStream = Math.min(
            h(person.leaveLoads[i] + person.overheadLoads[i] + (person.streamLoads[i] ?? 0)),
            hTotal,
          );
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
                  fill="var(--color-offwork)"
                />
              )}
              {hStream > hGone && (
                <rect
                  x={x(i)}
                  y={BASELINE - hStream}
                  width={width}
                  height={hStream - hGone}
                  fill="var(--color-workstream)"
                />
              )}
              {hTotal > hStream && (
                <rect
                  x={x(i)}
                  y={BASELINE - hTotal}
                  width={width}
                  height={hTotal - hStream}
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

      {/* Only the figure itself rides on the bar. It is short enough to sit over any column
          without spilling; the breakdown goes in the caption below, outside the scroller,
          where nothing can cut it. */}
      {person.loads.map((_, i) => {
        const isHover = hover === i;
        if (!showPct && !isHover) return null;
        const total = person.committed[i];
        // Just inside the top of the bar, clear of the guide lines running above it.
        const insideTop = ((BASELINE - h(total)) / VB_H) * height + 3;
        const onRed = total > full;
        return (
          <span
            key={`pct-${i}`}
            style={{
              position: 'absolute',
              left: `${((i + 0.5) / count) * 100}%`,
              top: insideTop,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: isHover ? 12 : 10,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              color: onRed ? '#ffffff' : 'var(--color-neutral-900)',
              textShadow: isHover ? '0 0 3px var(--color-bg)' : 'none',
              zIndex: 2,
            }}
          >
            {total}%
          </span>
        );
      })}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, marginTop: 5 }}>
        {monthLabels.map((m) => (
          <span key={m} style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
            {m}
          </span>
        ))}
      </div>
    </div>
    </div>
      {/* Both notes sit outside the scroller: they hold still while the months move under
          them, and no column can push them off the edge. The caption keeps its height when
          empty so nothing below it jumps as the pointer crosses the chart. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 'var(--space-3)',
          marginTop: 3,
          minHeight: 18,
          fontSize: 12,
          color: 'var(--color-neutral-600)',
        }}
      >
        <span style={{ color: 'var(--color-text)', fontSize: 12, textWrap: 'pretty' }}>
          {hover !== null ? monthDetail(person, hover, monthLabels[hover]) : ''}
        </span>
        <span className="chart-note" style={{ flex: 'none' }}>
          {/* Both guide lines are drawn against this person's own month, while every figure
              on the card is a share of a full-time one — which for a part-timer is two
              different scales on one chart. So the note says where the lines actually are in
              the units the numbers use: somebody at 81% of a full month is flagged from 65%,
              not from 80%, and a 74% bar standing above the dotted line is the chart being
              right rather than the arithmetic being wrong. */}
          top of chart = {top}%
          {full !== 100 &&
            ` · full month for them = ${full}% · flagged above ${Math.round((full * threshold) / 100)}%`}
        </span>
      </div>
    </div>
  );
}

/** What one month is made of, in words — the caption under the chart. */
function monthDetail(person: PersonView, i: number, label: string): string {
  /* The booked band, said as its two halves where both are there. `loads` is everything
     booked, so the project figure is what is left once the standing work is taken off it. */
  const stream = person.streamLoads?.[i] ?? 0;
  const parts = stream
    ? [`${person.loads[i] - stream}% project work`, `${stream}% workstreams`]
    : [`${person.loads[i]}% project work`];
  if (person.leaveDays[i]) parts.push(`${person.leaveDays[i]}d off`);
  if (person.overheadLoads[i]) parts.push(`${person.overheadLoads[i]}% other work`);
  /* Said plainly when the month has squeezed the other work, rather than leaving the reader
     to work out why the sum is short of their usual figure. */
  const squeezed = person.overheadLoad - person.overheadLoads[i];
  const note = squeezed > 0 ? ` · ${squeezed}% of their other work will not fit` : '';
  return `${label}: ${person.committed[i]}% committed — ${parts.join(' + ')}${note}`;
}
