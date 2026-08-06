import { useState } from 'react';
import type { Person } from '../types';
import { ROLES } from '../data/phases';

function emptyPerson(): Person {
  return { id: `person-${crypto.randomUUID().slice(0, 8)}`, name: '', role: ROLES[0], discipline: '', capacity: 100 };
}

export function PersonForm({
  person,
  onSave,
  onCancel,
  onDelete,
}: {
  person: Person | null;
  onSave: (person: Person) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Person>(() => person ?? emptyPerson());
  const [capacity, setCapacity] = useState(String(draft.capacity));
  const [touched, setTouched] = useState(false);

  const nameError = draft.name.trim() ? '' : 'Give this person a name.';

  const submit = () => {
    setTouched(true);
    if (nameError) return;
    const parsed = Math.round(Number(capacity));
    onSave({
      ...draft,
      name: draft.name.trim(),
      capacity: Number.isFinite(parsed) && parsed > 0 ? parsed : 100,
    });
  };

  return (
    <div>
      <div className="form-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="field">
          <label htmlFor="pn-name">Name</label>
          <input
            id="pn-name"
            className="input"
            value={draft.name}
            aria-invalid={touched && nameError ? true : undefined}
            placeholder="Saranan"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {touched && nameError && <div className="field-error">{nameError}</div>}
        </div>
        <div className="field">
          <label htmlFor="pn-role">Role</label>
          <select id="pn-role" className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pn-disc">Works across</label>
          <select id="pn-disc" className="input" value={draft.discipline} onChange={(e) => setDraft({ ...draft, discipline: e.target.value })}>
            <option value="">Both delivery types</option>
            <option value="CS">Client Solutions</option>
            <option value="CDMO">CDMO</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pn-cap">Available week (%)</label>
          <input id="pn-cap" className="input" type="number" min={0} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <div className="field-hint">100% is a full week on project work.</div>
        </div>
      </div>

      <div className="drawer-actions">
        {person && onDelete && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginRight: 'auto', color: 'var(--color-accent-2-700)' }}
            onClick={() => onDelete(person.id)}
          >
            Remove person
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={submit}>
          {person ? 'Save changes' : 'Add person'}
        </button>
      </div>
    </div>
  );
}
