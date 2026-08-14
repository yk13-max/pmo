import { useState } from 'react';
import type { ProjectFamily, ProjectTypeDef } from '../types';
import type { PortfolioView } from '../lib/derive';
import { usePortfolio } from '../store/portfolio';
import { DEFAULT_CATEGORY } from '../data/phases';

/** A name turned into an id, and made unique against the ids already taken. */
function idFrom(label: string, taken: Set<string>) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `id-${Date.now()}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

/* Two levels, because delivery work has two: the kind of work, and the way a particular
   project of that kind is run. The kind is what the portfolio is filtered and coloured by;
   the way it is run is what carries the phases. */
export function ProjectTypeEditor({ view }: { view: PortfolioView }) {
  const { saveProjectType, removeProjectType, saveFamily, removeFamily } = usePortfolio();
  const [newFamily, setNewFamily] = useState('');
  /* Which types are open. Each one is a stack of tables of phases, so a handful of them run
     to several screens and finding the one you came for means scrolling past the rest. They
     start shut: the line that is always on show — the name, how many projects, which
     categories — is enough to pick from, and the phases are a click away. */
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const usedBy = (typeId: string) => view.projects.filter((p) => p.type === typeId).length;

  const addFamily = () => {
    const label = newFamily.trim();
    if (!label) return;
    const taken = new Set([...view.families.map((f) => f.id), ...view.projectTypes.map((t) => t.id)]);
    const id = idFrom(label, taken);
    saveFamily({ id, label, fullName: label });
    // A type just added is a type about to be set up, so it opens on the way in.
    setOpen((o) => ({ ...o, [id]: true }));
    setNewFamily('');
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 4px' }}>Project types</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-6)' }}>
        A type is the kind of work — CDMO, Client Solutions — and under each one sit the ways that kind is run. Every
        category carries its own ordered phases and the milestone that closes each one, so two projects of the same
        type can follow different routes. Projects, people and the portfolio chart are grouped by the type; the phases
        come from the category. Nothing in use can be removed.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
        <input
          className="input"
          style={{ width: 240 }}
          value={newFamily}
          placeholder="New project type"
          aria-label="New project type"
          onChange={(e) => setNewFamily(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFamily();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={!newFamily.trim()} onClick={addFamily}>
          Add type
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {view.families.map((family) => (
          <FamilyCard
            key={family.id}
            family={family}
            categories={view.categoriesOf(family.id)}
            allIds={new Set([...view.families.map((f) => f.id), ...view.projectTypes.map((t) => t.id)])}
            usedBy={usedBy}
            open={open[family.id] ?? false}
            onToggle={() => setOpen((o) => ({ ...o, [family.id]: !(o[family.id] ?? false) }))}
            canRemove={
              view.families.length > 1 && view.categoriesOf(family.id).every((c) => usedBy(c.id) === 0)
            }
            onSaveFamily={saveFamily}
            onRemoveFamily={() => removeFamily(family.id)}
            onSaveCategory={saveProjectType}
            onRemoveCategory={removeProjectType}
          />
        ))}
      </div>
    </div>
  );
}

function FamilyCard({
  family,
  categories,
  allIds,
  usedBy,
  canRemove,
  open,
  onToggle,
  onSaveFamily,
  onRemoveFamily,
  onSaveCategory,
  onRemoveCategory,
}: {
  family: ProjectFamily;
  categories: ProjectTypeDef[];
  allIds: Set<string>;
  usedBy: (typeId: string) => number;
  canRemove: boolean;
  open: boolean;
  onToggle: () => void;
  onSaveFamily: (family: ProjectFamily) => void;
  onRemoveFamily: () => void;
  onSaveCategory: (def: ProjectTypeDef) => void;
  onRemoveCategory: (id: string) => void;
}) {
  const [newCategory, setNewCategory] = useState('');
  const projects = categories.reduce((n, c) => n + usedBy(c.id), 0);

  const addCategory = () => {
    const label = newCategory.trim();
    if (!label) return;
    /* A new way of running the work starts from the way it is run now, because that is
       almost always what is being varied — a phase dropped, one added, two renamed. */
    const from = categories[0];
    onSaveCategory({
      id: idFrom(`${family.id}-${label}`, allIds),
      label,
      fullName: `${family.label} · ${label}`,
      family: family.id,
      phases: from ? [...from.phases] : ['Phase 1'],
      milestones: from ? [...from.milestones] : ['Phase 1 complete'],
    });
    setNewCategory('');
    // Adding one is a reason to be looking at them.
    if (!open) onToggle();
  };

  const body = `type-${family.id}`;

  return (
    <div style={{ borderTop: '2px solid var(--color-text)', paddingTop: 'var(--space-3)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: open ? 'var(--space-4)' : 0,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
          aria-expanded={open}
          aria-controls={body}
          title={open ? `Collapse ${family.label}` : `Show the categories and phases of ${family.label}`}
          onClick={onToggle}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}>
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          className="input"
          style={{ width: 220, fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          value={family.label}
          aria-label={`Name of ${family.label}`}
          onChange={(e) => onSaveFamily({ ...family, label: e.target.value })}
        />
        {/* The short name does the work everywhere space is tight; this is what the portfolio
            chart says beside the phase scale, where there is room for it. */}
        <input
          className="input"
          style={{ width: 320 }}
          value={family.fullName ?? family.label}
          placeholder="Written out in full"
          aria-label={`Full name of ${family.label}`}
          onChange={(e) => onSaveFamily({ ...family, fullName: e.target.value })}
        />
        {/* Shut, this line is all there is to go on, so it names the categories rather than
            only counting them. Open, they are listed below it in full. */}
        <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {projects} project{projects === 1 ? '' : 's'} · {categories.length}{' '}
          {categories.length === 1 ? 'category' : 'categories'}
          {!open && categories.length > 0 && `: ${categories.map((c) => c.label).join(', ')}`}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginLeft: 'auto', color: canRemove ? 'var(--color-accent-2-700)' : undefined }}
          disabled={!canRemove}
          title={projects ? `${projects} project(s) are of this type` : 'Remove this type and its categories'}
          onClick={onRemoveFamily}
        >
          Remove type
        </button>
      </div>

      <div
        id={body}
        hidden={!open}
        style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 'var(--space-6)', paddingLeft: 'var(--space-4)', borderLeft: '3px solid var(--color-divider)' }}
      >
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            family={family}
            category={category}
            used={usedBy(category.id)}
            canRemove={usedBy(category.id) === 0 && categories.length > 1}
            onSave={onSaveCategory}
            onRemove={() => onRemoveCategory(category.id)}
          />
        ))}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="input"
            style={{ width: 240 }}
            value={newCategory}
            placeholder={`Another way of running ${family.label}`}
            aria-label={`Add a category to ${family.label}`}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" disabled={!newCategory.trim()} onClick={addCategory}>
            Add category
          </button>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-600)', alignSelf: 'center' }}>
            Starts as a copy of {categories[0]?.label ?? DEFAULT_CATEGORY}, to be edited from there.
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({
  family,
  category,
  used,
  canRemove,
  onSave,
  onRemove,
}: {
  family: ProjectFamily;
  category: ProjectTypeDef;
  used: number;
  canRemove: boolean;
  onSave: (def: ProjectTypeDef) => void;
  onRemove: () => void;
}) {
  const [newPhase, setNewPhase] = useState('');

  const update = (patch: Partial<ProjectTypeDef>) => onSave({ ...category, ...patch });

  const setPhase = (i: number, value: string) =>
    update({ phases: category.phases.map((p, j) => (j === i ? value : p)) });
  const setMilestone = (i: number, value: string) =>
    update({ milestones: category.milestones.map((m, j) => (j === i ? value : m)) });

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= category.phases.length) return;
    const phases = [...category.phases];
    const milestones = [...category.milestones];
    [phases[i], phases[j]] = [phases[j], phases[i]];
    [milestones[i], milestones[j]] = [milestones[j], milestones[i]];
    update({ phases, milestones });
  };

  const addPhase = () => {
    const label = newPhase.trim();
    if (!label) return;
    update({ phases: [...category.phases, label], milestones: [...category.milestones, `${label} complete`] });
    setNewPhase('');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span className="eyebrow" style={{ color: 'var(--color-accent-700)' }}>{family.label} ·</span>
        <input
          className="input"
          style={{ width: 200, fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          value={category.label}
          aria-label={`Name of the ${category.label} category of ${family.label}`}
          onChange={(e) => update({ label: e.target.value })}
        />
        <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {used} project{used === 1 ? '' : 's'} · {category.phases.length} phases
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginLeft: 'auto', color: canRemove ? 'var(--color-accent-2-700)' : undefined }}
          disabled={!canRemove}
          title={
            used
              ? `${used} project(s) follow this category`
              : canRemove
                ? 'Remove this category'
                : 'A type needs at least one category'
          }
          onClick={onRemove}
        >
          Remove category
        </button>
      </div>

      <table className="table" style={{ maxWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th>Phase</th>
            <th>Milestone that closes it</th>
            <th style={{ width: 130 }} />
          </tr>
        </thead>
        <tbody>
          {category.phases.map((phase, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--color-neutral-600)' }}>{i + 1}</td>
              <td>
                <input
                  className="input"
                  value={phase}
                  aria-label={`Phase ${i + 1} of ${family.label} ${category.label}`}
                  onChange={(e) => setPhase(i, e.target.value)}
                />
              </td>
              <td>
                <input
                  className="input"
                  value={category.milestones[i] ?? ''}
                  aria-label={`Milestone ${i + 1} of ${family.label} ${category.label}`}
                  onChange={(e) => setMilestone(i, e.target.value)}
                />
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={i === category.phases.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ color: 'var(--color-accent-2-700)' }}
                    disabled={category.phases.length <= 1}
                    onClick={() =>
                      update({
                        phases: category.phases.filter((_, j) => j !== i),
                        milestones: category.milestones.filter((_, j) => j !== i),
                      })
                    }
                    aria-label={`Remove phase ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <input
          className="input"
          style={{ width: 240 }}
          value={newPhase}
          placeholder="Add a phase"
          aria-label={`Add a phase to ${family.label} ${category.label}`}
          onChange={(e) => setNewPhase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addPhase();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={!newPhase.trim()} onClick={addPhase}>
          Add phase
        </button>
      </div>
    </div>
  );
}
