/* The Project Glass mark, from the brand file. Three translucent panes on a rising
   diagonal: each stays visible through the last, and where two overlap the colour
   deepens rather than one hiding the other. The outer panes lean a few degrees off true,
   unevenly — set down rather than lined up — so the rotations are the mark, not a slip.

   Below about 20px the lean disappears into the panes, so it is not drawn smaller. */
export function GlassMark({
  size = 30,
  variant = 'dark',
  className,
}: {
  size?: number;
  /** `dark` is the version for navy chrome; `light` is for a pale ground. */
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const [paneA, paneB, paneC] =
    variant === 'dark'
      ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.34)', 'rgba(18,174,190,0.95)']
      : ['rgba(10,75,117,0.32)', 'rgba(10,75,117,0.6)', 'rgba(18,174,190,0.88)'];
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={className}
      // The wordmark beside it already says the name, so this is decoration.
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      {/* Each pane is wrapped so two motions can run without fighting over one transform:
          the group carries the lean and the spread, the rect inside carries the wiggle.
          The leans live in app.css rather than on the elements, because CSS transforms
          replace the attribute rather than compose with it. */}
      <g className="glass-pane glass-pane-a">
        <rect x="11" y="47" width="38" height="38" rx="9" fill={paneA} />
      </g>
      <g className="glass-pane glass-pane-b">
        <rect x="27" y="27" width="41" height="41" rx="9" fill={paneB} />
      </g>
      <g className="glass-pane glass-pane-c">
        <rect x="44" y="8" width="44" height="44" rx="9" fill={paneC} />
      </g>
    </svg>
  );
}
