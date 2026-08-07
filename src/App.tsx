import { useState } from 'react';
import { usePortfolio } from './store/portfolio';
import { usePortfolioView, money } from './lib/derive';
import { weekNumber } from './lib/dates';
import type { Person, Project } from './types';
import { Drawer } from './components/Drawer';
import { ProjectForm } from './components/ProjectForm';
import { PersonForm } from './components/PersonForm';
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
    'CDMO programmes and Client Solutions projects side by side. Internal work carries the quiet stripe.',
  ],
  resources: [
    'People and capacity',
    'Resourcing',
    'What each person has already promised, month by month, and where the work needs more hands than there are.',
  ],
  financials: [
    'Budget · cost · invoice',
    'Financials',
    'Customer-facing work carries contract value and invoicing. Internal programmes draw against an approved pool.',
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
    'Add, edit and remove projects and people, or move the whole portfolio in and out as a file.',
  ],
};

type Editing = { kind: 'project'; project: Project | null } | { kind: 'person'; person: Person | null } | null;

/** Screens whose content reads better at a narrower measure. The width wraps the header
    too, so a screen's title, buttons and body share one centred column. */
const SCREEN_WIDTH: Partial<Record<ScreenId, number>> = {
  timeline: 1240,
  detail: 1100,
  alerts: 1180,
};

export function App() {
  const store = usePortfolio();
  const view = usePortfolioView(store.portfolio);
  const [screen, setScreen] = useState<ScreenId>('portfolio');
  const [detailId, setDetailId] = useState<string | null>(view.projects[0]?.id ?? null);
  const [editing, setEditing] = useState<Editing>(null);

  const selected = view.projects.find((p) => p.id === detailId) ?? view.projects[0] ?? null;

  const openProject = (id: string) => {
    setDetailId(id);
    setScreen('detail');
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
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, lineHeight: 1.1 }}>
            Delivery Office
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
        <div style={{ marginTop: 'auto', fontSize: 11, lineHeight: 1.6, color: 'var(--color-accent-300)' }}>
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
          <div>
            <div className="kicker">{kicker}</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 52 }}>{title}</h1>
            <p style={{ margin: 'var(--space-3) 0 0', fontSize: 16, maxWidth: '60ch', color: 'var(--color-neutral-700)', textWrap: 'pretty' }}>
              {blurb}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 'none' }}>
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
            onEditPerson={(person) => setEditing({ kind: 'person', person })}
            onSetThreshold={store.setThreshold}
          />
        )}
        {screen === 'financials' && <Financials view={view} onOpenProject={openProject} />}
        {screen === 'timeline' && <Timeline view={view} onOpenProject={openProject} />}
        {screen === 'detail' && (
          <ProjectDetail
            view={view}
            project={selected}
            onSelect={setDetailId}
            onEdit={(project) => setEditing({ kind: 'project', project })}
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
            allocations={editing.project ? view.allocationsOf(editing.project.id) : {}}
            otherLoads={view.loadsExcluding(editing.project?.id ?? '')}
            onSave={(project, allocations) => {
              store.saveProject(project, allocations);
              setDetailId((current) => current ?? project.id);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={(id) => {
              store.deleteProject(id);
              if (detailId === id) setDetailId(null);
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
            onSave={(person) => {
              store.savePerson(person);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={(id) => {
              store.deletePerson(id);
              setEditing(null);
            }}
          />
        </Drawer>
      )}
    </div>
  );
}
