import { boxTier, memberBox, memberTier } from '../model/logic';
import { tierStyle } from './TierBadge';
import type { Axis, Level, Member, Settings } from '../model/types';

export function LevelSelect({
  axis,
  value,
  onChange,
  id,
  label,
}: {
  axis: Axis;
  value: Level | null;
  onChange: (value: Level | null) => void;
  id?: string;
  label?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label ?? axis.name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : (Number(e.target.value) as Level))}
    >
      <option value="">—</option>
      {axis.levels.map((l, i) => (
        <option key={i} value={i + 1} title={l.description}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

/** "Automatic" follows the member's box; any other choice is a manual calibration. */
export function TierSelect({
  settings,
  member,
  onChange,
  id,
}: {
  settings: Settings;
  member: Member;
  onChange: (tierId: string | null) => void;
  id?: string;
}) {
  const box = memberBox(member);
  if (box === null) return <span className="muted">Not placed</span>;
  const auto = boxTier(settings, box);
  return (
    <select
      id={id}
      aria-label="Tier"
      className="tier-select"
      style={tierStyle(memberTier(settings, member))}
      value={member.tierOverride ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{auto ? `Auto: ${auto.name}` : 'Auto'}</option>
      {settings.tiers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
