/* Other work, on the resourcing charts.

   It is the middle slice of every bar: days off at the base, then meetings and admin, then
   the project work stacked on what is left. Being in the middle, it has to be told apart
   from a deep navy below it and a pale grey-blue above — and no flat colour can. Put the
   best possible middle tone between those two and it manages 2.15:1 against each of them,
   which is why the old mid-blue read as a smudge rather than a band.

   So it is drawn rather than coloured. A diagonal hatch has an edge against anything,
   whatever the two colours either side happen to be, and it survives being printed in
   black and white, which a third blue never did. */

/** What every chart references. Ids repeat across the inline SVGs; they are the same
    pattern, and a browser resolves `url(#…)` to the first one in the document either way. */
export const HATCH_ID = 'hatch-other-work';

/** The pattern itself, dropped inside any chart that fills something with it. */
export function HatchDefs() {
  return (
    <defs>
      <pattern id={HATCH_ID} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--color-neutral-200)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-accent)" strokeWidth="3" />
      </pattern>
    </defs>
  );
}

/** The same thing as a background, for the swatch beside the word in a key. */
export const HATCH_SWATCH: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-200)',
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--color-accent) 0 3px, transparent 3px 6px)',
};
