import type { ProjectView } from '../lib/derive';

/* The mark that runs alongside every project, in two tones split across its length: the
   top half names the delivery type, the bottom half says who the work is for — internal
   being the lighter of the two. Used on the portfolio cards, the timeline rows and the
   detail header so the same project reads the same wherever it appears. */
export function Stripe({
  project,
  /** `fill` stretches to the parent's height; a number is a fixed height. */
  height = 'fill',
  absolute = false,
}: {
  project: ProjectView;
  height?: number | 'fill';
  absolute?: boolean;
}) {
  const box = absolute
    ? ({ position: 'absolute', left: 0, top: 0, bottom: 0 } as const)
    : ({ height: height === 'fill' ? '100%' : height } as const);
  return (
    <span
      aria-hidden
      title={`${project.typeLabel} · ${project.facingLabel.toLowerCase()}`}
      style={{ display: 'flex', flexDirection: 'column', width: 3, flex: 'none', ...box }}
    >
      <span style={{ flex: 1, background: project.stripeType, display: 'block' }} />
      <span style={{ flex: 1, background: project.stripe, display: 'block' }} />
    </span>
  );
}

/** The same two bands laid out for a legend swatch. */
export function StripeSwatch({ type, facing }: { type: string; facing: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', width: 3, height: 15, flex: 'none' }}>
      <span style={{ flex: 1, background: type, display: 'block' }} />
      <span style={{ flex: 1, background: facing, display: 'block' }} />
    </span>
  );
}
