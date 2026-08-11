import { useCallback, useRef, useState } from 'react';
import { GlassMark } from './GlassMark';

/** 2.3x the mark as first drawn in the sidebar, 80% larger again, 30% smaller, then 10% up. */
const MARK = 114;

/* The mark on its square of paper. Both variants are drawn, stacked, and cross-faded, so
   the mark reads light on paper and switches to the dark version as the paper turns navy
   under the pointer: the light/dark pair the brand file sets out.

   It can be picked up and moved, but only within its own paper, and it eases back to the
   middle the moment it is let go — the mark has one place it belongs, so being dragged is
   something you do to it rather than a setting it keeps. */
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
    /* Letting go returns it to the middle. The transition that carries it back is only
       on the stylesheet's resting rule, so the drag itself still tracks the pointer
       exactly rather than lagging behind it. */
    setAt({ x: 0, y: 0 });
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
        title="Drag me around the paper."
      >
        <GlassMark size={MARK} variant="light" className="brand-mark-light" />
        <GlassMark size={MARK} variant="dark" className="brand-mark-dark" />
      </div>
    </div>
  );
}
