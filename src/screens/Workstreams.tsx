import { useState } from 'react';
import type { PortfolioView, ProjectView } from '../lib/derive';
import { hoursToDays } from '../lib/derive';
import type { Project } from '../types';


/* Workstreams: the work that does not finish.

   A project is a shape a portfolio understands — it starts, it passes through phases, it
   ends, and every screen behind it is built on those three facts. A workstream has none of
   them. Sustaining engineering, a customer's standing support, the lab's own upkeep: the
   work is real, it is booked to real people, and asking when it finishes is the wrong
   question. So it is kept out of the portfolio chart and the timeline, where a thing with no
   dates can only be drawn dishonestly, and kept in the resourcing, where it is simply hours
   like any other.

   The screen leads with all of them at once, in lanes, because the question a lead actually
   has about standing work is where it lands: which months it swells into, which months it
   leaves alone, and whose time it is quietly taking while the projects are being talked
   about. A lane per workstream, a cell per month, and the gaps meaning exactly what they
   look like — nothing booked. Underneath is the one that has been picked, planned the same
   way a project is planned — on the Planning screen, in the same picker as the projects,
   because two Gantts to keep in step would be one too many. */

export function Workstreams({
  view,
  onNew,
  onEdit,
  onPlan,
}: {
  view: PortfolioView;
  onNew: () => void;
  onEdit: (project: Project) => void;
  /** Open this one on the Planning screen, which is where every plan is built. */
  onPlan: (id: string) => void;
}) {
  const streams = view.workstreams;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = streams.find((s) => s.id === chosenId) ?? streams[0] ?? null;

  if (!streams.length) {
    return (
      <>
        <p className="empty" style={{ marginBottom: 'var(--space-4)' }}>
          No workstreams yet. A workstream is work with no end date — sustaining engineering, a standing support
          agreement, the upkeep of a rig. It books people like a project and can be planned like one, but it stays out of
          the portfolio chart and the timeline, where work with no dates cannot be drawn honestly.
        </p>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          Add a workstream
        </button>
      </>
    );
  }

  /* What each workstream draws, month by month, in hours. Read the same way every other
     screen reads it — from the bookings — so a workstream booked by its plan and one booked
     by hand say the same kind of thing here. */
  const lanes = streams.map((stream) => {
    const rows = view.allocationsFor(stream.id, view.months);
    const hours = view.months.map((_, i) => rows.reduce((n, r) => n + r.hours[i], 0));
    return {
      stream,
      rows,
      hours,
      total: hours.reduce((n, h) => n + h, 0),
      busiest: hours.length ? Math.max(...hours) : 0,
    };
  });
  /* Every lane is drawn against the same ceiling — the busiest month of any of them — so the
     lanes can be read against each other rather than each one against itself. A lane scaled
     to its own peak would make a fortnight a year look like a full-time commitment. */
  const ceiling = Math.max(1, ...lanes.map((l) => l.busiest));

  return (
    <>
      <div
        className="no-print"
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Every workstream, month by month</h3>
          <p className="lede" style={{ margin: 0, maxWidth: '74ch' }}>
            One lane each, across the resourcing window. The height of a month is what the whole team is booked to that
            workstream, drawn against the busiest month any of them has, so the lanes read against each other. A gap is
            a month with nothing booked — which is the shape most standing work has.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" style={{ flex: 'none' }} onClick={onNew}>
          Add a workstream
        </button>
      </div>

      <div className="swimlanes" style={{ ['--lane-months' as string]: view.months.length }}>
        <div className="swimlane-head">
          <div className="swimlane-name" />
          {view.monthLabels.map((label, i) => (
            <div key={view.months[i]} className="swimlane-month">
              {label}
            </div>
          ))}
          <div className="swimlane-total">Days</div>
        </div>
        {lanes.map(({ stream, rows, hours, total }) => {
          const on = chosen?.id === stream.id;
          return (
            <button
              key={stream.id}
              type="button"
              className={on ? 'swimlane is-on' : 'swimlane'}
              aria-pressed={on}
              onClick={() => setChosenId(stream.id)}
            >
              <span className="swimlane-name">
                <span className="swimlane-title">{stream.name}</span>
                <span className="swimlane-sub">
                  {stream.client} · {stream.pmName}
                  {rows.length ? ` · ${rows.length} ${rows.length === 1 ? 'person' : 'people'}` : ' · nobody booked'}
                </span>
              </span>
              {hours.map((h, i) => (
                <span
                  key={view.months[i]}
                  className="swimlane-cell"
                  title={`${view.monthLabels[i]}: ${h ? `${hoursToDays(h).toFixed(1)} days` : 'nothing booked'}`}
                >
                  {h > 0 && (
                    <span
                      className="swimlane-bar"
                      style={{ height: `${Math.max(8, Math.round((h / ceiling) * 100))}%` }}
                    />
                  )}
                </span>
              ))}
              <span className="swimlane-total">{total ? hoursToDays(total).toFixed(1) : '—'}</span>
            </button>
          );
        })}
      </div>

      {chosen && <ChosenStream view={view} stream={chosen} onEdit={onEdit} onPlan={onPlan} />}
    </>
  );
}

