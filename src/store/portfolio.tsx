import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Allocations, Person, Portfolio, Project, ProjectTypeDef, Task } from '../types';
import { HOURS_PER_FULL_MONTH, WORKING_DAYS_PER_MONTH } from '../types';
import { buildSeedPortfolio } from '../data/seed';
import { DEFAULT_PROJECT_TYPES, ROLES } from '../data/phases';
import { planningMonths } from '../lib/dates';

const STORAGE_KEY = 'pmo-tracker:portfolio:v1';

interface PortfolioStore {
  portfolio: Portfolio;
  /** `projectAllocations` is keyed `${personId}|${month}` and replaces this project's bookings. */
  saveProject: (project: Project, projectAllocations?: Record<string, number>) => void;
  deleteProject: (id: string) => void;
  /** Archiving keeps the data; only the archive screen shows it. */
  setArchived: (id: string, archived: boolean) => void;
  savePerson: (person: Person) => void;
  /** Adds or replaces one task in a project's plan. */
  saveTask: (task: Task) => void;
  /** Removes a task, and any link that pointed at it, so no plan is left dangling. */
  deleteTask: (id: string) => void;
  /** People are archived, never deleted: their bookings and days off are the record of
      what the team actually did. */
  setPersonArchived: (id: string, archived: boolean) => void;
  /** Hours booked for one person on one project in one month. */
  setAllocation: (projectId: string, personId: string, month: string, hours: number) => void;
  /** Days of annual leave for one person in one month. */
  setLeave: (personId: string, month: string, days: number) => void;
  addRole: (role: string) => void;
  removeRole: (role: string) => void;
  setThreshold: (pct: number) => void;
  /** The months resourcing plans across. */
  setWindow: (startMonth: string, months: number) => void;
  /** Days off everyone takes in a month — public holidays, shutdowns. */
  setPublicHoliday: (month: string, days: number) => void;
  saveProjectType: (def: ProjectTypeDef) => void;
  removeProjectType: (id: string) => void;
  replaceAll: (portfolio: Portfolio) => void;
  resetToSeed: () => void;
  /** Empties the portfolio, keeping only the scaffolding needed to start entering work. */
  clearAll: () => void;
}

const Ctx = createContext<PortfolioStore | null>(null);

function isPortfolio(value: unknown): value is Portfolio {
  const p = value as Portfolio | null;
  return Boolean(p && Array.isArray(p.projects) && Array.isArray(p.people) && p.allocations);
}

/** Fills in fields added after a portfolio was first saved, so older stores still load. */
export function normalise(p: Portfolio): Portfolio {
  const roles = p.roles?.length ? p.roles : [...ROLES];
  const fromPeople = p.people.map((person) => person.role).filter((r) => r && !roles.includes(r));
  /* Bookings used to be a share of a full-time month; they are hours now. A store without
     the marker still holds percentages, so convert it once on the way in. */
  const allocations =
    p.allocationUnit === 'hours'
      ? p.allocations
      : Object.fromEntries(
          Object.entries(p.allocations ?? {}).map(([key, pct]) => [
            key,
            Math.round((pct / 100) * HOURS_PER_FULL_MONTH * 2) / 2,
          ]),
        );
  return {
    ...p,
    allocations,
    allocationUnit: 'hours',
    leave: p.leave ?? {},
    // Stores written before planning existed simply have no plans.
    tasks: (p.tasks ?? []).map((t) => {
      // Plans written before constraints existed carried a plain start, which is exactly
      // what "start no earlier than" means.
      const old = (t as Task & { start?: string }).start;
      return {
        ...t,
        deps: t.deps ?? [],
        done: t.done ?? 0,
        constraint: t.constraint ?? 'SNET',
        constraintDate: t.constraintDate ?? old ?? '',
      };
    }),
    roles: [...roles, ...new Set(fromPeople)],
    threshold: p.threshold ?? 85,
    window: p.window ?? { startMonth: planningMonths(new Date())[0], months: 6 },
    projectTypes: (p.projectTypes?.length ? p.projectTypes : DEFAULT_PROJECT_TYPES).map((t) => ({
      ...t,
      /* Stores written before types had a long form fall back to the shipped one for the
         types we know, and to the short label for anything the user added themselves. */
      fullName: t.fullName ?? DEFAULT_PROJECT_TYPES.find((d) => d.id === t.id)?.fullName ?? t.label,
    })),
    publicHolidays: p.publicHolidays ?? {},
    fxToBase: { ...{ GBP: 1, USD: 0.79, EUR: 0.85 }, ...(p.fxToBase ?? {}) },
    projects: p.projects.map((project) => ({
      ...project,
      priority: project.priority ?? 3,
      phaseDates: project.phaseDates ?? [],
      invoiceDates: project.invoiceDates ?? [],
      currency: project.currency ?? 'GBP',
      // Projects that predate planning keep their own dates until they are opted in.
      usesPlan: project.usesPlan ?? false,
      mirrorPhases: project.mirrorPhases ?? false,
    })),
    people: p.people.map((person) => ({
      ...person,
      capacity: person.capacity ?? 100,
      types: person.types ?? ((person as Person & { discipline?: string }).discipline ? [(person as Person & { discipline?: string }).discipline as string] : []),
      workingDays:
        person.workingDays ?? Math.round(((person.capacity ?? 100) / 100) * WORKING_DAYS_PER_MONTH),
      // Stores written before non-project work existed kept none of it, so they start at zero.
      overheadPct: person.overheadPct ?? 0,
      archived: person.archived ?? false,
    })),
  };
}

