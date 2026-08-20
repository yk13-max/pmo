import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Allocations, Baseline, Invoice, Person, Portfolio, Project, ProjectFamily, ProjectTypeDef, Skill, Task } from '../types';
import { HOURS_PER_FULL_MONTH, WORKING_DAYS_PER_MONTH } from '../types';
import { buildSeedPortfolio } from '../data/seed';
import { DEFAULT_CATEGORY, DEFAULT_PROJECT_TYPES, ROLES } from '../data/phases';
import { planningMonths, toISO } from '../lib/dates';

const STORAGE_KEY = 'pmo-tracker:portfolio:v1';

interface PortfolioStore {
  portfolio: Portfolio;
  /** `projectAllocations` is keyed `${personId}|${month}` and replaces this project's bookings. */
  saveProject: (project: Project, projectAllocations?: Record<string, number>) => void;
  deleteProject: (id: string) => void;
  /** Archiving keeps the data; only the archive screen shows it. */
  setArchived: (id: string, archived: boolean) => void;
  /** Put a project on hold, or take it off hold. See `Project.inactive`. */
  setInactive: (id: string, inactive: boolean) => void;
  /** Read a project against its baseline, taking one if it has none yet. */
  setBaselined: (id: string, on: boolean) => void;
  /** Agree a new plan: take the baseline again from where the project stands now. */
  rebaseline: (id: string) => void;
  setActualsShown: (id: string, on: boolean) => void;
  setActualDate: (id: string, phase: number, date: string) => void;
  setActualStart: (id: string, date: string) => void;
  /** Freeze every task's current dates as the plan's baseline. */
  baselinePlan: (projectId: string, at: Map<string, { startDate: string; endDate: string }>) => void;
  saveInvoice: (invoice: Invoice) => void;
  removeInvoice: (id: string) => void;
  setPlanBaselineShown: (id: string, on: boolean) => void;
  setPlanActualsShown: (id: string, on: boolean) => void;
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
  /** Adds a skill tag, or renames one that is already there. */
  saveSkill: (skill: Skill) => void;
  /** Takes a skill out of the list, and off everybody holding it and every project asking
      for it — a tag nobody can see is not a tag anybody should still be tagged with. */
  removeSkill: (id: string) => void;
  /** Puts a skill on somebody, or takes it off. What the matrix on the Data screen writes. */
  setPersonSkill: (personId: string, skillId: string, held: boolean) => void;
  setThreshold: (pct: number) => void;
  /** The months resourcing plans across. */
  setWindow: (startMonth: string, months: number) => void;
  /** Days off everyone takes in a month — public holidays, shutdowns. */
  setPublicHoliday: (month: string, days: number) => void;
  saveProjectType: (def: ProjectTypeDef) => void;
  removeProjectType: (id: string) => void;
  /** Adds or renames a family. A new one arrives with a category under it. */
  saveFamily: (family: ProjectFamily) => void;
  removeFamily: (id: string) => void;
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

/* Types used to be flat: one list, each with its own phases, and a project pointed straight
   at one of them. They are two levels now — a family, and the categories under it that each
   carry a set of phases.

   A store from before that has no families, so every type it holds becomes a family of its
   own, with the phases it already had kept as a category called Full. The category keeps the
   type's id, so every project still points at the thing it always pointed at, and the family
   takes the same id, so a person assigned to CDMO work is assigned to the CDMO family. From
   the outside nothing has moved; there is simply somewhere to add a second way of running
   the same kind of work. */
function typesAndFamilies(p: Portfolio): Pick<Portfolio, 'families' | 'projectTypes'> {
  const types = p.projectTypes?.length ? p.projectTypes : DEFAULT_PROJECT_TYPES;
  if (p.families?.length) {
    const known = new Set(p.families.map((f) => f.id));
    return {
      families: p.families,
      projectTypes: types.map((t) => ({
        ...t,
        // A category whose family has gone joins the first one rather than disappearing.
        family: known.has(t.family) ? t.family : p.families[0].id,
      })),
    };
  }
  return {
    families: types.map((t) => ({
      id: t.id,
      label: t.label,
      fullName: t.fullName ?? DEFAULT_PROJECT_TYPES.find((d) => d.id === t.id)?.fullName ?? t.label,
    })),
    projectTypes: types.map((t) => ({
      ...t,
      label: DEFAULT_CATEGORY,
      fullName: DEFAULT_PROJECT_TYPES.find((d) => d.id === t.id)?.fullName ?? `The full ${t.label} route`,
      family: t.id,
    })),
  };
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
    /* Stores written before invoices were listed one by one simply have none. Those that do
       have them wrote the amounts in thousands, the way the rest of a project's money is
       held; they are whole currency units now, so an old store is multiplied up once on the
       way in and marked, exactly as the switch from percentages to hours was handled. */
    invoices: (p.invoices ?? []).map((i) =>
      p.invoiceUnit === 'units' ? i : { ...i, amount: Math.round((i.amount ?? 0) * 1000) },
    ),
    invoiceUnit: 'units',
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
        /* Owners were free text before the plan could book anyone. A name that matches
           somebody on the team is taken to mean them, which is what it always meant; one
           that matches nobody is left as written and simply books no time. */
        ownerId:
          t.ownerId ??
          p.people.find((person) => person.name.toLowerCase() === (t.owner ?? '').trim().toLowerCase())?.id,
        // A task with no share stated takes the whole of its owner's day.
        weight: t.weight ?? 100,
      };
    }),
    roles: [...roles, ...new Set(fromPeople)],
    // Stores written before skills existed simply have none, and nothing asks for any.
    skills: p.skills ?? [],
    threshold: p.threshold ?? 85,
    window: p.window ?? { startMonth: planningMonths(new Date())[0], months: 6 },
    ...typesAndFamilies(p),
    publicHolidays: p.publicHolidays ?? {},
    fxToBase: { ...{ GBP: 1, USD: 0.79, EUR: 0.85 }, ...(p.fxToBase ?? {}) },
    projects: p.projects.map((project) => ({
      ...project,
      priority: project.priority ?? 3,
      plansResource: project.plansResource ?? false,
      phaseDates: project.phaseDates ?? [],
      invoiceDates: project.invoiceDates ?? [],
      currency: project.currency ?? 'GBP',
      // The same for what the work asks for: a tag that has gone is no longer asked for.
      skills: (project.skills ?? []).filter((id) => (p.skills ?? []).some((s) => s.id === id)),
      /* Everything written before workstreams existed is a project, which is what the
         absent flag means. A workstream keeps its dates blank rather than nought: blank is
         "there is no such date", and the screens that would have shown one say so. */
      workstream: project.workstream ?? false,
      /* Workstreams written before they had a type of their own keep reading as what they
         read as: the family they were filed under. Better than an empty field where a word
         used to be. */
      workstreamType: project.workstream
        ? project.workstreamType ??
          (p.families ?? []).find(
            (f) => f.id === (p.projectTypes ?? []).find((t) => t.id === project.type)?.family,
          )?.label ??
          ''
        : project.workstreamType,
      // Projects that predate planning keep their own dates until they are opted in.
      usesPlan: project.usesPlan ?? false,
      mirrorPhases: project.mirrorPhases ?? false,
      /* The review narrative. A store written before it existed has none, and an empty list
         of risks is the honest starting point — it means nobody has written any down, which
         is what every project began as. Each risk is given an id on the way in so a store
         hand-edited or imported from a sheet still has rows React can tell apart. */
      risks: (project.risks ?? []).map((r, i) => ({ ...r, id: r.id || `risk-${project.id}-${i}` })),
    })),
    people: p.people.map((person) => ({
      ...person,
      capacity: person.capacity ?? 100,
      types: person.types ?? ((person as Person & { discipline?: string }).discipline ? [(person as Person & { discipline?: string }).discipline as string] : []),
      workingDays:
        person.workingDays ?? Math.round(((person.capacity ?? 100) / 100) * WORKING_DAYS_PER_MONTH),
      // Stores written before non-project work existed kept none of it, so they start at zero.
      overheadPct: person.overheadPct ?? 0,
      /* A skill that has been deleted since is dropped here rather than left pointing at
         nothing, so no screen has to guard against a tag that is not in the list. */
      skills: (person.skills ?? []).filter((id) => (p.skills ?? []).some((s) => s.id === id)),
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

/** The project's plan as it stands, frozen. Dates and money only: what a baseline is for is
    answering "has this moved", and nothing else on a project moves in a way worth measuring. */
function snapshot(p: Project): Baseline {
  return {
    takenAt: toISO(new Date()),
    startDate: p.startDate,
    endDate: p.endDate,
    phaseDates: [...(p.phaseDates ?? [])],
    budget: p.budget,
    value: p.value,
  };
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

  /* On hold rather than finished with. Nothing is moved and nothing is dropped — the
     bookings are exactly where they were when it stopped, ready for when it starts. */
  const setInactive = useCallback((id: string, inactive: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, inactive } : p)),
    }));
  }, []);

  /* Baselining. Engaging it takes the snapshot if there is not one already — a baseline
     nobody took is no use, and taking it at the moment somebody asks to be measured against
     it is what they mean. Switching it off keeps the snapshot: the comparison is hidden, not
     thrown away, so turning it back on does not lose the history. */
  const setBaselined = useCallback((id: string, on: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === id ? { ...p, showBaseline: on, baseline: on ? p.baseline ?? snapshot(p) : p.baseline } : p,
      ),
    }));
  }, []);

  /** Take the baseline again, from where the project stands now. Deliberate: re-baselining
      is agreeing a new plan, which is why nothing does it automatically. */
  const rebaseline = useCallback((id: string) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, baseline: snapshot(p) } : p)),
    }));
  }, []);

  const setActualsShown = useCallback((id: string, on: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, showActuals: on } : p)),
    }));
  }, []);

  /** When a phase actually completed. An empty date clears it back to unfinished. */
  const setActualDate = useCallback((id: string, phase: number, date: string) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id !== id) return p;
        const dates = [...(p.actualDates ?? [])];
        while (dates.length <= phase) dates.push('');
        dates[phase] = date;
        return { ...p, actualDates: dates };
      }),
    }));
  }, []);

  /* Baselining the plan. Unlike the project's own baseline this one lives on the tasks —
     every task keeps the dates it was given and the days it was given them for, so a task
     that grew can be told from one that simply slid when the thing before it did.

     Engaging it takes the snapshot if the plan has never been baselined; taking it again is
     the Re-baseline button, and is agreeing a new plan. `at` is what the schedule currently
     says, worked out by the caller — the store has no scheduler. */
  const baselinePlan = useCallback((projectId: string, at: Map<string, { startDate: string; endDate: string }>) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? { ...p, planBaselineAt: toISO(new Date()) } : p)),
      tasks: prev.tasks.map((t) => {
        if (t.projectId !== projectId) return t;
        const when = at.get(t.id);
        return when ? { ...t, baseStart: when.startDate, baseFinish: when.endDate, baseDays: t.days } : t;
      }),
    }));
  }, []);

  const saveInvoice = useCallback((invoice: Invoice) => {
    setPortfolio((prev) => ({
      ...prev,
      invoices: prev.invoices.some((i) => i.id === invoice.id)
        ? prev.invoices.map((i) => (i.id === invoice.id ? invoice : i))
        : [...prev.invoices, invoice],
    }));
  }, []);

  const removeInvoice = useCallback((id: string) => {
    setPortfolio((prev) => ({ ...prev, invoices: prev.invoices.filter((i) => i.id !== id) }));
  }, []);

  const setPlanBaselineShown = useCallback((id: string, on: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, showPlanBaseline: on } : p)),
    }));
  }, []);

  const setPlanActualsShown = useCallback((id: string, on: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, showPlanActuals: on } : p)),
    }));
  }, []);

  const setActualStart = useCallback((id: string, date: string) => {
    setPortfolio((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, actualStart: date } : p)),
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

  /* Skills are added by name, and a name that is already on the list is that skill rather
     than a second one spelled the same — two tags reading "Sterile fill" would split the
     cover for it in half and neither half would be the truth. */
  const saveSkill = useCallback((skill: Skill) => {
    const label = skill.label.trim();
    if (!label) return;
    setPortfolio((prev) => {
      const exists = prev.skills.some((s) => s.id === skill.id);
      const clash = prev.skills.some((s) => s.id !== skill.id && s.label.toLowerCase() === label.toLowerCase());
      if (clash) return prev;
      const next = { ...skill, label };
      return {
        ...prev,
        skills: exists ? prev.skills.map((s) => (s.id === skill.id ? next : s)) : [...prev.skills, next],
      };
    });
  }, []);

  const removeSkill = useCallback((id: string) => {
    setPortfolio((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.id !== id),
      people: prev.people.map((p) => (p.skills?.includes(id) ? { ...p, skills: p.skills.filter((x) => x !== id) } : p)),
      projects: prev.projects.map((p) =>
        p.skills?.includes(id) ? { ...p, skills: p.skills.filter((x) => x !== id) } : p,
      ),
    }));
  }, []);

  const setPersonSkill = useCallback((personId: string, skillId: string, held: boolean) => {
    setPortfolio((prev) => ({
      ...prev,
      people: prev.people.map((p) => {
        if (p.id !== personId) return p;
        const skills = p.skills ?? [];
        if (held === skills.includes(skillId)) return p;
        return { ...p, skills: held ? [...skills, skillId] : skills.filter((x) => x !== skillId) };
      }),
    }));
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

  /** Refuses while projects still use the category, so none is left without phases. Nor will
      it take the last one out of a family, which would leave the family unusable. */
  const removeProjectType = useCallback((id: string) => {
    setPortfolio((prev) => {
      const going = prev.projectTypes.find((t) => t.id === id);
      const siblings = prev.projectTypes.filter((t) => t.family === going?.family).length;
      if (!going || siblings <= 1 || prev.projects.some((p) => p.type === id)) return prev;
      return { ...prev, projectTypes: prev.projectTypes.filter((t) => t.id !== id) };
    });
  }, []);

  const saveFamily = useCallback((family: ProjectFamily) => {
    setPortfolio((prev) => {
      const exists = prev.families.some((f) => f.id === family.id);
      return {
        ...prev,
        families: exists ? prev.families.map((f) => (f.id === family.id ? family : f)) : [...prev.families, family],
        /* A new family arrives with one way of running it, so it can be picked the moment it
           exists rather than being a name with nothing under it. */
        projectTypes: exists
          ? prev.projectTypes
          : [
              ...prev.projectTypes,
              {
                id: `${family.id}-full`,
                label: DEFAULT_CATEGORY,
                fullName: `The full ${family.label} route`,
                family: family.id,
                phases: ['Phase 1'],
                milestones: ['Phase 1 complete'],
              },
            ],
      };
    });
  }, []);

  /** Refuses while any project is on one of its categories, and never takes the last family.
      Its categories go with it, which is why nothing may still be using them. */
  const removeFamily = useCallback((id: string) => {
    setPortfolio((prev) => {
      const mine = new Set(prev.projectTypes.filter((t) => t.family === id).map((t) => t.id));
      if (prev.families.length <= 1 || prev.projects.some((p) => mine.has(p.type))) return prev;
      return {
        ...prev,
        families: prev.families.filter((f) => f.id !== id),
        projectTypes: prev.projectTypes.filter((t) => t.family !== id),
        people: prev.people.map((p) => ({ ...p, types: p.types.filter((t) => t !== id) })),
      };
    });
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
      setInactive,
      setBaselined,
      rebaseline,
      setActualsShown,
      setActualDate,
      setActualStart,
      baselinePlan,
      saveInvoice,
      removeInvoice,
      setPlanBaselineShown,
      setPlanActualsShown,
      savePerson,
      saveTask,
      deleteTask,
      setPersonArchived,
      setAllocation,
      setLeave,
      addRole,
      removeRole,
      saveSkill,
      removeSkill,
      setPersonSkill,
      setThreshold,
      setWindow,
      setPublicHoliday,
      saveProjectType,
      removeProjectType,
      saveFamily,
      removeFamily,
      replaceAll,
      resetToSeed,
      clearAll,
    }),
    [
      portfolio,
      saveProject,
      deleteProject,
      setArchived,
      setInactive,
      setBaselined,
      rebaseline,
      setActualsShown,
      setActualDate,
      setActualStart,
      baselinePlan,
      saveInvoice,
      removeInvoice,
      setPlanBaselineShown,
      setPlanActualsShown,
      savePerson,
      saveTask,
      deleteTask,
      setPersonArchived,
      setAllocation,
      setLeave,
      addRole,
      removeRole,
      saveSkill,
      removeSkill,
      setPersonSkill,
      setThreshold,
      setWindow,
      setPublicHoliday,
      saveProjectType,
      removeProjectType,
      saveFamily,
      removeFamily,
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
