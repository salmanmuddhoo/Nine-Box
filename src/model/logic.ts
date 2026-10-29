import { LEVELS, type BoxId, type Level, type Member, type Settings, type Tier, type Workspace } from './types';

export function boxOf(savoirEtre: Level | null, savoirFaire: Level | null): BoxId | null {
  if (savoirEtre === null || savoirFaire === null) return null;
  return ((LEVELS.length - savoirFaire) * LEVELS.length + savoirEtre) as BoxId;
}

export function levelsOfBox(box: BoxId): { savoirEtre: Level; savoirFaire: Level } {
  return {
    savoirEtre: (((box - 1) % LEVELS.length) + 1) as Level,
    savoirFaire: (LEVELS.length - Math.floor((box - 1) / LEVELS.length)) as Level,
  };
}

export function memberBox(member: Member): BoxId | null {
  return boxOf(member.savoirEtre, member.savoirFaire);
}

export function findTier(settings: Settings, tierId: string | null): Tier | null {
  return settings.tiers.find((t) => t.id === tierId) ?? null;
}

/** The tier a box feeds, before any manual calibration. */
export function boxTier(settings: Settings, box: BoxId): Tier | null {
  return findTier(settings, settings.boxes[box].tierId);
}

/** Null until the member has been placed in the grid. */
export function memberTier(settings: Settings, member: Member): Tier | null {
  const box = memberBox(member);
  if (box === null) return null;
  return findTier(settings, member.tierOverride) ?? boxTier(settings, box);
}

export function isTierAdjusted(settings: Settings, member: Member): boolean {
  const box = memberBox(member);
  if (box === null) return false;
  const tier = memberTier(settings, member);
  return tier !== null && tier.id !== settings.boxes[box].tierId;
}

/** Increment percentage for a member: their own override, else their tier's default. */
export function memberIncrement(settings: Settings, member: Member): number | null {
  if (member.incrementOverride !== null) return member.incrementOverride;
  return memberTier(settings, member)?.increment ?? null;
}

export interface CalibrationRow {
  tier: Tier;
  /** Target headcount for the whole team (can be fractional). */
  targetCount: number;
  count: number;
  /** Share of the whole team, in percent. */
  percent: number;
  /** percent - target, in percentage points. */
  gap: number;
}

export interface Calibration {
  rows: CalibrationRow[];
  total: number;
  placed: number;
  unplaced: number;
  /** Sum of the tier targets; should be 100. */
  targetSum: number;
}

export function calibration(ws: Workspace): Calibration {
  const { settings, members } = ws;
  const total = members.length;
  const counts = new Map<string, number>();
  let placed = 0;
  for (const m of members) {
    const tier = memberTier(settings, m);
    if (memberBox(m) !== null) placed++;
    if (tier) counts.set(tier.id, (counts.get(tier.id) ?? 0) + 1);
  }
  const rows = settings.tiers.map((tier) => {
    const count = counts.get(tier.id) ?? 0;
    const percent = total === 0 ? 0 : (count / total) * 100;
    return { tier, targetCount: (tier.target / 100) * total, count, percent, gap: percent - tier.target };
  });
  return {
    rows,
    total,
    placed,
    unplaced: total - placed,
    targetSum: settings.tiers.reduce((sum, t) => sum + t.target, 0),
  };
}

export interface IncrementRow {
  tier: Tier | null;
  count: number;
  /** Members in the row who have an increment percentage. */
  withIncrement: number;
  /** Simple average of their increments, in percent; null when nobody has one. */
  average: number | null;
}

/** Increments per tier, plus a final row (tier null) for members not placed yet. */
export function incrementSummary(ws: Workspace): { rows: IncrementRow[]; total: IncrementRow } {
  const { settings } = ws;
  const sums = [...settings.tiers, null].map((tier) => ({ tier, count: 0, withIncrement: 0, sum: 0 }));
  const total = { tier: null, count: 0, withIncrement: 0, sum: 0 };
  for (const m of ws.members) {
    const tier = memberTier(settings, m);
    const pct = memberIncrement(settings, m);
    for (const row of [sums[tier ? settings.tiers.indexOf(tier) : settings.tiers.length], total]) {
      row.count++;
      if (pct !== null) {
        row.withIncrement++;
        row.sum += pct;
      }
    }
  }
  const finish = ({ sum, ...row }: (typeof sums)[number]): IncrementRow => ({
    ...row,
    average: row.withIncrement ? sum / row.withIncrement : null,
  });
  return { rows: sums.map(finish), total: finish(total) };
}

export function levelText(settings: Settings, axis: 'savoirEtre' | 'savoirFaire', level: Level | null): string {
  if (level === null) return '';
  return settings[axis].levels[level - 1].label;
}
