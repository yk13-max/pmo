import { useEffect, useState } from 'react';
import { usePortfolio } from './store/portfolio';
import { usePortfolioView, money } from './lib/derive';
import { useRoute } from './lib/route';
import { useTheme } from './lib/theme';
import { fileStamp, weekNumber } from './lib/dates';
import type { Person, Project } from './types';
import { Drawer } from './components/Drawer';
import { BrandLockup } from './components/BrandLockup';
import { ThemeToggle } from './components/ThemeToggle';
import { BrandToggle } from './components/BrandToggle';
import { About } from './screens/About';
import { ProjectForm } from './components/ProjectForm';
import { PersonForm } from './components/PersonForm';
import { PersonDetail } from './components/PersonDetail';
import { Portfolio } from './screens/Portfolio';
import { Resourcing } from './screens/Resourcing';
import { Financials } from './screens/Financials';
import { Timeline } from './screens/Timeline';
import { ProjectDetail } from './screens/ProjectDetail';
import { Alerts } from './screens/Alerts';
import { Planning } from './screens/Planning';
import { Workstreams } from './screens/Workstreams';
import { DataManager } from './screens/DataManager';

export type ScreenId =
  | 'portfolio'
  | 'resources'
  | 'financials'
  | 'timeline'
  | 'detail'
  | 'planning'
  | 'workstreams'
  | 'alerts'
  | 'data'
  | 'about';

/* Every screen that wears the shell. The credit page is not one of them — it takes over
   the window instead, so it has no header to fill in. */
