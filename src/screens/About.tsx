import { BrandLockup } from '../components/BrandLockup';

/* Not in the menu, and nothing links to it: you get here by double-clicking the mark, and
   double-clicking it again is the way back. The ground is the sidebar's navy so the mark
   behaves exactly as it does there — the paper reads against it, and the name still takes
   the front pane's teal under the pointer. */
export function About({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="about">
      <BrandLockup onDoubleClick={onLeave} stacked={false} />
      <p className="about-credit">Created By Saranan</p>
      <p className="about-hint">Double-click the mark to go back.</p>
    </div>
  );
}
