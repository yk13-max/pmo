import { useCallback, useEffect, useState } from 'react';

/* Column widths for an ordinary table, dragged from the heading and remembered.

   The plan's grid has had this for a while, but that grid is a row of flex boxes and this is
   a `<table>`, so the mechanics differ: a table lays itself out from its content unless it is
   told not to, and a width set on a heading is a suggestion rather than an instruction. The
   table this is used on therefore sets `table-layout: fixed`, which makes the header row the
   thing that decides the widths — which is exactly what a reader dragging a heading expects.

   What it is for: an invoice list is read differently by different people. Somebody chasing
   payment wants the sales order number wide and does not care what the invoice waits on;
   somebody checking the plan wants the opposite. Neither should have to put up with the
   other's table. */

export interface ColumnSpec<K extends string> {
  key: K;
  label: string;
  /** What it opens at. */
  width: number;
  /** Narrow enough to still show what the column holds, and no narrower. */
  min: number;
  align?: 'left' | 'right';
  /** The heading's tooltip, where the label alone does not say enough. */
  title?: string;
}

const MAX = 480;

export type Widths<K extends string> = Record<K, number>;

function defaults<K extends string>(spec: ColumnSpec<K>[]): Widths<K> {
  return Object.fromEntries(spec.map((c) => [c.key, c.width])) as Widths<K>;
}

/**
 * Widths for one table, kept under `storageKey` so they survive a reload.
 *
 * A stored width for a column that no longer exists is ignored, and a column added since is
 * taken at its default — so changing the table's shape never leaves a reader with a layout
 * they cannot make sense of.
 */
export function useTableWidths<K extends string>(storageKey: string, spec: ColumnSpec<K>[]) {
  const [widths, setWidths] = useState<Widths<K>>(() => {
    const out = defaults(spec);
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (raw && typeof raw === 'object') {
        spec.forEach((c) => {
          const v = Number((raw as Record<string, unknown>)[c.key]);
          if (Number.isFinite(v)) out[c.key] = Math.max(c.min, Math.min(MAX, Math.round(v)));
        });
      }
    } catch {
      /* Private browsing, or something else wrote nonsense there. Defaults it is. */
    }
    return out;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      /* The drag still works; the widths just do not stick. */
    }
  }, [storageKey, widths]);

  const resize = useCallback(
    (key: K, to: number) => {
      const col = spec.find((c) => c.key === key);
      if (!col) return;
      setWidths((w) => ({ ...w, [key]: Math.max(col.min, Math.min(MAX, Math.round(to))) }));
    },
    [spec],
  );

  const reset = useCallback(() => setWidths(defaults(spec)), [spec]);
  const isDefault = spec.every((c) => widths[c.key] === c.width);

  return { widths, resize, reset, isDefault };
}

/**
 * One heading, draggable by its right-hand edge.
 *
 * The pointer is captured on the way down, so the drag survives the pointer leaving the
 * narrow handle — which it does immediately, the column being what moves. Double-click puts
 * the column back where it started, and the arrow keys nudge it for anyone not using a mouse.
 */
export function ResizableHead<K extends string>({
  col,
  width,
  onResize,
}: {
  col: ColumnSpec<K>;
  width: number;
  onResize: (key: K, to: number) => void;
}) {
  const down = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const from = e.clientX;
    const was = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onResize(col.key, was + (ev.clientX - from));
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
    <th
      className="col-head"
      style={{ width, textAlign: col.align ?? 'left', position: 'relative' }}
      title={col.title}
    >
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {col.label}
      </span>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Width of the ${col.label} column`}
        tabIndex={0}
        className="plan-col-grip no-print"
        onPointerDown={down}
        onDoubleClick={() => onResize(col.key, col.width)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onResize(col.key, width - (e.shiftKey ? 24 : 8));
          else if (e.key === 'ArrowRight') onResize(col.key, width + (e.shiftKey ? 24 : 8));
          else return;
          e.preventDefault();
        }}
      />
    </th>
  );
}
