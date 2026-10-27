import { useState } from 'react';
import { formatMoney } from '../format';
import { memberBox, memberTier, newSalary } from '../model/logic';
import type { Action } from '../model/store';
import type { Member, Workspace } from '../model/types';
import { createMember } from '../model/workspace';
import { LevelSelect, TierSelect } from './fields';
import { NumberInput } from './NumberInput';

export function TeamView({
  ws,
  act,
  onEdit,
  onImport,
}: {
  ws: Workspace;
  act: (action: Action) => void;
  onEdit: (memberId: string) => void;
  onImport: () => void;
}) {
  const { settings, team } = ws;
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [bulk, setBulk] = useState<string | null>(null);

  const addOne = () => {
    if (!name.trim()) return;
    act({ type: 'addMembers', members: [createMember({ name: name.trim(), position: position.trim() })] });
    setName('');
    setPosition('');
  };

  const addBulk = () => {
    const members = (bulk ?? '')
      .split(/\r?\n/)
      .map((line) => line.split(/\t|;/).map((part) => part.trim()))
      .filter(([n]) => n)
      .map(([n, p = '']) => createMember({ name: n, position: p }));
    if (members.length) act({ type: 'addMembers', members });
    setBulk(null);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Team</h2>
        <div className="team-fields">
          <label>
            Team name
            <input value={team.name} placeholder="e.g. Finance" onChange={(e) => act({ type: 'team', patch: { name: e.target.value } })} />
          </label>
          <label>
            Manager
            <input value={team.manager} onChange={(e) => act({ type: 'team', patch: { manager: e.target.value } })} />
          </label>
          <label>
            Review period
            <input value={team.period} placeholder="e.g. 2026" onChange={(e) => act({ type: 'team', patch: { period: e.target.value } })} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card__title-row">
          <h2>Members ({ws.members.length})</h2>
          <div className="inline">
            <button type="button" className="button" onClick={() => setBulk(bulk === null ? '' : null)}>
              Paste a list
            </button>
            <button type="button" className="button" onClick={onImport}>
              Import from Excel
            </button>
          </div>
        </div>

        <form
          className="add-member"
          onSubmit={(e) => {
            e.preventDefault();
            addOne();
          }}
        >
          <input aria-label="Name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Position" placeholder="Position (optional)" value={position} onChange={(e) => setPosition(e.target.value)} />
          <button type="submit" className="button button--primary" disabled={!name.trim()}>
            Add member
          </button>
        </form>

        {bulk !== null && (
          <div className="bulk">
            <label htmlFor="bulk-names">
              One person per line. Add the position after a tab or a semicolon if you like — copying two columns from
              Excel works.
            </label>
            <textarea
              id="bulk-names"
              rows={6}
              value={bulk}
              placeholder={'Marie Dupont; Analyste\nJean Martin; Comptable'}
              onChange={(e) => setBulk(e.target.value)}
            />
            <div className="inline">
              <button type="button" className="button button--primary" onClick={addBulk} disabled={!bulk.trim()}>
                Add {bulk.split(/\r?\n/).filter((l) => l.trim()).length || ''} members
              </button>
              <button type="button" className="button button--ghost" onClick={() => setBulk(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {ws.members.length === 0 ? (
          <p className="empty">
            No members yet. Add them one by one, paste a list, or import the names from Excel (the IML Nine-Box template
            works as-is).
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Position</th>
                  <th>{settings.savoirEtre.name}</th>
                  <th>{settings.savoirFaire.name}</th>
                  <th>Box</th>
                  <th>Tier</th>
                  <th className="num">Increment %</th>
                  <th className="num">Current salary</th>
                  <th className="num">New salary</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {ws.members.map((m) => {
                  const box = memberBox(m);
                  const tier = memberTier(settings, m);
                  const update = (patch: Partial<Omit<Member, 'id'>>) => act({ type: 'updateMember', id: m.id, patch });
                  return (
                    <tr key={m.id}>
                      <td>
                        <input aria-label="Name" value={m.name} onChange={(e) => update({ name: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label="Position" value={m.position} onChange={(e) => update({ position: e.target.value })} />
                      </td>
                      <td>
                        <LevelSelect axis={settings.savoirEtre} value={m.savoirEtre} onChange={(v) => update({ savoirEtre: v })} />
                      </td>
                      <td>
                        <LevelSelect axis={settings.savoirFaire} value={m.savoirFaire} onChange={(v) => update({ savoirFaire: v })} />
                      </td>
                      <td className="nowrap">{box ? settings.boxes[box].title : <span className="muted">—</span>}</td>
                      <td>
                        <TierSelect settings={settings} member={m} onChange={(v) => update({ tierOverride: v })} />
                      </td>
                      <td className="num">
                        <NumberInput
                          aria-label="Increment %"
                          className="input-short"
                          value={m.incrementOverride}
                          placeholder={tier?.increment != null ? String(tier.increment) : ''}
                          onChange={(v) => update({ incrementOverride: v })}
                        />
                      </td>
                      <td className="num">
                        <NumberInput aria-label="Current salary" className="input-money" value={m.salary} onChange={(v) => update({ salary: v })} />
                      </td>
                      <td className="num nowrap">{formatMoney(newSalary(settings, m), settings.currency)}</td>
                      <td className="nowrap">
                        <button type="button" className="button button--small" onClick={() => onEdit(m.id)}>
                          {m.comment ? 'Details ●' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          Tier follows the box unless you pick one (calibration). Increment % follows the tier unless you type one —
          set the default per tier in Settings.
        </p>
      </section>
    </div>
  );
}
