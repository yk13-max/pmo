import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Allocations, Person, Portfolio, Project } from '../types';
import { buildSeedPortfolio } from '../data/seed';

const STORAGE_KEY = 'pmo-tracker:portfolio:v1';

interface PortfolioStore {
  portfolio: Portfolio;
  /** `projectAllocations` is keyed `${personId}|${month}` and replaces this project's bookings. */
  saveProject: (project: Project, projectAllocations?: Record<string, number>) => void;
  deleteProject: (id: string) => void;
  savePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  setAllocation: (projectId: string, personId: string, month: string, pct: number) => void;
  setThreshold: (pct: number) => void;
  replaceAll: (portfolio: Portfolio) => void;
  resetToSeed: () => void;
}

const Ctx = createContext<PortfolioStore | null>(null);

function isPortfolio(value: unknown): value is Portfolio {
  const p = value as Portfolio | null;
  return Boolean(p && Array.isArray(p.projects) && Array.isArray(p.people) && p.allocations);
}

function load(): Portfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isPortfolio(parsed)) return parsed;
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

  const setThreshold = useCallback((pct: number) => {
    setPortfolio((prev) => ({ ...prev, threshold: pct }));
  }, []);

  const replaceAll = useCallback((next: Portfolio) => setPortfolio(next), []);
  const resetToSeed = useCallback(() => setPortfolio(buildSeedPortfolio()), []);

  const value = useMemo(
    () => ({
      portfolio,
      saveProject,
      deleteProject,
      savePerson,
      deletePerson,
      setAllocation,
      setThreshold,
      replaceAll,
      resetToSeed,
    }),
    [portfolio, saveProject, deleteProject, savePerson, deletePerson, setAllocation, setThreshold, replaceAll, resetToSeed],
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
