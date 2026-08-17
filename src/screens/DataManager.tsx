import { useRef, useState } from 'react';
import type { Person, Portfolio, Project } from '../types';
import { hoursToDays, type PortfolioView } from '../lib/derive';
import { usePortfolio } from '../store/portfolio';
import { applyCsv, portfolioCsvFiles } from '../lib/csv';
import { Tabs } from '../components/Tabs';
import { ProjectTypeEditor } from '../components/ProjectTypeEditor';
import { ProjectFilters, ProjectHeaders, useProjectsTable } from '../components/ProjectsTable';

/* CSV is what people exchange, but it is one sheet per kind of thing. The JSON pair moves
   the portfolio whole — every project, person, booking, day off, plan, delivery type and
   setting in one file — which is what you want for a backup or for moving between
   machines. Both are on the toolbar. */
const SHOW_JSON_TRANSFER = true;

/* The two things on Settings that destroy work. Both are asked three times over, and the
   first yes is what downloads the backup, so nobody can walk past it. */
const DANGER_ACTIONS = [
  {
    kind: 'reset' as const,
    title: 'Reset to sample data',
    blurb:
      'Throws away everything entered here and puts the demonstration portfolio back — 28 projects and a team to go with them. Useful for a fresh look at how the tracker works.',
    fate: 'will be replaced by the sample portfolio',
    confirm: 'Replace everything with the sample data',
  },
  {
    kind: 'clear' as const,
    title: 'Clear all data',
    blurb:
      'Empties the tracker: every project, person, booking, day off and public holiday goes. Job titles, delivery types and the planning window stay, so you can start entering real work straight away.',
    fate: 'will be deleted',
    confirm: 'Clear everything',
  },
];

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
  const { replaceAll, resetToSeed, clearAll, portfolio, addRole, removeRole, setArchived, setPersonArchived, deleteProject } =
    usePortfolio();
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [newRole, setNewRole] = useState('');
  const [danger, setDanger] = useState<{ kind: 'reset' | 'clear'; step: 1 | 2 | 3 } | null>(null);
  /* Work on hold has left every other screen, but this is the project data — it is where
     you go to find it and put it back. So it is listed here with the running work, sorted
     and filtered alongside it, and marked for what it is. */
  const { rows, filters, setFilters, sort, setSort } = useProjectsTable([
    ...view.projects,
    ...view.inactiveProjects,
  ]);

  /* What an archived person is still on the books for, across every project and every
     month — the reason their record is worth keeping. */
  const bookedDays = (personId: string) => {
    const hours = Object.entries(portfolio.allocations)
      .filter(([key]) => key.split('|')[1] === personId)
      .reduce((n, [, h]) => n + h, 0);
    return hoursToDays(hours).toFixed(1);
  };

  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const files = portfolioCsvFiles(portfolio, view.months);
    // Browsers throttle back-to-back downloads, so they are spaced out a little.
    files.forEach((f, i) => setTimeout(() => download(f.name, f.content, 'text/csv;charset=utf-8'), i * 250));
    setMessage({ tone: 'ok', text: `Exported ${files.length} CSVs: projects, people, allocations, leave and tasks.` });
  };

  const importCsv = async (file: File) => {
    try {
      const result = applyCsv(portfolio, await file.text(), view.months);
      replaceAll(result.portfolio);
      const skipped = result.skipped.length ? ` ${result.skipped.length} row(s) skipped: ${result.skipped.slice(0, 3).join('; ')}` : '';
      setMessage({ tone: result.skipped.length ? 'bad' : 'ok', text: `Imported ${result.applied} ${result.kind} row(s).${skipped}` });
    } catch (e) {
      setMessage({ tone: 'bad', text: `That CSV could not be read — ${e instanceof Error ? e.message : 'unknown error'}.` });
    }
  };

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Portfolio;
      if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.people) || typeof parsed.allocations !== 'object') {
        throw new Error('missing projects, people or allocations');
      }
      if (!window.confirm(`Replace the current ${portfolio.projects.length} projects with ${parsed.projects.length} from this file?`)) return;
      /* The file replaces the portfolio entire, so the count says what came in rather than
         only the two lists — an import that quietly dropped the bookings or the plans
         would otherwise look like a success. */
      replaceAll({ ...parsed, threshold: parsed.threshold ?? 85 });
      const bookings = Object.keys(parsed.allocations ?? {}).length;
      setMessage({
        tone: 'ok',
        text: `Loaded ${parsed.projects.length} projects, ${parsed.people.length} people, ${bookings} booking${
          bookings === 1 ? '' : 's'
        }, ${(parsed.tasks ?? []).length} planned task${(parsed.tasks ?? []).length === 1 ? '' : 's'} and ${
          Object.keys(parsed.leave ?? {}).length
        } month(s) of leave.`,
      });
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
        {SHOW_JSON_TRANSFER && (
          <>
            <button type="button" className="btn btn-secondary" onClick={onExport}>
              Export JSON
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => csvRef.current?.click()}>
          Import CSV
        </button>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importCsv(file);
            e.target.value = '';
          }}
        />
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
      </div>

      {message && (
        <p style={{ color: message.tone === 'ok' ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)', fontSize: 14 }}>{message.text}</p>
      )}

      <Tabs
        storageKey="data"
        tabs={[
          { id: 'projects', label: 'Projects', count: view.projects.length + view.inactiveProjects.length, render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Projects</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Everything the screens are built from. Editing a project also books people onto it. Narrow the list with the
        filters, and click any column title to sort by it.
      </p>
      <ProjectFilters
        view={view}
        filters={filters}
        setFilters={setFilters}
        shown={rows.length}
        total={view.projects.length + view.inactiveProjects.length}
      />
      {rows.length === 0 ? (
        <p className="empty">No project matches these filters.</p>
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <ProjectHeaders sort={sort} setSort={setSort} />
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" className="card-link" onClick={() => onOpenProject(p.id)}>
                    <span className="project-name" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      {p.name}
                    </span>
                    <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}> · {p.client}</span>
                  </button>
                </td>
                <td style={{ fontSize: 13 }}>{p.typeShort}</td>
                <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{p.facingLabel}</td>
                <td style={{ fontSize: 13 }}>
                  {p.pmName}
                  {/* Under the name whose project it is, in the amber the tracker uses for
                      "watch this" — quiet enough to scan past on a running project, plain
                      enough to find when you are looking for what has stopped. */}
                  {p.inactive && (
                    <div className="eyebrow is-on-hold" title="Out of the portfolio and drawing nobody’s time">
                      On hold
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 13, color: p.priority <= 2 ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)' }}>
                  P{p.priority} {p.priorityLabel}
                </td>
                <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{p.phaseName}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.pct}%</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.budgetLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.actualLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.valueLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.billedLabel}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.loadInk }}>{p.loadDaysLabel}</td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: p.ragColor }} />
                    {p.ragLabel}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => onEditProject(p)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (window.confirm(`Archive ${p.name}? It keeps all its data and can be restored from the Archive tab.`)) {
                          setArchived(p.id, true);
                          setMessage({ tone: 'ok', text: `${p.name} archived.` });
                        }
                      }}
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      </>) },
          { id: 'people', label: 'People', count: view.people.length, render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>People</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        People are archived rather than deleted. Someone who leaves keeps every booking and day off they ever had, so
        what a project drew stays true; they simply stop being planned forward.
      </p>
      <table className="table" style={{ maxWidth: 900 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th style={{ width: 180 }}>Role</th>
            <th style={{ width: 170 }}>Project family</th>
            <th style={{ textAlign: 'right', width: 120 }}>Available week</th>
            <th style={{ textAlign: 'right', width: 110 }}>Non-project</th>
            <th style={{ textAlign: 'right', width: 90 }}>Leave</th>
            <th style={{ textAlign: 'right', width: 100 }}>Peak load</th>
            <th style={{ width: 150 }} />
          </tr>
        </thead>
        <tbody>
          {view.peopleViews.map((row) => (
            <tr key={row.person.id}>
              <td>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{row.person.name}</span>
              </td>
              <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{row.person.role}</td>
              {/* People are assigned to kinds of work, so this reads against the families. */}
              <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{row.person.types.map((id) => view.families.find((f) => f.id === id)?.label ?? id).join(', ') || 'All'}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.person.capacity}%</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>
                {row.person.overheadPct ? `${row.person.overheadPct}%` : '—'}
              </td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>
                {row.leaveDays.reduce((n, d) => n + d, 0)}d
              </td>
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
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => onEditPerson(row.person)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Archive ${row.person.name}? They keep every booking and day off and can be restored from the Archive tab.`,
                        )
                      ) {
                        setPersonArchived(row.person.id, true);
                        setMessage({ tone: 'ok', text: `${row.person.name} archived.` });
                      }
                    }}
                  >
                    Archive
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </>) },
          { id: 'types', label: 'Project types', count: view.projectTypes.length, render: () => <ProjectTypeEditor view={view} /> },
          { id: 'titles', label: 'Job titles', count: view.roles.length, render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Job titles</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        The titles offered when adding someone. A title in use cannot be removed — change the person&rsquo;s title first.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', maxWidth: 900 }}>
        {view.roles.map((role) => {
          const inUse = view.people.filter((p) => p.role === role).length;
          return (
            <span
              key={role}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderRadius: 3,
                border: '1px solid var(--color-divider)',
                fontSize: 13,
              }}
            >
              {role}
              <span style={{ color: 'var(--color-neutral-600)', fontSize: 12 }}>{inUse || 'unused'}</span>
              <button
                type="button"
                aria-label={`Remove ${role}`}
                title={inUse ? `${inUse} person(s) hold this title` : `Remove ${role}`}
                disabled={inUse > 0}
                onClick={() => removeRole(role)}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: inUse ? 'not-allowed' : 'pointer',
                  color: inUse ? 'var(--color-neutral-400)' : 'var(--color-accent-2-700)',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          );
        })}
        <span style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
          <input
            className="input"
            style={{ width: 200 }}
            value={newRole}
            placeholder="Add a job title"
            aria-label="New job title"
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newRole.trim()) {
                addRole(newRole);
                setNewRole('');
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!newRole.trim()}
            onClick={() => {
              addRole(newRole);
              setNewRole('');
            }}
          >
            Add
          </button>
        </span>
      </div>

      </>) },
          { id: 'settings', label: 'Settings', render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Settings</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-6)' }}>
        Everything lives in this browser and nowhere else, so the two actions below cannot be undone from inside the
        tracker. Both take you through three questions and make you download a full CSV backup on the way — import
        those five files again to put things back as they were.
      </p>

      <div style={{ display: 'grid', gap: 'var(--space-4)', maxWidth: 720 }}>
        {DANGER_ACTIONS.map((action) => {
          const open = danger?.kind === action.kind;
          const step = open ? danger.step : 0;
          return (
            <section
              key={action.kind}
              style={{
                border: '1px solid var(--color-divider)',
                borderLeft: `3px solid ${open ? 'var(--color-accent-2-700)' : 'var(--color-divider)'}`,
                padding: 'var(--space-4)',
              }}
            >
              <h4 style={{ margin: '0 0 4px', fontSize: 17 }}>{action.title}</h4>
              <p style={{ margin: 0, fontSize: 15, color: 'var(--color-neutral-700)' }}>{action.blurb}</p>

              {!open ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 'var(--space-3)', color: 'var(--color-accent-2-700)' }}
                  onClick={() => setDanger({ kind: action.kind, step: 1 })}
                >
                  {action.title}
                </button>
              ) : (
                <div style={{ marginTop: 'var(--space-4)', background: 'var(--color-neutral-100)', padding: 'var(--space-4)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-accent-2-700)' }}>
                    Ask {step} of 3
                  </p>
                  <p style={{ margin: 0, fontSize: 15 }}>
                    {step === 1 &&
                      'Take a backup first. Continuing downloads five CSV files — projects, people, allocations, leave and the task plans. They are the only way back, so put them somewhere you will find them again.'}
                    {step === 2 &&
                      'Check those five CSVs really did download before you go any further. Nothing has changed yet.'}
                    {step === 3 &&
                      `Last chance. ${portfolio.projects.length} project${portfolio.projects.length === 1 ? '' : 's'}, ${portfolio.people.length} ${portfolio.people.length === 1 ? 'person' : 'people'} and ${Object.keys(portfolio.allocations).length} booking${Object.keys(portfolio.allocations).length === 1 ? '' : 's'} ${action.fate}.`}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ color: 'var(--color-accent-2-700)' }}
                      onClick={() => {
                        // The backup is not optional: the first yes downloads it, then the asking goes on.
                        if (step === 1) exportCsv();
                        if (step < 3) {
                          setDanger({ kind: action.kind, step: (step + 1) as 2 | 3 });
                          return;
                        }
                        if (action.kind === 'reset') {
                          resetToSeed();
                          setMessage({ tone: 'ok', text: 'Sample portfolio restored.' });
                        } else {
                          clearAll();
                          setMessage({ tone: 'ok', text: 'Everything cleared. Import your CSVs to put it back.' });
                        }
                        setDanger(null);
                      }}
                    >
                      {step === 1 ? 'Download the backup and continue' : step === 2 ? 'The backup is safe, continue' : action.confirm}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setDanger(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
      </>) },
          { id: 'archive', label: 'Archive', count: view.archivedProjects.length + view.archivedPeople.length, render: () => (<>
      <h3 style={{ margin: '0 0 4px' }}>Archived projects</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Archived work keeps every field, booking and invoice date, but drops out of the portfolio, resourcing,
        financials, timeline and alerts. Restore it and it reappears everywhere.
      </p>
      {view.archivedProjects.length === 0 ? (
        <p className="empty">Nothing archived.</p>
      ) : (
        <table className="table" style={{ maxWidth: 1040 }}>
          <thead>
            <tr>
              <th>Project</th>
              <th style={{ width: 120 }}>Type</th>
              <th style={{ width: 110 }}>Owner</th>
              <th style={{ textAlign: 'right', width: 100 }}>Budget</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 210 }} />
            </tr>
          </thead>
          <tbody>
            {view.archivedProjects.map((p) => (
              <tr key={p.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}> · {p.client}</span>
                </td>
                <td style={{ fontSize: 13 }}>{p.typeLabel}</td>
                <td style={{ fontSize: 13 }}>{p.pmName}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.budgetLabel}</td>
                <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{p.ragLabel}</td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setArchived(p.id, false)}>
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: 'var(--color-accent-2-700)' }}
                      onClick={() => {
                        if (window.confirm(`Permanently delete ${p.name} and its bookings? This cannot be undone.`)) {
                          deleteProject(p.id);
                          setMessage({ tone: 'ok', text: `${p.name} deleted for good.` });
                        }
                      }}
                    >
                      Delete for good
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ margin: 'var(--space-8) 0 4px' }}>Archived people</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        Someone who has left. Every hour they were booked and every day they took off stays in the record, so the
        history of what each project drew is unchanged — they are simply no longer planned forward or counted as
        capacity. Restore them and they reappear everywhere.
      </p>
      {view.archivedPeople.length === 0 ? (
        <p className="empty">Nobody archived.</p>
      ) : (
        <table className="table" style={{ maxWidth: 1040 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 200 }}>Role</th>
              <th style={{ textAlign: 'right', width: 140 }}>Days on record</th>
              <th style={{ width: 210 }} />
            </tr>
          </thead>
          <tbody>
            {view.archivedPeople.map((person) => (
              <tr key={person.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{person.name}</span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{person.role}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{bookedDays(person.id)}d</td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => setPersonArchived(person.id, false)}>
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </>) },
        ]}
      />
    </div>
  );
}
