import { useRef, useState } from 'react';
import type { Person, Portfolio, Project } from '../types';
import type { PortfolioView } from '../lib/derive';
import { usePortfolio } from '../store/portfolio';

export function DataManager({
  view,
  onEditProject,
  onNewProject,
  onEditPerson,
  onNewPerson,
  onOpenProject,
  onExport,
}: {
  view: PortfolioView;
  onEditProject: (project: Project) => void;
  onNewProject: () => void;
  onEditPerson: (person: Person) => void;
  onNewPerson: () => void;
  onOpenProject: (id: string) => void;
  onExport: () => void;
}) {
  const { replaceAll, resetToSeed, portfolio } = usePortfolio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Portfolio;
      if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.people) || typeof parsed.allocations !== 'object') {
        throw new Error('missing projects, people or allocations');
      }
      if (!window.confirm(`Replace the current ${portfolio.projects.length} projects with ${parsed.projects.length} from this file?`)) return;
      replaceAll({ ...parsed, threshold: parsed.threshold ?? 85 });
      setMessage({ tone: 'ok', text: `Loaded ${parsed.projects.length} projects and ${parsed.people.length} people.` });
    } catch (e) {
      setMessage({ tone: 'bad', text: `That file could not be read — ${e instanceof Error ? e.message : 'invalid JSON'}.` });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
        <button type="button" className="btn btn-primary" onClick={onNewProject}>
          Add project
        </button>
        <button type="button" className="btn btn-secondary" onClick={onNewPerson}>
          Add person
        </button>
        <button type="button" className="btn btn-secondary" onClick={onExport}>
          Export JSON
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginLeft: 'auto', color: 'var(--color-accent-2-700)' }}
          onClick={() => {
            if (window.confirm('Replace everything with the sample portfolio? Anything you have entered will be lost.')) {
              resetToSeed();
              setMessage({ tone: 'ok', text: 'Sample portfolio restored.' });
            }
          }}
        >
          Reset to sample data
        </button>
      </div>

      {message && (
        <p style={{ color: message.tone === 'ok' ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)', fontSize: 14 }}>{message.text}</p>
      )}

      <h3 style={{ margin: '0 0 4px' }}>Projects</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Everything the screens are built from. Editing a project also books people onto it.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th style={{ width: 70 }}>Type</th>
              <th style={{ width: 120 }}>For</th>
              <th style={{ width: 110 }}>Owner</th>
              <th style={{ width: 150 }}>Phase</th>
              <th style={{ textAlign: 'right', width: 70 }}>Done</th>
              <th style={{ textAlign: 'right', width: 90 }}>Budget</th>
              <th style={{ textAlign: 'right', width: 90 }}>Spent</th>
              <th style={{ textAlign: 'right', width: 90 }}>Agreed</th>
              <th style={{ textAlign: 'right', width: 90 }}>Invoiced</th>
              <th style={{ textAlign: 'right', width: 70 }}>Load</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {view.projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                    <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      {p.name}
                    </span>
                    <span style={{ color: 'var(--color-neutral-600)', fontSize: 12 }}> · {p.client}</span>
                  </button>
                </td>
                <td style={{ fontSize: 12 }}>{p.typeShort}</td>
                <td style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{p.facingLabel}</td>
                <td style={{ fontSize: 12 }}>{p.pmName}</td>
                <td style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{p.phaseName}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.pct}%</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.budgetLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.actualLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.valueLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.billedLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.loadInk }}>{p.loadLabel}</td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: p.ragColor }} />
                    {p.ragLabel}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => onEditProject(p)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: 'var(--space-8) 0 4px' }}>People</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Removing someone also removes their bookings from every project.
      </p>
      <table className="table" style={{ maxWidth: 900 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th style={{ width: 180 }}>Role</th>
            <th style={{ width: 150 }}>Works across</th>
            <th style={{ textAlign: 'right', width: 120 }}>Available week</th>
            <th style={{ textAlign: 'right', width: 100 }}>Peak load</th>
            <th style={{ width: 100 }} />
          </tr>
        </thead>
        <tbody>
          {view.peopleViews.map((row) => (
            <tr key={row.person.id}>
              <td>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{row.person.name}</span>
              </td>
              <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{row.person.role}</td>
              <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{row.person.discipline || 'Both'}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.person.capacity}%</td>
              <td
                style={{
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: row.peak > 100 ? 'var(--color-accent-2-700)' : 'var(--color-text)',
                }}
              >
                {row.peak}%
              </td>
              <td>
                <button type="button" className="btn btn-ghost" onClick={() => onEditPerson(row.person)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
