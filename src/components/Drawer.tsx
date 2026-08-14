import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/* Whether the pane it is sitting in has the screen. What a pane shows is mostly the same
   either way, but a few things are only worth showing when there is room for them. */
const FullPane = createContext(false);
export const useFullPane = () => useContext(FullPane);

/* Whether the pane is a full page is a working preference rather than a property of what is
   being edited. Somebody who opens a project full screen because that is how they like to
   work through a form wants the next one the same way, so the choice is remembered between
   panes and between sessions. */
const FULL_KEY = 'pmo-tracker:drawer-full';

function readFull() {
  try {
    return localStorage.getItem(FULL_KEY) === '1';
  } catch {
    return false;
  }
}

export function Drawer({
  title,
  kicker,
  onClose,
  expandable = false,
  children,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  /** Offer the full-page toggle. For panes long enough that the extra width earns its keep. */
  expandable?: boolean;
  children: ReactNode;
}) {
  const [full, setFull] = useState(() => expandable && readFull());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const expand = (next: boolean) => {
    setFull(next);
    try {
      localStorage.setItem(FULL_KEY, next ? '1' : '0');
    } catch {
      /* Private browsing and the like. The pane still works; the choice just does not stick. */
    }
  };

  return (
    <div
      className={full ? 'drawer-backdrop is-full' : 'drawer-backdrop'}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={full ? 'drawer is-full' : 'drawer'} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            <h2 style={{ margin: '6px 0 0' }}>{title}</h2>
          </div>
          <div className="drawer-head-actions">
            {expandable && (
              <button
                type="button"
                className="btn btn-secondary drawer-expand"
                aria-pressed={full}
                title={
                  full
                    ? 'Put the pane back to its usual width'
                    : 'Fill the screen, and lay the sections out side by side'
                }
                onClick={() => expand(!full)}
              >
                <ExpandIcon full={full} />
                {full ? 'Exit full page' : 'Full page'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <FullPane.Provider value={full}>{children}</FullPane.Provider>
      </div>
    </div>
  );
}

/** Arrows out of the corners to expand, arrows into them to come back. */
function ExpandIcon({ full }: { full: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {full ? (
          <>
            <path d="M6 1v5H1M8 13V8h5" />
            <path d="M13 1L8 6M1 13l5-5" />
          </>
        ) : (
          <>
            <path d="M9 1h4v4M5 13H1V9" />
            <path d="M13 1L8 6M1 13l5-5" />
          </>
        )}
      </g>
    </svg>
  );
}
