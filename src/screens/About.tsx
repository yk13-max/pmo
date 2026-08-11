import { BrandLockup } from '../components/BrandLockup';

/* Not in the menu, and nothing links to it: you get here by double-clicking the mark, and
   double-clicking it again is the way back. The ground is the sidebar's navy so the mark
   behaves exactly as it does there — the paper reads against it, and the name still takes
   the front pane's teal under the pointer. */
export function About({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="about">
      {/* The mark and the name are what the page is centred on. The credit hangs off the
          bottom of them rather than sitting in the same column, so its height does not
          push the pair off the middle of the window. */}
      <div className="about-lockup">
        <BrandLockup onDoubleClick={onLeave} />
        {/* Under the pointer the whole line ducks out of the way — see the stylesheet. */}
        <p className="about-credit">By Saranan</p>
      </div>
    </div>
  );
}
