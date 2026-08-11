import { useCallback, useRef, useState } from 'react';
import { GlassMark } from './GlassMark';

/** 2.3x the mark as first drawn in the sidebar. */
const MARK = 83;

/* The mark on its paper surface — a band across the full width of the side menu rather
   than a tile sitting inside it. Both variants are drawn, stacked, and cross-faded, so
   the mark reads light on paper and switches to the dark version as the paper turns navy
   under the pointer: the light/dark pair the brand file sets out.

   It can also be picked up and moved, but only within its own paper. Nothing is stored:
   where it is left is a property of this visit, not of the portfolio. */
export function BrandMark() {
  const paper = useRef<HTMLDivElement>(null);
  const grip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ x: 0, y: 0 });
  /* Set on pointer-down and read on every move: where the pointer started, where the mark
     was then, and how far it may travel before it would leave the paper. */
  const from = useRef({ x: 0, y: 0, atX: 0, atY: 0, maxX: 0, maxY: 0 });
  const [held, setHeld] = useState(false);

  const down = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!paper.current || !grip.current) return;
      const box = paper.current.getBoundingClientRect();
      const mark = grip.current.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(paper.current).paddingLeft) || 0;
      const padY = parseFloat(getComputedStyle(paper.current).paddingTop) || 0;
      /* The mark starts centred, so it may move half the leftover room in either
         direction. Clamping to this keeps every edge inside the paper. */
      from.current = {
        x: e.clientX,
        y: e.clientY,
        atX: at.x,
        atY: at.y,
        maxX: Math.max(0, (box.width - pad * 2 - mark.width) / 2),
        maxY: Math.max(0, (box.height - padY * 2 - mark.height) / 2),
      };
      grip.current.setPointerCapture(e.pointerId);
      setHeld(true);
    },
    [at],
  );

  const move = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!held) return;
      const f = from.current;
      const clamp = (v: number, limit: number) => Math.min(limit, Math.max(-limit, v));
      setAt({
        x: clamp(f.atX + (e.clientX - f.x), f.maxX),
        y: clamp(f.atY + (e.clientY - f.y), f.maxY),
      });
    },
    [held],
  );

  const up = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    grip.current?.releasePointerCapture(e.pointerId);
    setHeld(false);
  }, []);

  return (
    <div className="brand-paper" ref={paper}>
      <div
        ref={grip}
        className={held ? 'brand-grip is-held' : 'brand-grip'}
        style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => setAt({ x: 0, y: 0 })}
        title="Drag me around. Double-click to put me back."
      >
        <GlassMark size={MARK} variant="light" className="brand-mark-light" />
        <GlassMark size={MARK} variant="dark" className="brand-mark-dark" />
      </div>
    </div>
  );
}
