import { useEffect, useState } from 'react';
import { usePortfolio } from './store/portfolio';
import { usePortfolioView, money } from './lib/derive';
import { useRoute } from './lib/route';
import { weekNumber } from './lib/dates';
import type { Person, Project } from './types';
import { Drawer } from './components/Drawer';
import { GlassMark } from './components/GlassMark';
import { ProjectForm } from './components/ProjectForm';
import { PersonForm } from './components/PersonForm';
import { PersonDetail } from './components/PersonDetail';
import { Portfolio } from './screens/Portfolio';
import { Resourcing } from './screens/Resourcing';
import { Financials } from './screens/Financials';
import { Timeline } from './screens/Timeline';
import { ProjectDetail } from './screens/ProjectDetail';
import { Alerts } from './screens/Alerts';
import { DataManager } from './screens/DataManager';

export type ScreenId = 'portfolio' | 'resources' | 'financials' | 'timeline' | 'detail' | 'alerts' | 'data';

const HEADS: Record<ScreenId, [kicker: string, title: string, blurb: string]> = {
  portfolio: [
    'Both delivery types',
    'Portfolio',
    'Every delivery type side by side. The top of the stripe names the type; the bottom says who it is for, internal being the lighter half.',
  ],
  resources: [
    'People and capacity',
    'Resourcing',
    'What each person has already promised, month by month, and where the work needs more hands than there are.',
  ],
  financials: [
    'Budget · cost · invoice',
    'Financials',
    'Customer work carries contract value and invoicing. Internal programmes draw against an approved pool.',
  ],
  timeline: [
    'Two years at a glance',
    'Timeline',
    'Where every project sits in time. The upright line is today; the diamond is the next thing due.',
  ],
  detail: [
    'One project, end to end',
    'Project detail',
    'The phases it passes through, the money it earns or spends, and who is working on it.',
  ],
  alerts: [
    'Things needing attention',
    'Alerts',
    'Four kinds of problem, in the order a delivery lead usually wants them.',
  ],
  data: [
    'Everything you have entered',
    'Data',
    'Add, edit and archive projects and people, or move the whole portfolio in and out as a file.',
  ],
};

type Editing =
  | { kind: 'project'; project: Project | null }
  | { kind: 'person'; person: Person | null }
  | { kind: 'person-detail'; person: Person }
  | null;

/** Screens whose content reads better at a narrower measure. The width wraps the header
    too, so a screen's title, buttons and body share one centred column. */
/** Screens that lay themselves out for paper — they keep every tab mounted, so the whole
    screen goes into the PDF rather than whichever panel happened to be open. */
const PRINTABLE = new Set<ScreenId>(['detail', 'alerts']);

const SCREEN_WIDTH: Partial<Record<ScreenId, number>> = {
  timeline: 1240,
  detail: 1100,
  alerts: 1180,
};

