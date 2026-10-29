import { formatPercent } from '../format';
import { defaultSettings } from '../model/defaults';
import { boxOf } from '../model/logic';
import type { Action } from '../model/store';
import { LEVELS, type Axis, type BoxConfig, type BoxId, type Settings, type Tier, type Workspace } from '../model/types';
import { uid } from '../model/workspace';
import { NumberInput } from './NumberInput';
import { tierStyle } from './TierBadge';

const EXTRA_COLORS = ['#1EBBF0', '#F35C0F', '#30206B', '#2E9E5B', '#B04FCF'];

export function SettingsView({ ws, act }: { ws: Workspace; act: (action: Action) => void }) {
  const { settings } = ws;
  const save = (next: Settings) => act({ type: 'settings', settings: next });
  const targetSum = settings.tiers.reduce((sum, t) => sum + t.target, 0);

  const setTier = (index: number, patch: Partial<Tier>) =>
    save({ ...settings, tiers: settings.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  const moveTier = (index: number, by: -1 | 1) => {
    const tiers = [...settings.tiers];
    [tiers[index], tiers[index + by]] = [tiers[index + by], tiers[index]];
    save({ ...settings, tiers });
  };

  const removeTier = (index: number) => {
    const tier = settings.tiers[index];
    // The next tier down, so deleting a tier never moves people to a better one by surprise.
    const replacement = settings.tiers[index < settings.tiers.length - 1 ? index + 1 : index - 1];
    const boxCount = Object.values(settings.boxes).filter((b) => b.tierId === tier.id).length;
    const overrides = ws.members.filter((m) => m.tierOverride === tier.id).length;
    const details = [
      boxCount && `${boxCount} box${boxCount > 1 ? 'es' : ''} will move to “${replacement.name}”`,
      overrides && `${overrides} manual adjustment${overrides > 1 ? 's' : ''} will be cleared`,
    ].filter(Boolean);
    if (!confirm(`Delete the tier “${tier.name}”?${details.length ? `\n\n${details.join('.\n')}.` : ''}`)) return;
    const boxes = { ...settings.boxes };
    for (const [key, box] of Object.entries(boxes)) {
      if (box.tierId === tier.id) boxes[Number(key) as BoxId] = { ...box, tierId: replacement.id };
    }
    save({ ...settings, boxes, tiers: settings.tiers.filter((_, i) => i !== index) });
  };

  const addTier = () => {
    const used = new Set(settings.tiers.map((t) => t.color.toUpperCase()));
    const color = EXTRA_COLORS.find((c) => !used.has(c)) ?? '#888888';
    save({ ...settings, tiers: [...settings.tiers, { id: uid(), name: 'New tier', color, target: 0, increment: null }] });
  };

  const setBox = (box: BoxId, patch: Partial<BoxConfig>) =>
    save({ ...settings, boxes: { ...settings.boxes, [box]: { ...settings.boxes[box], ...patch } } });

  const setAxis = (key: 'savoirEtre' | 'savoirFaire', axis: Axis) => save({ ...settings, [key]: axis });

  return (
    <div className="stack">
      <section className="card">
        <div className="card__title-row">
          <h2>Tiers</h2>
          <button type="button" className="button" onClick={addTier}>
            Add tier
          </button>
        </div>
        <p className="hint">From best to worst. The target is the share of the team expected in each tier; the increment is the default for everyone in it.</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Colour</th>
                <th>Name</th>
                <th className="num">Target %</th>
                <th className="num">Default increment %</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {settings.tiers.map((tier, i) => (
                <tr key={tier.id}>
                  <td>
                    <input type="color" aria-label={`Colour of ${tier.name}`} value={tier.color} onChange={(e) => setTier(i, { color: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label="Tier name" value={tier.name} onChange={(e) => setTier(i, { name: e.target.value })} />
                  </td>
                  <td className="num">
                    <NumberInput aria-label={`Target % for ${tier.name}`} className="input-short" value={tier.target} onChange={(v) => setTier(i, { target: v ?? 0 })} />
                  </td>
                  <td className="num">
                    <NumberInput
                      aria-label={`Default increment % for ${tier.name}`}
                      className="input-short"
                      value={tier.increment}
                      placeholder="not set"
                      onChange={(v) => setTier(i, { increment: v })}
                    />
                  </td>
                  <td className="nowrap">
                    <button type="button" className="icon-button" aria-label="Move up" disabled={i === 0} onClick={() => moveTier(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move down"
                      disabled={i === settings.tiers.length - 1}
                      onClick={() => moveTier(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      aria-label={`Delete ${tier.name}`}
                      disabled={settings.tiers.length === 1}
                      onClick={() => removeTier(i)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <th>Total</th>
                <td className="num">
                  <strong className={Math.abs(targetSum - 100) > 0.001 ? 'text-danger' : undefined}>{formatPercent(targetSum)}</strong>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {Math.abs(targetSum - 100) > 0.001 && <p className="warning">Targets should add up to 100 %.</p>}
      </section>

      <section className="card">
        <h2>Boxes</h2>
        <p className="hint">Laid out like the grid. Choose the tier each box feeds; people can still be adjusted one by one on the Calibration tab.</p>
        <div className="settings-grid">
          {[...LEVELS].reverse().flatMap((sf) =>
            LEVELS.map((se) => {
              const box = boxOf(se, sf)!;
              const config = settings.boxes[box];
              const tier = settings.tiers.find((t) => t.id === config.tierId);
              return (
                <div key={box} className="settings-box" style={tierStyle(tier)}>
                  <span className="muted small">
                    {settings.savoirEtre.name} {settings.savoirEtre.levels[se - 1].label} · {settings.savoirFaire.name}{' '}
                    {settings.savoirFaire.levels[sf - 1].label}
                  </span>
                  <input aria-label="Box title" value={config.title} onChange={(e) => setBox(box, { title: e.target.value })} />
                  <input aria-label="Recommended action" value={config.action} onChange={(e) => setBox(box, { action: e.target.value })} />
                  <select aria-label="Tier" value={config.tierId} onChange={(e) => setBox(box, { tierId: e.target.value })}>
                    {settings.tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }),
          )}
        </div>
      </section>

      <section className="card">
        <h2>Evaluation scales</h2>
        <div className="axes">
          {(['savoirEtre', 'savoirFaire'] as const).map((key) => {
            const axis = settings[key];
            return (
              <fieldset key={key} className="axis">
                <legend>{key === 'savoirEtre' ? 'Horizontal axis' : 'Vertical axis'}</legend>
                <label>
                  Name
                  <input value={axis.name} onChange={(e) => setAxis(key, { ...axis, name: e.target.value })} />
                </label>
                {axis.levels.map((level, i) => (
                  <div key={i} className="axis__level">
                    <input
                      aria-label={`Level ${i + 1} label`}
                      value={level.label}
                      onChange={(e) =>
                        setAxis(key, { ...axis, levels: axis.levels.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)) as Axis['levels'] })
                      }
                    />
                    <input
                      aria-label={`Level ${i + 1} description`}
                      value={level.description}
                      onChange={(e) =>
                        setAxis(key, {
                          ...axis,
                          levels: axis.levels.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)) as Axis['levels'],
                        })
                      }
                    />
                  </div>
                ))}
                <p className="hint">Keep the order from lowest to highest.</p>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Defaults</h2>
        <p className="hint">Go back to the original tiers, boxes and scales.</p>
        <div className="inline">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              if (confirm('Restore the default tiers, boxes and scales? Your team members and their placements are kept.')) {
                save(defaultSettings());
              }
            }}
          >
            Restore default settings
          </button>
        </div>
      </section>
    </div>
  );
}
