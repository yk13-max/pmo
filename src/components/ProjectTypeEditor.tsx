import { useState } from 'react';
import type { ProjectTypeDef } from '../types';
import type { PortfolioView } from '../lib/derive';
import { usePortfolio } from '../store/portfolio';

/** Add, rename and re-phase the delivery types projects are built from. */
export function ProjectTypeEditor({ view }: { view: PortfolioView }) {
  const { saveProjectType, removeProjectType } = usePortfolio();
  const [newType, setNewType] = useState('');

  const inUse = (id: string) => view.projects.filter((p) => p.type === id).length;

  const addType = () => {
    const label = newType.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `type-${Date.now()}`;
    if (view.projectTypes.some((t) => t.id === id)) return;
    saveProjectType({ id, label, fullName: label, phases: ['Phase 1'], milestones: ['Phase 1 complete'] });
    setNewType('');
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 4px' }}>Project types</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-6)' }}>
        Each type carries its own ordered phases and the milestone that closes each one. A type in use cannot be removed,
        and removing a phase that projects currently sit in will move them back a step.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        <input
          className="input"
          style={{ width: 240 }}
          value={newType}
          placeholder="New project type"
          aria-label="New project type"
          onChange={(e) => setNewType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addType();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={!newType.trim()} onClick={addType}>
          Add type
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {view.projectTypes.map((type) => (
          <TypeCard
            key={type.id}
            type={type}
            used={inUse(type.id)}
            canRemove={inUse(type.id) === 0 && view.projectTypes.length > 1}
            onSave={saveProjectType}
            onRemove={() => removeProjectType(type.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TypeCard({
  type,
  used,
  canRemove,
  onSave,
  onRemove,
}: {
  type: ProjectTypeDef;
  used: number;
  canRemove: boolean;
  onSave: (def: ProjectTypeDef) => void;
  onRemove: () => void;
}) {
  const [newPhase, setNewPhase] = useState('');

  const update = (patch: Partial<ProjectTypeDef>) => onSave({ ...type, ...patch });

  const setPhase = (i: number, value: string) =>
    update({ phases: type.phases.map((p, j) => (j === i ? value : p)) });
  const setMilestone = (i: number, value: string) =>
    update({ milestones: type.milestones.map((m, j) => (j === i ? value : m)) });

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= type.phases.length) return;
    const phases = [...type.phases];
    const milestones = [...type.milestones];
    [phases[i], phases[j]] = [phases[j], phases[i]];
    [milestones[i], milestones[j]] = [milestones[j], milestones[i]];
    update({ phases, milestones });
  };

  const addPhase = () => {
    const label = newPhase.trim();
    if (!label) return;
    update({ phases: [...type.phases, label], milestones: [...type.milestones, `${label} complete`] });
    setNewPhase('');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <input
          className="input"
          style={{ width: 260, fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          value={type.label}
          aria-label={`Name of ${type.label}`}
          onChange={(e) => update({ label: e.target.value })}
        />
        {/* The short label does the work everywhere space is tight; this is what the
            portfolio chart says beside the phase scale, where there is room for it. */}
        <input
          className="input"
          style={{ width: 320 }}
          value={type.fullName ?? type.label}
          placeholder="Written out in full"
          aria-label={`Full name of ${type.label}`}
          onChange={(e) => update({ fullName: e.target.value })}
        />
        <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {used} project{used === 1 ? '' : 's'} · {type.phases.length} phases
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginLeft: 'auto', color: canRemove ? 'var(--color-accent-2-700)' : undefined }}
          disabled={!canRemove}
          title={used ? `${used} project(s) use this type` : 'Remove this type'}
          onClick={onRemove}
        >
          Remove type
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
          {type.phases.map((phase, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--color-neutral-600)' }}>{i + 1}</td>
              <td>
                <input
                  className="input"
                  value={phase}
                  aria-label={`Phase ${i + 1} of ${type.label}`}
                  onChange={(e) => setPhase(i, e.target.value)}
                />
              </td>
              <td>
                <input
                  className="input"
                  value={type.milestones[i] ?? ''}
                  aria-label={`Milestone ${i + 1} of ${type.label}`}
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
                    disabled={i === type.phases.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ color: 'var(--color-accent-2-700)' }}
                    disabled={type.phases.length <= 1}
                    onClick={() =>
                      update({
                        phases: type.phases.filter((_, j) => j !== i),
                        milestones: type.milestones.filter((_, j) => j !== i),
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
          aria-label={`Add a phase to ${type.label}`}
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
