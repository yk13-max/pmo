import { useEffect, useRef, useState } from 'react';
import type { PortfolioView, SkillView } from '../lib/derive';

/* How much of each skill the work is using, month by month.

   The person-by-person charts answer "is this person full". These answer the question a
   resourcing lead asks next, which is "can we take this on": aseptic process design is 1.4
   people booked against the 1.6 people who hold it and are free to do it. So the bar is
   demand and the dashed line is what the team has to give — the same grammar as a person's
   own chart, where the bar is their month and the line is their full month.

   Everything is in people. A percentage of a group that changes size as somebody joins it
   would mean something different every month, and the sentence a lead needs to say out loud
   is "we are half a person short of validation in March". */

const VB_W = 100;
const VB_H = 100;
const BASELINE = 92;
const PLOT_TOP = 10;

export function SkillGraphs({
  view,
  showPct,
  scrollLeft,
  onScrollLeft,
}: {
  view: PortfolioView;
  /** Pin the monthly figures on rather than showing them only on hover. */
  showPct: boolean;
  scrollLeft?: number;
  onScrollLeft?: (left: number) => void;
}) {
  if (view.skillViews.length === 0) {
    return (
      <p className="empty">
        No skills have been listed yet. Add them under Data → Skills, assign them to the team, and say which ones each
        project needs.
      </p>
    );
  }

  return (
    <>
      <h3 style={{ margin: '0 0 4px' }}>Skill by skill</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        What the work is drawing on each skill, against what the people who hold it have to give once their leave and
        non-project time is out. The dashed line is that available capacity; a bar above it is a month where the skill
        is oversubscribed whoever is asked.
      </p>
      <div
        className="person-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(408px,1fr))', gap: 'var(--space-8) 64px' }}
      >
        {view.skillViews.map((sv) => (
          <SkillCard
            key={sv.skill.id}
            skill={sv}
            monthLabels={view.monthLabels}
            showPct={showPct}
            scrollLeft={scrollLeft}
            onScrollLeft={onScrollLeft}
          />
        ))}
      </div>
    </>
  );
}

function SkillCard({
  skill,
  monthLabels,
  showPct,
  scrollLeft,
  onScrollLeft,
}: {
  skill: SkillView;
  monthLabels: string[];
  showPct: boolean;
  scrollLeft?: number;
  onScrollLeft?: (left: number) => void;
}) {
  const peak = Math.max(0, ...skill.booked);
  const peakAt = skill.booked.indexOf(peak);
  const held = skill.holders.map((h) => h.person.name).join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.15 }}>
          {skill.skill.label}
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--color-accent-700)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4 }}
        >
          {skill.headcount ? `${held} · ${skill.headcount} ${skill.headcount === 1 ? 'person' : 'people'}` : 'Nobody holds it'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 8 }}>
          {skill.wantedBy.length
            ? `Wanted by ${skill.wantedBy.map((p) => p.name).join(', ')}`
            : 'No project has asked for it yet'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 26,
            marginTop: 10,
            color: peak > (skill.available[peakAt] ?? 0) ? 'var(--color-accent-2-700)' : 'var(--color-text)',
          }}
        >
          {peak.toFixed(2)}
          <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--color-neutral-700)' }}>
            {' '}
            of {(skill.available[peakAt] ?? 0).toFixed(2)} people
          </span>
        </div>
        <div className="eyebrow">
          busiest month · {monthLabels[peakAt] ?? '—'}
          {/* Where the answer to "who could pick this up" is known, it is said here rather
              than left to be worked out from the bars. */}
          {skill.freeAt
            ? ` · ${skill.freeAt.person} has room in ${monthLabels[skill.freeAt.month]}`
            : skill.headcount
              ? ' · nobody holding it has room in this window'
              : ''}
        </div>
      </div>
      <SkillBars skill={skill} monthLabels={monthLabels} showPct={showPct} scrollLeft={scrollLeft} onScrollLeft={onScrollLeft} />
    </div>
  );
}

export function SkillBars({
  skill,
  monthLabels,
  height = 104,
  showPct = false,
  scrollLeft,
  onScrollLeft,
}: {
  skill: SkillView;
  monthLabels: string[];
  height?: number;
  showPct?: boolean;
  scrollLeft?: number;
  onScrollLeft?: (left: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = strip.current;
    if (el && scrollLeft !== undefined && Math.abs(el.scrollLeft - scrollLeft) > 1) el.scrollLeft = scrollLeft;
  }, [scrollLeft]);

  const measure = () => {
    const el = strip.current;
    if (!el) return;
    const next = { left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
    setMore((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  };

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.booked.length, monthLabels.length]);

  const count = Math.max(1, skill.booked.length);
  const slot = VB_W / count;
  const width = slot * 0.62;
  const x = (i: number) => i * slot + (slot - width) / 2;

  /* The chart reaches the taller of the two things it draws, and never squashes a whole
     person into nothing: a skill one person holds still reads against a scale of one. */
  const top = Math.max(1, ...skill.booked, ...skill.available);
  const h = (people: number) => (Math.max(0, Math.min(people, top)) / top) * (BASELINE - PLOT_TOP);
  const y = (people: number) => BASELINE - h(people);

  const minSlot = monthLabels.some((m) => m.length > 4) ? 56 : 38;

  return (
    <div>
      <div
        ref={strip}
        style={{
          overflowX: 'auto',
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
        <div style={{ position: 'relative', minWidth: count * minSlot }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height, display: 'block' }}
            role="img"
            aria-label={`How much ${skill.skill.label} the work draws each month, peaking at ${Math.max(0, ...skill.booked).toFixed(
              2,
            )} people`}
          >
            {/* Available capacity is a line per month rather than one across the chart: it
                moves with leave, so drawing it flat would put the bar over a line that was
                never there. */}
            {skill.available.map((a, i) => (
              <line
                key={`cap-${i}`}
                x1={i * slot}
                y1={y(a)}
                x2={(i + 1) * slot}
                y2={y(a)}
                stroke="var(--color-text)"
                strokeWidth={1.3}
                strokeDasharray="6 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1={0}
              y1={BASELINE}
              x2={VB_W}
              y2={BASELINE}
              stroke="var(--color-neutral-400)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {skill.booked.map((b, i) => {
              const over = b > skill.available[i];
              return (
                <rect
                  key={i}
                  x={x(i)}
                  y={y(b)}
                  width={width}
                  height={h(b)}
                  fill={over ? 'var(--color-accent-2)' : 'var(--color-neutral-400)'}
                />
              );
            })}
            {skill.booked.map((_, i) => (
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

          {skill.booked.map((b, i) => {
            const isHover = hover === i;
            if (!showPct && !isHover) return null;
            const insideTop = (y(b) / VB_H) * height + 3;
            const over = b > skill.available[i];
            return (
              <span
                key={`n-${i}`}
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
                  color: over ? '#ffffff' : 'var(--color-neutral-900)',
                  textShadow: isHover ? '0 0 3px var(--color-bg)' : 'none',
                  zIndex: 2,
                }}
              >
                {b.toFixed(1)}
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
          {hover !== null
            ? `${monthLabels[hover]}: ${skill.booked[hover].toFixed(2)} people booked of ${skill.available[hover].toFixed(
                2,
              )} available — ${
                skill.spare[hover] < 0
                  ? `${(-skill.spare[hover]).toFixed(2)} short`
                  : `${skill.spare[hover].toFixed(2)} spare`
              }`
            : ''}
        </span>
        <span className="chart-note" style={{ flex: 'none' }}>
          top of chart = {top.toFixed(1)} people
        </span>
      </div>
    </div>
  );
}
