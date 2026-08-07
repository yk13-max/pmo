import { useState, type ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  /** Small figure beside the label — a count, total or flag. */
  count?: ReactNode;
  render: () => ReactNode;
}

/** Turns a page's sections into tabs so it reads as one screen rather than a long scroll. */
export function Tabs({
  tabs,
  storageKey,
  renderAll = false,
}: {
  tabs: TabDef[];
  storageKey?: string;
  /** Keep every panel mounted and hidden, so printing can reveal them all. */
  renderAll?: boolean;
}) {
  const [active, setActive] = useState(() => {
    const saved = storageKey ? sessionStorage.getItem(`tabs:${storageKey}`) : null;
    return saved && tabs.some((t) => t.id === saved) ? saved : tabs[0]?.id;
  });

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={t.id === current.id}
            onClick={() => {
              setActive(t.id);
              if (storageKey) sessionStorage.setItem(`tabs:${storageKey}`, t.id);
            }}
          >
            {t.label}
            {t.count !== undefined && t.count !== null && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {renderAll ? (
        /* Every panel opens with its own heading, so print reveals them as they are rather
           than adding a second title above each one. */
        tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            className="tab-panel"
            style={t.id === current.id ? undefined : { display: 'none' }}
          >
            {t.render()}
          </div>
        ))
      ) : (
        <div role="tabpanel">{current.render()}</div>
      )}
    </div>
  );
}
