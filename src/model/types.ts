/** 1 = Faible, 2 = Moyen, 3 = Bon, 4 = Élevé. */
export type Level = 1 | 2 | 3 | 4;
export const LEVELS: readonly Level[] = [1, 2, 3, 4];

/**
 * Boxes are numbered row by row from the top (highest Savoir-faire), each row
 * going left to right from the lowest to the highest Savoir-être: 1–4 is the
 * top row, 13–16 the bottom row.
 */
export type BoxId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export const BOX_IDS: readonly BoxId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

export interface LevelLabel {
  label: string;
  description: string;
}

export interface Axis {
  name: string;
  /** Index 0 describes level 1, index 3 describes level 4. */
  levels: [LevelLabel, LevelLabel, LevelLabel, LevelLabel];
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
  comment: string;
}

export interface Team {
  name: string;
  manager: string;
  period: string;
}

export interface Workspace {
  /** 2 since the fourth level ("Bon") was added; version 1 files had three levels. */
  version: 2;
  team: Team;
  members: Member[];
  settings: Settings;
}
