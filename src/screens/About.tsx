import { BrandLockup } from '../components/BrandLockup';

/* Mk XCVII rather than Mk 97. The number is the count of commits behind the build, which is
   a number that only ever goes up and is never done arithmetic on — so it may as well be
   numbered the way a mark of something is. Nought has no numeral, and a checkout with no
   history to count says so in words rather than showing an empty space. */
const NUMERALS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function roman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return '—';
  let left = Math.floor(n);
  return NUMERALS.reduce((out, [value, sign]) => {
    while (left >= value) {
      out += sign;
      left -= value;
    }
    return out;
  }, '');
}

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
        {/* Under the pointer the whole line swings out from behind the mark — see the
            stylesheet. The count is of the source the app is built from, and it is counted
            at the moment it is built rather than typed here, so it is never out of date. */}
        <p className="about-credit">
          By Saranan · Mk {roman(__BUILD_MK__)} · {__SOURCE_LINES__.toLocaleString('en-GB')} lines
        </p>
      </div>
    </div>
  );
}
