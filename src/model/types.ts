/** 1 = Faible (low), 2 = Moyen (medium), 3 = Élevé (high). */
export type Level = 1 | 2 | 3;
export const LEVELS: readonly Level[] = [1, 2, 3];

/**
 * Boxes are numbered like the original Excel template: 1–3 is the top row
 * (high Savoir-faire), 7–9 the bottom row, each row going left to right from
 * low to high Savoir-être.
 */
export type BoxId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const BOX_IDS: readonly BoxId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface LevelLabel {
  label: string;
  description: string;
}

export interface Axis {
  name: string;
  /** Index 0 describes level 1, index 2 describes level 3. */
  levels: [LevelLabel, LevelLabel, LevelLabel];
}

export interface Tier {
  id: string;
  name: string;
  /** Hex colour, e.g. "#00A0AF". */
  color: string;
  /** Target share of the team, in percent (10 means 10 %). */
  target: number;
  /** Default annual increment for this tier, in percent. Null when not decided yet. */
  increment: number | null;
}

export interface BoxConfig {
  title: string;
  action: string;
  tierId: string;
}

export interface Settings {
  /** Horizontal axis (behaviour). */
  savoirEtre: Axis;
  /** Vertical axis (impact / potential). */
  savoirFaire: Axis;
  /** Ordered from best to worst. */
  tiers: Tier[];
  boxes: Record<BoxId, BoxConfig>;
  /** Free text shown next to amounts, e.g. "Rs" or "MUR". */
  currency: string;
}

export interface Member {
  id: string;
  name: string;
  position: string;
  savoirEtre: Level | null;
  savoirFaire: Level | null;
  /** Manual calibration: replaces the tier that comes from the box. */
  tierOverride: string | null;
  /** Replaces the tier's default increment, in percent. */
  incrementOverride: number | null;
  salary: number | null;
  comment: string;
}

export interface Team {
  name: string;
  manager: string;
  period: string;
}

export interface Workspace {
  version: 1;
  team: Team;
  members: Member[];
  settings: Settings;
  /** Notes for the guiding questions, keyed by question id. */
  notes: Record<string, string>;
}
