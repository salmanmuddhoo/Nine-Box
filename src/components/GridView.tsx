import { useState, type DragEvent } from 'react';
import { boxOf, boxTier, calibration, isTierAdjusted, memberBox, memberTier } from '../model/logic';
import type { Action } from '../model/store';
import { LEVELS, type BoxId, type Member, type Workspace } from '../model/types';
import { PersonAvatar } from './PersonAvatar';
import { tierStyle, TierBadge } from './TierBadge';

const DRAG_TYPE = 'text/x-nine-box-member';

export function GridView({ ws, act, onEdit }: { ws: Workspace; act: (action: Action) => void; onEdit: (memberId: string) => void }) {
  const { settings } = ws;
  const [over, setOver] = useState<BoxId | 'tray' | null>(null);

  const byBox = new Map<BoxId | null, Member[]>();
  for (const m of ws.members) {
    const box = memberBox(m);
    byBox.set(box, [...(byBox.get(box) ?? []), m]);
  }
  const unplaced = byBox.get(null) ?? [];

  const dropProps = (target: BoxId | 'tray') => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== target) setOver(target);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id) act({ type: 'placeMember', id, box: target === 'tray' ? null : target });
    },
  });

  const chip = (m: Member) => {
    const tier = memberTier(settings, m);
    const adjusted = isTierAdjusted(settings, m);
    return (
      <li key={m.id}>
        <button
          type="button"
          className="chip"
          style={tierStyle(tier)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, m.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setOver(null)}
          onClick={() => onEdit(m.id)}
          title={adjusted && tier ? `Tier adjusted to ${tier.name}` : 'Drag to another box, or click to edit'}
        >
          <PersonAvatar />
          <span className="chip__text">
            <span className="chip__name">{m.name || 'Unnamed'}</span>
            {m.position && <span className="chip__meta">{m.position}</span>}
            {adjusted && tier && <span className="chip__tier">{tier.name}</span>}
          </span>
        </button>
      </li>
    );
  };

  const cal = calibration(ws);

  return (
    <div className="grid-layout">
      <section className="card grid-card">
        <div className="nine-box">
          <div className="nine-box__y-axis">
            <span>{settings.savoirFaire.name} →</span>
          </div>
          {[...LEVELS].reverse().map((sf) => (
            <div key={sf} className="nine-box__row">
              <div className="nine-box__row-label">
                <strong>{settings.savoirFaire.levels[sf - 1].label}</strong>
                <span>{settings.savoirFaire.levels[sf - 1].description}</span>
              </div>
              {LEVELS.map((se) => {
                const box = boxOf(se, sf)!;
                const config = settings.boxes[box];
                const tier = boxTier(settings, box);
                const members = byBox.get(box) ?? [];
                return (
                  <section
                    key={box}
                    aria-label={config.title}
                    className={`box${over === box ? ' box--over' : ''}`}
                    style={tierStyle(tier)}
                    {...dropProps(box)}
                  >
                    <header className="box__header">
                      <div>
                        <h3>{config.title}</h3>
                        <p>{config.action}</p>
                      </div>
                      <span className="box__count" aria-label={`${members.length} members`}>
                        {members.length}
                      </span>
                    </header>
                    <TierBadge tier={tier} />
                    <ul className="chips">{members.map(chip)}</ul>
                  </section>
                );
              })}
            </div>
          ))}
          <div className="nine-box__x-labels">
            {LEVELS.map((se) => (
              <div key={se}>
                <strong>{settings.savoirEtre.levels[se - 1].label}</strong>
                <span>{settings.savoirEtre.levels[se - 1].description}</span>
              </div>
            ))}
          </div>
          <div className="nine-box__x-axis">{settings.savoirEtre.name} →</div>
        </div>
      </section>

      <aside className="stack grid-side">
        <section className={`card tray${over === 'tray' ? ' tray--over' : ''}`} {...dropProps('tray')}>
          <h2>Not placed yet ({unplaced.length})</h2>
          {ws.members.length === 0 ? (
            <p className="empty">Add your team members on the Team tab first.</p>
          ) : unplaced.length === 0 ? (
            <p className="hint">Everyone is placed. Drag a name here to take it out of the grid.</p>
          ) : (
            <>
              <p className="hint">Drag each name into a box, or click it to choose the levels.</p>
              <ul className="chips">{unplaced.map(chip)}</ul>
            </>
          )}
        </section>

        <section className="card">
          <h2>Distribution</h2>
          <ul className="mini-cal">
            {cal.rows.map((row) => (
              <li key={row.tier.id} style={tierStyle(row.tier)}>
                <span className="mini-cal__name">{row.tier.name}</span>
                <span className="mini-cal__bar" aria-hidden>
                  <span style={{ width: `${Math.min(100, row.percent)}%` }} />
                  <i style={{ left: `${Math.min(100, row.tier.target)}%` }} />
                </span>
                <span className="mini-cal__value">
                  {row.count} <span className="muted">/ {Math.round(row.targetCount * 10) / 10}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Placed / target headcount. The tick shows the target share.</p>
        </section>
      </aside>
    </div>
  );
}
