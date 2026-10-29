import { ADDED_LEVEL, defaultSettings } from './defaults';
import { boxOf } from './logic';
import { BOX_IDS, type Axis, type BoxId, type LevelLabel, type Level, type Member, type Settings, type Tier, type Workspace } from './types';

/** Marker written into saved files so we can recognise them when opened again. */
export const FILE_FORMAT = 'nine-box-workspace';

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function createWorkspace(): Workspace {
  return {
    version: 2,
    team: { name: '', manager: '', period: String(new Date().getFullYear()) },
    members: [],
    settings: defaultSettings(),
  };
}

export function createMember(fields: Partial<Omit<Member, 'id'>> = {}): Member {
  return {
    id: uid(),
    name: '',
    position: '',
    savoirEtre: null,
    savoirFaire: null,
    tierOverride: null,
    incrementOverride: null,
    comment: '',
    ...fields,
  };
}

export function serializeWorkspace(ws: Workspace): string {
  return JSON.stringify({ format: FILE_FORMAT, ...ws }, null, 2);
}

/**
 * Reads a workspace from untrusted JSON (a file the user opened). Unknown or
 * malformed fields fall back to defaults instead of breaking the app.
 */
export function parseWorkspace(input: unknown): Workspace {
  const raw = typeof input === 'string' ? safeJson(input) : input;
  if (!isObject(raw) || raw.format !== FILE_FORMAT) {
    throw new Error('This file was not saved by the Nine-Box tool.');
  }
  // Version 1 files used three levels (Faible, Moyen, Élevé); "Bon" now sits before Élevé.
  const threeLevels = raw.version !== 2;
  const settings = parseSettings(raw.settings, threeLevels);
  const team = isObject(raw.team) ? raw.team : {};
  const tierIds = new Set(settings.tiers.map((t) => t.id));
  const level = threeLevels ? oldLevel : newLevel;
  return {
    version: 2,
    team: { name: str(team.name), manager: str(team.manager), period: str(team.period) },
    members: Array.isArray(raw.members) ? raw.members.filter(isObject).map((m) => parseMember(m, tierIds, level)) : [],
    settings,
  };
}

function parseMember(m: Record<string, unknown>, tierIds: Set<string>, level: (value: unknown) => Level | null): Member {
  const tierOverride = typeof m.tierOverride === 'string' && tierIds.has(m.tierOverride) ? m.tierOverride : null;
  return {
    id: typeof m.id === 'string' && m.id ? m.id : uid(),
    name: str(m.name),
    position: str(m.position),
    savoirEtre: level(m.savoirEtre),
    savoirFaire: level(m.savoirFaire),
    tierOverride,
    incrementOverride: num(m.incrementOverride),
    comment: str(m.comment),
  };
}

function parseSettings(input: unknown, threeLevels: boolean): Settings {
  const defaults = defaultSettings();
  if (!isObject(input)) return defaults;

  let tiers: Tier[] = defaults.tiers;
  if (Array.isArray(input.tiers)) {
    const seen = new Set<string>();
    const parsed = input.tiers.filter(isObject).flatMap((t): Tier[] => {
      const id = str(t.id);
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{
        id,
        name: str(t.name) || id,
        color: /^#[0-9a-f]{6}$/i.test(str(t.color)) ? str(t.color) : '#888888',
        target: num(t.target) ?? 0,
        increment: num(t.increment),
      }];
    });
    if (parsed.length > 0) tiers = parsed;
  }

  const tierIds = new Set(tiers.map((t) => t.id));
  let boxesIn = isObject(input.boxes) ? input.boxes : {};
  if (threeLevels) {
    // Old boxes 1–9 move to where their levels now sit in the 4 × 4 grid.
    boxesIn = Object.fromEntries(Object.entries(boxesIn).map(([id, box]) => [upgradeBox(Number(id)) ?? `old-${id}`, box]));
  }
  const boxes = { ...defaults.boxes };
  for (const id of BOX_IDS) {
    const b = isObject(boxesIn[id]) ? boxesIn[id] : {};
    const fallback = defaults.boxes[id];
    const tierId = str(b.tierId);
    boxes[id] = {
      title: typeof b.title === 'string' ? b.title : fallback.title,
      action: typeof b.action === 'string' ? b.action : fallback.action,
      tierId: tierIds.has(tierId) ? tierId : tierIds.has(fallback.tierId) ? fallback.tierId : tiers[tiers.length - 1].id,
    };
  }

  return {
    savoirEtre: parseAxis(input.savoirEtre, defaults.savoirEtre, threeLevels ? ADDED_LEVEL.savoirEtre : null),
    savoirFaire: parseAxis(input.savoirFaire, defaults.savoirFaire, threeLevels ? ADDED_LEVEL.savoirFaire : null),
    tiers,
    boxes,
  };
}

/** `added` is inserted before the last level when reading a three-level file. */
function parseAxis(input: unknown, fallback: Axis, added: LevelLabel | null): Axis {
  if (!isObject(input)) return fallback;
  const levels: unknown[] = Array.isArray(input.levels) ? [...input.levels] : [];
  if (added && levels.length === 3) levels.splice(2, 0, added);
  return {
    name: str(input.name) || fallback.name,
    levels: fallback.levels.map((f, i) => {
      const l = isObject(levels[i]) ? levels[i] : {};
      return {
        label: str(l.label) || f.label,
        description: typeof l.description === 'string' ? l.description : f.description,
      };
    }) as Axis['levels'],
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function newLevel(value: unknown): Level | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

/** Three-level files: Faible and Moyen are unchanged, Élevé was 3 and is now 4. */
function oldLevel(value: unknown): Level | null {
  return value === 1 || value === 2 ? value : value === 3 ? 4 : null;
}

function upgradeBox(oldId: number): BoxId | null {
  if (!Number.isInteger(oldId) || oldId < 1 || oldId > 9) return null;
  const savoirEtre = oldLevel(((oldId - 1) % 3) + 1);
  const savoirFaire = oldLevel(3 - Math.floor((oldId - 1) / 3));
  return boxOf(savoirEtre, savoirFaire);
}
