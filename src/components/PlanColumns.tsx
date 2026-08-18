import { useCallback, useEffect, useState } from 'react';

/* How wide each column of the plan's task list is.

   A plan is read differently by different people. Somebody checking dates wants Start and
   Finish wide and does not care what the rule column says; somebody untangling the links
   wants After and Float; somebody with long task names wants everything else out of the way.
   So the widths are the reader's, dragged from the heading and remembered.

   The task name used to be the one column with no width of its own, taking whatever the
   others left. It is dragged like the rest now: a name is the thing most often too long for
   its column, and being the only heading that could not be widened made it the one that
   needed it most. The list's whole width is added up from the columns either way, so the
   chart beside it still starts where the list ends. */

export type ColKey =
  | 'task'
  | 'who' | 'days' | 'pct' | 'rule' | 'start' | 'finish' | 'after' | 'float' | 'baseFinish' | 'actStart' | 'actFinish';

export const DEFAULT_WIDTHS: Record<ColKey, number> = {
  task: 200,
  who: 96,
  days: 48,
  pct: 52,
  rule: 74,
  start: 116,
  finish: 70,
  after: 60,
  float: 40,
  baseFinish: 96,
  actStart: 116,
  actFinish: 116,
};

/** Narrow enough to still show what the column holds, and no narrower. */
const MIN: Record<ColKey, number> = {
  task: 90,
  who: 56,
  days: 38,
  pct: 40,
  rule: 52,
  start: 74,
  finish: 50,
  after: 44,
  float: 34,
  baseFinish: 66,
  actStart: 74,
  actFinish: 74,
};

/* Wide enough for a task name that says what the task is, which is the column most likely
   to want the room. */
const MAX = 480;
const KEY = 'pmo-tracker:plan-columns';

export type Widths = Record<ColKey, number>;

function read(): Widths {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_WIDTHS };
    const out = { ...DEFAULT_WIDTHS };
    (Object.keys(DEFAULT_WIDTHS) as ColKey[]).forEach((k) => {
      const v = Number(raw[k]);
      if (Number.isFinite(v)) out[k] = Math.max(MIN[k], Math.min(MAX, Math.round(v)));
    });
    return out;
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

export function usePlanColumns() {
  const [widths, setWidths] = useState<Widths>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(widths));
    } catch {
      /* Private browsing. The drag still works; the widths just do not stick. */
    }
  }, [widths]);

  const resize = useCallback((key: ColKey, to: number) => {
    setWidths((w) => ({ ...w, [key]: Math.max(MIN[key], Math.min(MAX, Math.round(to))) }));
  }, []);

  const reset = useCallback(() => setWidths({ ...DEFAULT_WIDTHS }), []);
  const isDefault = (Object.keys(DEFAULT_WIDTHS) as ColKey[]).every((k) => widths[k] === DEFAULT_WIDTHS[k]);

  return { widths, resize, reset, isDefault };
}

/**
 * A heading that can be dragged wider or narrower by its right-hand edge.
 *
 * The pointer is captured on the way down, so the drag survives the pointer leaving the
 * 9px handle — which it does immediately, the column being what moves.
 */
export function ColHead({
  col,
  width,
  label,
  align = 'left',
  title,
  onResize,
}: {
  col: ColKey;
  width: number;
  label: string;
  align?: 'left' | 'right';
  title?: string;
  onResize: (key: ColKey, to: number) => void;
}) {
  const down = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const from = e.clientX;
    const was = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onResize(col, was + (ev.clientX - from));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <span
      className="plan-col-head"
      style={{ width, flex: 'none', position: 'relative', textAlign: align, minWidth: 0 }}
      title={title}
    >
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {/* Sits in the gap between this column and the next, so grabbing it never means
          missing the control underneath. Keyboard users get the arrow keys. */}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Width of the ${label} column`}
        tabIndex={0}
        className="plan-col-grip no-print"
        onPointerDown={down}
        onDoubleClick={() => onResize(col, DEFAULT_WIDTHS[col])}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onResize(col, width - (e.shiftKey ? 24 : 8));
          else if (e.key === 'ArrowRight') onResize(col, width + (e.shiftKey ? 24 : 8));
          else return;
          e.preventDefault();
        }}
      />
    </span>
  );
}
