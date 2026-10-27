import { useEffect, useRef } from 'react';
import { boxTier, isTierAdjusted, memberBox, memberTier } from '../model/logic';
import type { Action } from '../model/store';
import type { Member, Settings } from '../model/types';
import { LevelSelect, TierSelect } from './fields';
import { NumberInput } from './NumberInput';

export function MemberDialog({
  member,
  settings,
  act,
  onClose,
}: {
  member: Member;
  settings: Settings;
  act: (action: Action) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const update = (patch: Partial<Omit<Member, 'id'>>) => act({ type: 'updateMember', id: member.id, patch });
  const box = memberBox(member);
  const tier = memberTier(settings, member);
  const id = (field: string) => `member-${member.id}-${field}`;

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <form method="dialog" className="dialog__body">
        <header className="dialog__header">
          <h2>{member.name || 'Team member'}</h2>
          <button type="submit" className="icon-button" aria-label="Close">
            ✕
          </button>
        </header>

        <div className="form-grid">
          <label htmlFor={id('name')}>Name</label>
          <input id={id('name')} value={member.name} onChange={(e) => update({ name: e.target.value })} />

          <label htmlFor={id('position')}>Position</label>
          <input id={id('position')} value={member.position} onChange={(e) => update({ position: e.target.value })} />

          <label htmlFor={id('se')}>{settings.savoirEtre.name}</label>
          <div>
            <LevelSelect id={id('se')} axis={settings.savoirEtre} value={member.savoirEtre} onChange={(v) => update({ savoirEtre: v })} />
            {member.savoirEtre && <p className="hint">{settings.savoirEtre.levels[member.savoirEtre - 1].description}</p>}
          </div>

          <label htmlFor={id('sf')}>{settings.savoirFaire.name}</label>
          <div>
            <LevelSelect id={id('sf')} axis={settings.savoirFaire} value={member.savoirFaire} onChange={(v) => update({ savoirFaire: v })} />
            {member.savoirFaire && <p className="hint">{settings.savoirFaire.levels[member.savoirFaire - 1].description}</p>}
          </div>

          <span>Box</span>
          <div>
            {box ? (
              <>
                <strong>{settings.boxes[box].title}</strong>
                <p className="hint">{settings.boxes[box].action}</p>
              </>
            ) : (
              <span className="muted">Choose both levels to place this person in the grid.</span>
            )}
          </div>

          <label htmlFor={id('tier')}>Tier</label>
          <div>
            <TierSelect id={id('tier')} settings={settings} member={member} onChange={(v) => update({ tierOverride: v })} />
            {box && isTierAdjusted(settings, member) && (
              <p className="hint">Adjusted during calibration. The box suggests {boxTier(settings, box)?.name}.</p>
            )}
          </div>

          <label htmlFor={id('increment')}>Increment %</label>
          <div>
            <NumberInput
              id={id('increment')}
              className="input-short"
              value={member.incrementOverride}
              placeholder={tier?.increment != null ? String(tier.increment) : ''}
              onChange={(v) => update({ incrementOverride: v })}
            />
            <p className="hint">Leave empty to use the tier's increment{tier?.increment != null ? ` (${tier.increment} %)` : ''}.</p>
          </div>

          <label htmlFor={id('comment')}>Comments</label>
          <textarea id={id('comment')} rows={4} value={member.comment} onChange={(e) => update({ comment: e.target.value })} />
        </div>

        <footer className="dialog__footer">
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              if (confirm(`Remove ${member.name || 'this member'} from the team?`)) {
                act({ type: 'removeMember', id: member.id });
                ref.current?.close();
              }
            }}
          >
            Remove from team
          </button>
          <button type="submit" className="button button--primary">
            Done
          </button>
        </footer>
      </form>
    </dialog>
  );
}
