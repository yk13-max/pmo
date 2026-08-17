import { useState } from 'react';
import type { PortfolioView } from '../lib/derive';
import { usePortfolio } from '../store/portfolio';

/* The skills matrix: the tags themselves, and who holds each one.

   Two halves, because there are two jobs. Naming a skill is rare and considered — it is a
   decision about how the business describes itself, so it gets full-width fields and room
   for a note saying what the tag means. Ticking who holds one is frequent and comparative —
   you are looking down a column asking "who else can do this" — so it is a grid, and a
   tick writes straight through to the person rather than waiting for a Save.

   Removing a skill takes it off everybody holding it and every project asking for it. That
   is the honest behaviour: a tag nobody can see is not a tag anybody should still be tagged
   with. It is asked about first, with the count in the question. */

export function SkillsMatrix({ view }: { view: PortfolioView }) {
  const { portfolio, saveSkill, removeSkill, setPersonSkill } = usePortfolio();
  const [adding, setAdding] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const skills = portfolio.skills;
  const people = view.people;
  const holders = (skillId: string) => people.filter((p) => p.skills?.includes(skillId));
  const wanted = (skillId: string) => view.projects.filter((p) => p.skills?.includes(skillId));

  const add = () => {
    const label = adding.trim();
    if (!label) return;
    if (skills.some((s) => s.label.toLowerCase() === label.toLowerCase())) {
      setNote(`There is already a skill called ${label}.`);
      return;
    }
    saveSkill({ id: `skill-${crypto.randomUUID().slice(0, 8)}`, label });
    setAdding('');
    setNote(null);
  };

  return (
    <>
      <h3 style={{ margin: '0 0 4px' }}>Skills</h3>
      <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
        What people can do, as tags. A job title says what somebody is and fits one person; a skill says what they can
        do, and several people hold the same one. Projects say which skills they need, so the tracker can answer whether
        the work has anybody behind it — that reading is on Resourcing, under Skillset with no cover.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <input
          className="input"
          style={{ width: 260 }}
          value={adding}
          placeholder="Add a skill"
          aria-label="New skill"
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={!adding.trim()} onClick={add}>
          Add
        </button>
        {note && <span style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>{note}</span>}
      </div>

      {skills.length === 0 ? (
        <p className="empty">
          No skills yet. Add the first one above — sterile fill, tech transfer, CE marking, whatever this business
          actually asks people for.
        </p>
      ) : (
        <>
          <table className="table" style={{ maxWidth: 900, marginBottom: 'var(--space-8)' }}>
            <thead>
              <tr>
                <th style={{ width: 240 }}>Skill</th>
                <th>What it means</th>
                <th style={{ width: 100, textAlign: 'right' }}>Held by</th>
                <th style={{ width: 110, textAlign: 'right' }}>Wanted by</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => {
                const held = holders(skill.id).length;
                const asked = wanted(skill.id).length;
                return (
                  <tr key={skill.id}>
                    <td>
                      <input
                        className="input"
                        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
                        value={skill.label}
                        aria-label={`Name of ${skill.label}`}
                        onChange={(e) => saveSkill({ ...skill, label: e.target.value })}
                      />
                    </td>
                    <td>
                      {/* Optional, and worth having: two people using the same tag should
                          mean the same thing by it. */}
                      <input
                        className="input"
                        value={skill.note ?? ''}
                        placeholder="What somebody holding this can do"
                        aria-label={`What ${skill.label} means`}
                        onChange={(e) => saveSkill({ ...skill, note: e.target.value })}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: held ? undefined : 'var(--color-accent-2-700)' }}>
                      {held} {held === 1 ? 'person' : 'people'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-700)' }}>
                      {asked} project{asked === 1 ? '' : 's'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--color-accent-2-700)' }}
                        aria-label={`Remove ${skill.label}`}
                        title={`Remove ${skill.label}`}
                        onClick={() => {
                          const parts = [
                            held ? `${held} ${held === 1 ? 'person holds' : 'people hold'} it` : '',
                            asked ? `${asked} project${asked === 1 ? '' : 's'} ask${asked === 1 ? 's' : ''} for it` : '',
                          ].filter(Boolean);
                          const tail = parts.length ? ` ${parts.join(' and ')}; it comes off them too.` : '';
                          if (window.confirm(`Remove ${skill.label}?${tail}`)) removeSkill(skill.id);
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ margin: '0 0 4px' }}>Who can do what</h3>
          <p className="lede" style={{ marginBottom: 'var(--space-4)' }}>
            Tick a box and it is saved. A column with nothing in it is a skill the team cannot cover; a row with nothing
            in it is somebody the tracker cannot match to work that asks for anything.
          </p>
          {people.length === 0 ? (
            <p className="empty">Nobody on the team yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table skills-matrix">
                <thead>
                  <tr>
                    <th style={{ width: 200 }}>Person</th>
                    {skills.map((s) => (
                      <th key={s.id} style={{ width: 96, verticalAlign: 'bottom' }} title={s.note}>
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{person.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)' }}>{person.role}</span>
                      </td>
                      {skills.map((s) => {
                        const on = Boolean(person.skills?.includes(s.id));
                        return (
                          <td key={s.id} style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={on}
                              aria-label={`${person.name} can do ${s.label}`}
                              style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                              onChange={(e) => setPersonSkill(person.id, s.id, e.target.checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>People who can</td>
                    {skills.map((s) => {
                      const n = holders(s.id).length;
                      return (
                        <td
                          key={s.id}
                          style={{
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums',
                            color: n ? 'var(--color-neutral-700)' : 'var(--color-accent-2-700)',
                          }}
                        >
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
