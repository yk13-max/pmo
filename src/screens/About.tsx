import { BrandLockup } from '../components/BrandLockup';

/* Not in the menu, and nothing links to it: you get here by double-clicking the mark, and
   double-clicking it again is the way back. The ground is the sidebar's navy so the mark
   behaves exactly as it does there — the paper reads against it, and the name still takes
   the front pane's teal under the pointer. */
export function About({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="about">
      {/* Which build this is: the count of commits behind it, in the corner of the page and
          not in the middle of it. It answers a question nobody asks twice, so it is put where
          a page number goes rather than beside the name — and like the credit, it is only
          there while the mark is under the pointer. */}
      <p className="about-mk">Mk {Number.isFinite(__BUILD_MK__) && __BUILD_MK__ > 0 ? __BUILD_MK__ : '—'}</p>
      {/* The mark and the name are what the page is centred on. The credit hangs off the
          bottom of them rather than sitting in the same column, so its height does not
          push the pair off the middle of the window. */}
      <div className="about-lockup">
        <BrandLockup onDoubleClick={onLeave} />
        {/* Under the pointer the whole line swings out from behind the mark — see the
            stylesheet. The count is of the source the app is built from, and it is counted
            at the moment it is built rather than typed here, so it is never out of date. */}
        <p className="about-credit">
          By Saranan · {__SOURCE_LINES__.toLocaleString('en-GB')} lines
        </p>
      </div>
    </div>
  );
}
