import { boxOf, levelsOfBox } from './logic';
import type { BoxId, Member, Settings, Team, Workspace } from './types';

export type Action =
  | { type: 'replace'; workspace: Workspace }
  | { type: 'team'; patch: Partial<Team> }
  | { type: 'addMembers'; members: Member[] }
  | { type: 'updateMember'; id: string; patch: Partial<Omit<Member, 'id'>> }
  | { type: 'removeMember'; id: string }
  | { type: 'placeMember'; id: string; box: BoxId | null }
  | { type: 'settings'; settings: Settings };

export function reducer(ws: Workspace, action: Action): Workspace {
  switch (action.type) {
    case 'replace':
      return action.workspace;
    case 'team':
      return { ...ws, team: { ...ws.team, ...action.patch } };
    case 'addMembers':
      return { ...ws, members: [...ws.members, ...action.members] };
    case 'updateMember':
      return { ...ws, members: ws.members.map((m) => (m.id === action.id ? applyPatch(m, action.patch) : m)) };
    case 'removeMember':
      return { ...ws, members: ws.members.filter((m) => m.id !== action.id) };
    case 'placeMember': {
      const levels = action.box === null ? { savoirEtre: null, savoirFaire: null } : levelsOfBox(action.box);
      return { ...ws, members: ws.members.map((m) => (m.id === action.id ? applyPatch(m, levels) : m)) };
    }
    case 'settings':
      return withSettings(ws, action.settings);
  }
}

/** A manual tier adjustment is made for the member's current box, so it is dropped when they move to another box. */
function applyPatch(member: Member, patch: Partial<Omit<Member, 'id'>>): Member {
  const next = { ...member, ...patch };
  if (boxOf(next.savoirEtre, next.savoirFaire) !== boxOf(member.savoirEtre, member.savoirFaire) && !('tierOverride' in patch)) {
    next.tierOverride = null;
  }
  return next;
}

/** Keeps members and boxes pointing at tiers that still exist. */
function withSettings(ws: Workspace, settings: Settings): Workspace {
  const ids = new Set(settings.tiers.map((t) => t.id));
  const fallback = settings.tiers[settings.tiers.length - 1].id;
  const boxes = { ...settings.boxes };
  for (const key of Object.keys(boxes)) {
    const id = Number(key) as BoxId;
    if (!ids.has(boxes[id].tierId)) boxes[id] = { ...boxes[id], tierId: fallback };
  }
  return {
    ...ws,
    settings: { ...settings, boxes },
    members: ws.members.map((m) =>
      m.tierOverride !== null && !ids.has(m.tierOverride) ? { ...m, tierOverride: null } : m,
    ),
  };
}
