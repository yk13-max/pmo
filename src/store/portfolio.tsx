import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Allocations, Person, Portfolio, Project, ProjectTypeDef } from '../types';
import { WORKING_DAYS_PER_MONTH } from '../types';
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
  deletePerson: (id: string) => void;
  setAllocation: (projectId: string, personId: string, month: string, pct: number) => void;
  /** Days of annual leave for one person in one month. */
  setLeave: (personId: string, month: string, days: number) => void;
  addRole: (role: string) => void;
  removeRole: (role: string) => void;
  setThreshold: (pct: number) => void;
  /** The months resourcing plans across. */
  setWindow: (startMonth: string, months: number) => void;
  saveProjectType: (def: ProjectTypeDef) => void;
  removeProjectType: (id: string) => void;
  replaceAll: (portfolio: Portfolio) => void;
  resetToSeed: () => void;
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
  return {
    ...p,
    leave: p.leave ?? {},
    roles: [...roles, ...new Set(fromPeople)],
    threshold: p.threshold ?? 85,
    window: p.window ?? { startMonth: planningMonths(new Date())[0], months: 6 },
    projectTypes: p.projectTypes?.length ? p.projectTypes : DEFAULT_PROJECT_TYPES.map((t) => ({ ...t })),
    projects: p.projects.map((project) => ({
      ...project,
      priority: project.priority ?? 3,
      phaseDates: project.phaseDates ?? [],
      invoiceDates: project.invoiceDates ?? [],
    })),
    people: p.people.map((person) => ({
      ...person,
      capacity: person.capacity ?? 100,
      types: person.types ?? ((person as Person & { discipline?: string }).discipline ? [(person as Person & { discipline?: string }).discipline as string] : []),
      workingDays:
        person.workingDays ?? Math.round(((person.capacity ?? 100) / 100) * WORKING_DAYS_PER_MONTH),
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
        allocations = dropKeys(prev.allocations, (key) => key.split('|')[0] === project.id);
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

  const deletePerson = useCallback((id: string) => {
    setPortfolio((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== id),
      allocations: dropKeys(prev.allocations, (key) => key.split('|')[1] === id),
      leave: dropKeys(prev.leave, (key) => key.split('|')[0] === id),
    }));
  }, []);

  const setAllocation = useCallback((projectId: string, personId: string, month: string, pct: number) => {
    setPortfolio((prev) => {
      const next = { ...prev.allocations };
      const key = `${projectId}|${personId}|${month}`;
      if (pct > 0) next[key] = pct;
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

  const setWindow = useCallback((startMonth: string, months: number) => {
    setPortfolio((prev) => ({ ...prev, window: { startMonth, months } }));
  }, []);

  const replaceAll = useCallback((next: Portfolio) => setPortfolio(normalise(next)), []);
  const resetToSeed = useCallback(() => setPortfolio(buildSeedPortfolio()), []);

  const value = useMemo(
    () => ({
      portfolio,
      saveProject,
      deleteProject,
      setArchived,
      savePerson,
      deletePerson,
      setAllocation,
      setLeave,
      addRole,
      removeRole,
      setThreshold,
      setWindow,
      saveProjectType,
      removeProjectType,
      replaceAll,
      resetToSeed,
    }),
    [
      portfolio,
      saveProject,
      deleteProject,
      setArchived,
      savePerson,
      deletePerson,
      setAllocation,
      setLeave,
      addRole,
      removeRole,
      setThreshold,
      setWindow,
      saveProjectType,
      removeProjectType,
      replaceAll,
      resetToSeed,
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
