import { BrandMark } from './BrandMark';

/* The stacked lockup from the brand file: mark on its paper, name centred beneath it, one
   word per line. It is one component rather than two so the sidebar and the credit page
   are literally the same object — the arrival, the drag, the hover and the name taking the
   front pane's teal all come along with it, instead of being kept in step by hand.

   The name is the mark's next sibling because the stylesheet reaches it that way. */
export function BrandLockup({
  onDoubleClick,
  tagline,
}: {
  onDoubleClick?: () => void;
  /** The line under the name. Left out where the page has something else to say. */
  tagline?: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <BrandMark onDoubleClick={onDoubleClick} />
      <div
        className="brand-wordmark"
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: 20,
          lineHeight: 1.4,
          letterSpacing: '0.04em',
          marginTop: 14,
        }}
      >
        <span style={{ display: 'block' }}>Project</span>
        <span style={{ display: 'block' }}>Glass</span>
      </div>
      {tagline && (
        <div className="eyebrow" style={{ marginTop: 6 }}>
          {tagline}
        </div>
      )}
    </div>
  );
}