export function App() {
  const store = usePortfolio();
  const view = usePortfolioView(store.portfolio);
  const [route, go] = useRoute({ screen: 'portfolio', projectId: null });
  const { screen, projectId } = route;
  const [editing, setEditing] = useState<Editing>(null);
  /* The address only names a project on the detail screen, so the last one opened is
     remembered here — reaching the screen from the nav lands where you left it. */
  const [lastProjectId, setLastProjectId] = useState<string | null>(projectId);
  useEffect(() => {
    if (projectId) setLastProjectId(projectId);
  }, [projectId]);

  const selected =
    view.projects.find((p) => p.id === (projectId ?? lastProjectId)) ?? view.projects[0] ?? null;

  /* Moving between areas closes whatever was open over the top, so going back never
     leaves an edit pane floating above a screen it does not belong to. */
  const setScreen = (id: ScreenId) => {
    setEditing(null);
    go(id === 'detail' ? { screen: id, projectId: lastProjectId ?? selected?.id ?? null } : { screen: id });
  };

  const openProject = (id: string) => {
    setEditing(null);
    go({ screen: 'detail', projectId: id });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store.portfolio, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pmo-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nav: [ScreenId, string, string | number][] = [
    ['portfolio', 'Portfolio', view.projects.length],
    ['resources', 'Resourcing', `${view.people.length} people`],
    ['financials', 'Financials', money(view.totals.value)],
    ['timeline', 'Timeline', 'Two years'],
    ['detail', 'Project detail', selected?.name ?? '—'],
    ['alerts', 'Alerts', view.totals.atRisk],
    ['data', 'Data', 'Add & edit'],
  ];

  const [kicker, title, blurb] = HEADS[screen];

  return (
    <div className="shell">
      <aside className="sidebar">
        {/* The brand file's stacked lockup: mark on top, name centred beneath it. The
            eyebrow follows the name's alignment so the whole block reads as one thing. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* Both variants are drawn, stacked, and cross-faded: the mark reads light on
              paper and switches to the dark version as the tile turns navy under the
              pointer — the light/dark pair the brand file sets out. */}
          <div className="brand-tile">
            <GlassMark size={75} variant="light" className="brand-mark-light" />
            <GlassMark size={75} variant="dark" className="brand-mark-dark" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, lineHeight: 1.15, marginTop: 12 }}>
            Project Glass (PMO)
          </div>
          <div className="eyebrow" style={{ marginTop: 6 }}>Portfolio tracker</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nav.map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              className="nav-item"
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => setScreen(id)}
            >
              <span>{label}</span>
              <span className="count">{count}</span>
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', fontSize: 12, lineHeight: 1.6, color: 'var(--color-accent-300)' }}>
          Week {weekNumber(view.today)} · FY{String(view.today.getFullYear()).slice(2)}
          <br />
          {view.people.length} people · {view.projects.length} projects
          <br />
          Over-allocation flagged above {view.threshold}%
        </div>
      </aside>

      <main className="main">
       <div style={{ maxWidth: SCREEN_WIDTH[screen], marginInline: 'auto' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 'var(--space-8)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{kicker}</div>
            <h1 className="page-title" style={{ margin: '8px 0 0' }}>{title}</h1>
            <p style={{ margin: 'var(--space-3) 0 0', fontSize: 16, color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
              {blurb}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 'none' }}>
            {PRINTABLE.has(screen) && (
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                Export as PDF
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={exportJson}>
              Export
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ kind: 'project', project: null })}>
              New project
            </button>
          </div>
        </header>

        {screen === 'portfolio' && <Portfolio view={view} onOpenProject={openProject} />}
        {screen === 'resources' && (
          <Resourcing
            view={view}
            onAddPerson={() => setEditing({ kind: 'person', person: null })}
            onOpenPerson={(person) => setEditing({ kind: 'person-detail', person })}
            onSetThreshold={store.setThreshold}
            onSetWindow={store.setWindow}
            onSetLeave={store.setLeave}
            onSetPublicHoliday={store.setPublicHoliday}
          />
        )}
        {screen === 'financials' && <Financials view={view} onOpenProject={openProject} />}
        {screen === 'timeline' && <Timeline view={view} onOpenProject={openProject} />}
        {screen === 'detail' && (
          <ProjectDetail
            view={view}
            project={selected}
            onSelect={(id) => go({ projectId: id })}
            onEdit={(project) => setEditing({ kind: 'project', project })}
            onSetWindow={store.setWindow}
          />
        )}
        {screen === 'alerts' && <Alerts view={view} onOpenProject={openProject} />}
        {screen === 'data' && (
          <DataManager
            view={view}
            onEditProject={(project) => setEditing({ kind: 'project', project })}
            onNewProject={() => setEditing({ kind: 'project', project: null })}
            onEditPerson={(person) => setEditing({ kind: 'person', person })}
            onNewPerson={() => setEditing({ kind: 'person', person: null })}
            onOpenProject={openProject}
            onExport={exportJson}
          />
        )}
       </div>
      </main>

      {editing?.kind === 'project' && (
        <Drawer
          title={editing.project ? `Edit ${editing.project.name}` : 'New project'}
          kicker={editing.project ? 'Project' : 'Add to the portfolio'}
          onClose={() => setEditing(null)}
        >
          <ProjectForm
            project={editing.project}
            people={view.people}
            months={view.months}
            monthLabels={view.monthLabels}
            threshold={view.threshold}
            projectTypes={view.projectTypes}
            allocations={editing.project ? view.allocationsOf(editing.project.id) : {}}
            otherLoads={view.loadsExcluding(editing.project?.id ?? '')}
            onSave={(project, allocations) => {
              store.saveProject(project, allocations);
              if (!projectId) go({ projectId: project.id });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={(id) => {
              const project = view.projects.find((p) => p.id === id);
              if (!window.confirm(`Archive ${project?.name ?? 'this project'}? It keeps all its data and moves to the archive on the Data screen, where it can be restored.`)) return;
              store.setArchived(id, true);
              if (projectId === id) go({ projectId: null });
              setEditing(null);
            }}
          />
        </Drawer>
      )}

      {editing?.kind === 'person' && (
        <Drawer
          title={editing.person ? `Edit ${editing.person.name}` : 'New person'}
          kicker="Team"
          onClose={() => setEditing(null)}
        >
          <PersonForm
            person={editing.person}
            roles={view.roles}
            projectTypes={view.projectTypes}
            months={view.months}
            monthLabels={view.monthLabels}
            leaveDays={
              /* The form edits what this person books themselves — public holidays are set once
                 for everybody on the Annual leave tab. */
              view.peopleViews.find((p) => p.person.id === editing.person?.id)?.ownLeaveDays ??
              view.months.map(() => 0)
            }
            onSave={(person) => {
              store.savePerson(person);
              setEditing(null);
            }}
            onAddRole={store.addRole}
            onSetLeave={store.setLeave}
            onCancel={() => setEditing(null)}
            onDelete={(id) => {
              const person = view.people.find((p) => p.id === id);
              if (
                !window.confirm(
                  `Archive ${person?.name ?? 'this person'}? They keep every booking and day off and move to the archive on the Data screen, where they can be restored.`,
                )
              )
                return;
              store.setPersonArchived(id, true);
              setEditing(null);
            }}
          />
        </Drawer>
      )}

      {editing?.kind === 'person-detail' && (
        <Drawer title={editing.person.name} kicker={editing.person.role} onClose={() => setEditing(null)}>
          <PersonDetail
            view={view}
            person={editing.person}
            onEdit={() => setEditing({ kind: 'person', person: editing.person })}
            onOpenProject={(id) => {
              setEditing(null);
              openProject(id);
            }}
          />
        </Drawer>
      )}
    </div>
  );
}
