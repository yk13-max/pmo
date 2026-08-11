import { BrandMark } from './BrandMark';

/* The stacked lockup from the brand file: mark on its paper, name centred beneath it, one
   word per line. It is one component rather than two so the sidebar and the credit page
   are literally the same object — the arrival, the drag, the hover and the name taking the
   front pane's teal all come along with it, instead of being kept in step by hand.

   The name is the mark's next sibling because the stylesheet reaches it that way. */
export function BrandLockup({
  onDoubleClick,
  tagline,
  stacked = true,
}: {
  onDoubleClick?: () => void;
  /** The line under the name. Left out where the page has something else to say. */
  tagline?: string;
  /** One word per line, as the menu's narrow column needs. Off where there is room. */
  stacked?: boolean;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <BrandMark onDoubleClick={onDoubleClick} />
      {/* Everything about how the name is set lives in the stylesheet, so a page with more
          room to give it can say so in one rule. */}
      <div className="brand-wordmark">
        {stacked ? (
          <>
            <span style={{ display: 'block' }}>Project</span>
            <span style={{ display: 'block' }}>Glass</span>
          </>
        ) : (
          'Project Glass'
        )}
      </div>
      {tagline && (
        <div className="eyebrow" style={{ marginTop: 6 }}>
          {tagline}
        </div>
      )}
    </div>
  );
}