function load(): Portfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isPortfolio(parsed)) return normalise(parsed);
    }
  } catch {
    // A corrupt or unreadable store falls back to the sample portfolio.
  }
  return buildSeedPortfolio();
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  }, [portfolio]);

  const saveProject = useCallback((project: Project, projectAllocations?: Record<string, number>) => {
    setPortfolio((prev) => {
      const exists = prev.projects.some((p) => p.id === project.id);
      let allocations = prev.allocations;
      if (projectAllocations) {
        /* The edit form only shows people who are still here, so it can only speak for them.
           An archived person's bookings on this project are left exactly as they were —
           otherwise saving an unrelated edit would quietly erase their history. */
        const gone = new Set(prev.people.filter((p) => p.archived).map((p) => p.id));
        allocations = dropKeys(prev.allocations, (key) => {
          const [projectId, personId] = key.split('|');
          return projectId === project.id && !gone.has(personId);
        });
        Object.entries(projectAllocations).forEach(([key, pct]) => {
          if (pct > 0) allocations[`${project.id}|${key}`] = pct;
        });
      }
      return {
        ...prev,
        allocations,
        projects: exists
          ? prev.projects.map((p) => (p.id === project.id ? project : p))
          : [...prev.projects, project],
      };
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      allocations: dropKeys(prev.allocations, (key) => key.split('|')[0] === id),
    }));
  }, []);

  const setArchived = useCallback((id: string, archived: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, archived } : p)),
    }));
  }, []);

  const savePerson = useCallback((person: Person) => {
    setPortfolio((prev) => {
      const exists = prev.people.some((p) => p.id === person.id);
      return {
        ...prev,
        people: exists ? prev.people.map((p) => (p.id === person.id ? person : p)) : [...prev.people, person],
      };
    });
  }, []);

  const saveTask = useCallback((task: Task) => {
    setPortfolio((prev) => {
      const exists = prev.tasks.some((t) => t.id === task.id);
      return {
        ...prev,
        tasks: exists ? prev.tasks.map((t) => (t.id === task.id ? task : t)) : [...prev.tasks, task],
      };
    });
  }, []);

  /* Deleting a task also cuts every link that named it. Leaving those behind would give
     the plan predecessors that cannot be found, which is worse than losing the link. */
  const deleteTask = useCallback((id: string) => {
    setPortfolio((prev) => ({
      ...prev,
      tasks: prev.tasks
        .filter((t) => t.id !== id)
        .map((t) => (t.deps.some((d) => d.id === id) ? { ...t, deps: t.deps.filter((d) => d.id !== id) } : t)),
    }));
  }, []);

  const setPersonArchived = useCallback((id: string, archived: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === id ? { ...p, archived } : p)),
    }));
  }, []);

  const setAllocation = useCallback((projectId: string, personId: string, month: string, hours: number) => {
    setPortfolio((prev) => {
      const next = { ...prev.allocations };
      const key = `${projectId}|${personId}|${month}`;
      if (hours > 0) next[key] = hours;
      else delete next[key];
      return { ...prev, allocations: next };
    });
  }, []);

  const setLeave = useCallback((personId: string, month: string, days: number) => {
    setPortfolio((prev) => {
      const next = { ...prev.leave };
      const key = `${personId}|${month}`;
      if (days > 0) next[key] = days;
      else delete next[key];
      return { ...prev, leave: next };
    });
  }, []);

  const addRole = useCallback((role: string) => {
    const clean = role.trim();
    if (!clean) return;
    setPortfolio((prev) =>
      prev.roles.some((r) => r.toLowerCase() === clean.toLowerCase())
        ? prev
        : { ...prev, roles: [...prev.roles, clean] },
    );
  }, []);

  /** Refuses to remove a title someone still holds, so nobody is left role-less. */
  const removeRole = useCallback((role: string) => {
    setPortfolio((prev) =>
      prev.people.some((p) => p.role === role)
        ? prev
        : { ...prev, roles: prev.roles.filter((r) => r !== role) },
    );
  }, []);

  const setThreshold = useCallback((pct: number) => {
    setPortfolio((prev) => ({ ...prev, threshold: pct }));
  }, []);

  const saveProjectType = useCallback((def: ProjectTypeDef) => {
    setPortfolio((prev) => {
      const exists = prev.projectTypes.some((t) => t.id === def.id);
      return {
        ...prev,
        projectTypes: exists ? prev.projectTypes.map((t) => (t.id === def.id ? def : t)) : [...prev.projectTypes, def],
      };
    });
  }, []);

  /** Refuses while projects still use the type, so none is left without phases. */
  const removeProjectType = useCallback((id: string) => {
    setPortfolio((prev) =>
      prev.projects.some((p) => p.type === id) || prev.projectTypes.length <= 1
        ? prev
        : {
            ...prev,
            projectTypes: prev.projectTypes.filter((t) => t.id !== id),
            people: prev.people.map((p) => ({ ...p, types: p.types.filter((t) => t !== id) })),
          },
    );
  }, []);

  const setPublicHoliday = useCallback((month: string, days: number) => {
    setPortfolio((prev) => {
      const next = { ...prev.publicHolidays };
      if (days > 0) next[month] = days;
      else delete next[month];
      return { ...prev, publicHolidays: next };
    });
  }, []);

  const setWindow = useCallback((startMonth: string, months: number) => {
    setPortfolio((prev) => ({ ...prev, window: { startMonth, months } }));
  }, []);

  const replaceAll = useCallback((next: Portfolio) => setPortfolio(normalise(next)), []);
  const resetToSeed = useCallback(() => setPortfolio(buildSeedPortfolio()), []);

  /* Job titles, delivery types and the planning window are how the tracker is set up rather
     than work anybody entered, so clearing the data leaves them standing — otherwise the
     first thing after a clear-out would be rebuilding the scaffolding by hand. */
  const clearAll = useCallback(() => {
    setPortfolio((prev) => ({
      ...prev,
      projects: [],
      people: [],
      tasks: [],
      allocations: {},
      leave: {},
      publicHolidays: {},
    }));
  }, []);

  const value = useMemo(
    () => ({
      portfolio,
      saveProject,
      deleteProject,
      setArchived,
      savePerson,
      saveTask,
      deleteTask,
      setPersonArchived,
      setAllocation,
      setLeave,
      addRole,
      removeRole,
      setThreshold,
      setWindow,
      setPublicHoliday,
      saveProjectType,
      removeProjectType,
      replaceAll,
      resetToSeed,
      clearAll,
    }),
    [
      portfolio,
      saveProject,
      deleteProject,
      setArchived,
      savePerson,
      saveTask,
      deleteTask,
      setPersonArchived,
      setAllocation,
      setLeave,
      addRole,
      removeRole,
      setThreshold,
      setWindow,
      setPublicHoliday,
      saveProjectType,
      removeProjectType,
      replaceAll,
      resetToSeed,
      clearAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function dropKeys(allocations: Allocations, matches: (key: string) => boolean): Allocations {
  const next: Allocations = {};
  Object.entries(allocations).forEach(([key, pct]) => {
    if (!matches(key)) next[key] = pct;
  });
  return next;
}

export function usePortfolio(): PortfolioStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('usePortfolio must be used inside a PortfolioProvider');
  return store;
}