/* The workstream that has been picked out of the lanes: how it is driven, who is on it, and
   the way through to its plan. The plan itself is on the Planning screen — a workstream is
   planned with the same tasks, links and critical path a project is, so it is built where
   every other plan is built rather than in a second Gantt over here. */
function ChosenStream({
  view,
  stream,
  onEdit,
  onPlan,
}: {
  view: PortfolioView;
  stream: ProjectView;
  onEdit: (project: Project) => void;
  onPlan: (id: string) => void;
}) {
  const rows = view.allocationsFor(stream.id, view.months);
  const planBooked = Boolean(stream.usesPlan && stream.plansResource);
  const drawn = rows.reduce((n, r) => n + r.totalHours, 0);

  return (
    <div style={{ marginTop: 'var(--space-8)' }}>
      <div
        className="no-print"
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}
      >
        <div>
          <div className="kicker">{stream.client}</div>
          <h3 style={{ margin: '4px 0 4px' }}>{stream.name}</h3>
          <p className="lede" style={{ margin: 0 }}>
            {stream.typeLabel} · run by {stream.pmName} ·{' '}
            {/* The two ways of driving one, said in the words the form uses for them. */}
            {planBooked
              ? 'booked from its plan below'
              : stream.usesPlan
                ? 'planned below, booked by hand'
                : 'booked by hand, month by month'}
            {' · '}
            {hoursToDays(drawn).toFixed(1)} days booked across the window
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 'none' }}>
          <button type="button" className="btn btn-secondary" onClick={() => onPlan(stream.id)}>
            {stream.usesPlan ? 'Open its plan' : 'Plan it'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(stream)}>
            Edit this workstream
          </button>
        </div>
      </div>

      <h4 style={{ margin: '0 0 var(--space-2)' }}>Who is on it</h4>
      {rows.length === 0 ? (
        <p className="empty">
          Nobody booked. Open the workstream and book the hours it needs each month, or plan it and let the plan book
          them.
        </p>
      ) : (
        <table className="table" style={{ maxWidth: 1100 }}>
          <thead>
            <tr>
              <th style={{ width: 220 }}>Person</th>
              {view.monthLabels.map((m, i) => (
                <th key={view.months[i]} style={{ textAlign: 'right' }}>
                  {m}
                </th>
              ))}
              <th style={{ textAlign: 'right', width: 90 }}>Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.person.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{r.person.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}> · {r.person.role}</span>
                </td>
                {r.hours.map((h, i) => (
                  <td
                    key={view.months[i]}
                    style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: h ? undefined : 'var(--color-neutral-500)' }}
                  >
                    {h ? hoursToDays(h).toFixed(1) : '—'}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {hoursToDays(r.totalHours).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