const HEADS: Record<Exclude<ScreenId, 'about'>, [kicker: string, title: string, blurb: string]> = {
  portfolio: [
    'All delivery types',
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
  planning: [
    'Tasks, dependencies and the critical path',
    'Planning',
    'Build one project\u2019s plan: nest tasks under its phases, link what waits on what, and see which of them the finish date actually turns on.',
  ],
  workstreams: [
    'Work that does not finish',
    'Workstreams',
    'Standing work with no start and no end — one lane each, month by month, and the plan behind whichever one you pick. Out of the portfolio, in the resourcing.',
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
  /* `workstream` only says what an empty form is for. An existing record knows what it is
     from its own flag, and the form reads that. */
  | { kind: 'project'; project: Project | null; workstream?: boolean }
  | { kind: 'person'; person: Person | null }
  | { kind: 'person-detail'; person: Person }
  | null;

/** Screens whose content reads better at a narrower measure. The width wraps the header
    too, so a screen's title, buttons and body share one centred column. */
/** Screens that lay themselves out for paper — they keep every tab mounted, so the whole
    screen goes into the PDF rather than whichever panel happened to be open. */
const PRINTABLE = new Set<ScreenId>(['detail', 'alerts']);

const SCREEN_WIDTH: Partial<Record<ScreenId, number>> = {
  workstreams: 1240,
  timeline: 1240,
  detail: 1100,
  alerts: 1180,
};

const BRAND_KEY = 'pmo-tracker:brand-small';

export function App() {
  const store = usePortfolio();
  const view = usePortfolioView(store.portfolio);
  const [route, go] = useRoute({ screen: 'portfolio', projectId: null });
  const [theme, toggleTheme] = useTheme();
  const { screen, projectId } = route;
  const [editing, setEditing] = useState<Editing>(null);
  /* The address only names a project on the detail screen, so the last one opened is
     remembered here — reaching the screen from the nav lands where you left it. */
  const [lastProjectId, setLastProjectId] = useState<string | null>(projectId);
  useEffect(() => {
    if (projectId) setLastProjectId(projectId);
  }, [projectId]);

  const selected =
    view.projects.find((p) => p.id === (projectId ?? lastProjectId)) ??
    /* A project on hold has left the portfolio, but asking for it by name should still open
       it rather than quietly showing a different one. */
    view.inactiveProjects.find((p) => p.id === (projectId ?? lastProjectId)) ??
    view.projects[0] ??
    null;

  /* Where the mark was double-clicked from, so double-clicking it again on the credit page
     puts you back in the area you left rather than at the front. */
  const [cameFrom, setCameFrom] = useState<ScreenId>('portfolio');

  /* Whether the lockup is folded down to a line. Remembered like the theme: it is a
     standing preference about the chrome, not something to be set again every morning. */
  const [smallBrand, setSmallBrand] = useState(() => {
    try {
      return localStorage.getItem(BRAND_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleBrand = () => {
    setSmallBrand((was) => {
      try {
        localStorage.setItem(BRAND_KEY, was ? '0' : '1');
      } catch {
        /* Private browsing. The switch still works; the choice just does not stick. */
      }
      return !was;
    });
  };

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
    a.download = `pmo-portfolio-${fileStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nav: [ScreenId, string, string | number][] = [
    ['portfolio', 'Portfolio', view.projects.length],
    ['resources', 'Resourcing', `${view.people.length} people`],
    ['financials', 'Financials', money(view.totals.value)],
    ['timeline', 'Timeline', 'Two years'],
    ['detail', 'Project detail', selected?.name ?? '—'],
    ['planning', 'Planning', selected?.name ?? '—'],
    ['workstreams', 'Workstreams', view.workstreams.length],
    ['alerts', 'Alerts', view.totals.atRisk],
    ['data', 'Data', 'Add & edit'],
  ];

  /* Bookings run to the project's own end date, so the grid in the edit pane covers every
     month the work is live rather than stopping at the resourcing window. The derived
     project is used rather than the stored one, so a last phase gate that stands in for the
     end date carries the grid out to it. */
  const editSpan =
    editing?.kind === 'project' && editing.project
      ? view.monthsFor(
          view.projects.find((p) => p.id === editing.project?.id) ??
            view.workstreams.find((p) => p.id === editing.project?.id) ??
            view.inactiveProjects.find((p) => p.id === editing.project?.id) ??
            editing.project,
        )
      : { months: view.months, labels: view.monthLabels };

  /* Double-clicking the mark leads here and double-clicking it again leads back. It takes
     the whole window: there is no menu on it, because it is not part of the tool. */
  if (screen === 'about') return <About onLeave={() => go({ screen: cameFrom })} />;

  const [kicker, title, blurb] = HEADS[screen];

  const navItem = ([id, label, count]: [ScreenId, string, string | number]) => (
    <button
      key={id}
      type="button"
      className="nav-item"
      aria-current={screen === id ? 'page' : undefined}
      onClick={() => setScreen(id)}
    >
      <span>{label}</span>
      {count !== '' && <span className="count">{count}</span>}
    </button>
  );

  return (
    <div className="shell">
      <aside className={smallBrand ? 'sidebar is-brand-small' : 'sidebar'}>
        {/* In the corner of the chrome rather than the page: they belong to the whole site,
            and the menu is the one thing on screen wherever you are. */}
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <BrandToggle small={smallBrand} onToggle={toggleBrand} />
        <BrandLockup
          tagline="PMO Portfolio Tracker"
          onDoubleClick={() => {
            setCameFrom(screen);
            go({ screen: 'about' });
          }}
        />
        <nav className="nav-list">{nav.map(navItem)}</nav>
        <div className="sidebar-foot" style={{ marginTop: 'auto', fontSize: 12, lineHeight: 1.6, color: 'var(--color-chrome-quiet)' }}>
          Week {weekNumber(view.today)} · FY{String(view.today.getFullYear()).slice(2)}
          <br />
          {view.people.length} people · {view.projects.length} projects
          <br />
          Over-allocation flagged above {view.threshold}%
        </div>
      </aside>

      {/* The plan is the one screen worth every pixel the window has: the chart is as wide as
          the project is long, and what it cannot show has to be scrolled for. The rest of the
          site keeps its measure, which is what makes a page of prose readable. */}
      <main className={screen === 'planning' ? 'main main-wide' : 'main'}>
       <div style={{ maxWidth: SCREEN_WIDTH[screen], marginInline: 'auto' }}>
        <header className="page-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{kicker}</div>
            <h1 className="page-title" style={{ margin: '8px 0 0' }}>{title}</h1>
            <p className="page-blurb">{blurb}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 'none', alignItems: 'center' }}>
            {/* Planning works on one project at a time, so the way into that project's own
                details belongs with the rest of the actions rather than buried in the grid. */}
            {screen === 'planning' && selected && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing({ kind: 'project', project: selected })}
              >
                Edit project detail
              </button>
            )}
            {PRINTABLE.has(screen) && (
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                Export as PDF
              </button>
            )}
            {/* Adding a project, and moving the whole portfolio out, are both Data jobs and
                both already have a button there — "Add project" and "Export JSON" open the
                same things this header used to. One button each, where the work is. */}
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
{screen === 'planning' && (
          <Planning view={view} projectId={selected?.id ?? null} onSelectProject={setLastProjectId} />
        )}
        {screen === 'workstreams' && (
          <Workstreams
            view={view}
            onNew={() => setEditing({ kind: 'project', project: null, workstream: true })}
            onEdit={(project) => setEditing({ kind: 'project', project })}
          />
        )}
                {screen === 'alerts' && <Alerts view={view} onOpenProject={openProject} />}
        {screen === 'data' && (
          <DataManager
            view={view}
            onEditProject={(project) => setEditing({ kind: 'project', project })}
            onNewProject={() => setEditing({ kind: 'project', project: null })}
            onNewWorkstream={() => setEditing({ kind: 'project', project: null, workstream: true })}
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
          title={
            editing.project
              ? `Edit ${editing.project.name}`
              : editing.workstream
                ? 'New workstream'
                : 'New project'
          }
          kicker={
            editing.project
              ? editing.project.workstream
                ? 'Workstream'
                : 'Project'
              : editing.workstream
                ? 'Standing work, no dates'
                : 'Add to the portfolio'
          }
          onClose={() => setEditing(null)}
          expandable
        >
          <ProjectForm
            project={editing.project}
            newWorkstream={Boolean(editing.workstream)}
            view={view}
            people={view.people}
            months={editSpan.months}
            monthLabels={editSpan.labels}
            threshold={view.threshold}
            projectTypes={view.projectTypes}
            families={view.families}
            allocations={editing.project ? view.allocationsOf(editing.project.id, editSpan.months) : {}}
            otherLoads={view.loadsExcluding(editing.project?.id ?? '', editSpan.months)}
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
            families={view.families}
            skills={store.portfolio.skills}
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
