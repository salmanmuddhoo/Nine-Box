import { describe, expect, it } from 'vitest';
import { boxOf, calibration, incrementSummary, isTierAdjusted, levelsOfBox, memberIncrement, memberTier } from './logic';
import { reducer } from './store';
import { BOX_IDS, type Level, type Workspace } from './types';
import { createMember, createWorkspace } from './workspace';

function workspaceWith(...levels: [Level | null, Level | null][]): Workspace {
  const ws = createWorkspace();
  ws.members = levels.map(([savoirEtre, savoirFaire], i) => createMember({ name: `E${i + 1}`, savoirEtre, savoirFaire }));
  return ws;
}

describe('boxes', () => {
  it('numbers boxes like the Excel template backend', () => {
    // BACKEND- Calculations, column I: performance (Savoir-être) 1–3, potential (Savoir-faire) 1–3.
    expect(boxOf(1, 3)).toBe(1);
    expect(boxOf(2, 3)).toBe(2);
    expect(boxOf(3, 3)).toBe(3);
    expect(boxOf(1, 2)).toBe(4);
    expect(boxOf(2, 2)).toBe(5);
    expect(boxOf(3, 2)).toBe(6);
    expect(boxOf(1, 1)).toBe(7);
    expect(boxOf(2, 1)).toBe(8);
    expect(boxOf(3, 1)).toBe(9);
    expect(boxOf(null, 2)).toBeNull();
  });

  it('round-trips box ids and levels', () => {
    for (const box of BOX_IDS) {
      const { savoirEtre, savoirFaire } = levelsOfBox(box);
      expect(boxOf(savoirEtre, savoirFaire)).toBe(box);
    }
  });
});

describe('tiers', () => {
  it('uses the box tier, then a manual override', () => {
    const ws = workspaceWith([3, 3], [2, 2], [1, 1], [null, null]);
    const [top, core, low, unplaced] = ws.members;
    expect(memberTier(ws.settings, top)?.name).toBe('Excellente Année');
    expect(memberTier(ws.settings, core)?.name).toBe('Année normale');
    expect(memberTier(ws.settings, low)?.name).toBe('Mauvaise Année');
    expect(memberTier(ws.settings, unplaced)).toBeNull();

    core.tierOverride = 'bonne';
    expect(memberTier(ws.settings, core)?.name).toBe('Bonne Année');
    expect(isTierAdjusted(ws.settings, core)).toBe(true);
    expect(isTierAdjusted(ws.settings, top)).toBe(false);
  });

  it('drops a manual tier when the member moves to another box', () => {
    let ws = workspaceWith([2, 2]);
    const id = ws.members[0].id;
    ws = reducer(ws, { type: 'updateMember', id, patch: { tierOverride: 'bonne' } });
    ws = reducer(ws, { type: 'updateMember', id, patch: { comment: 'ok' } });
    expect(ws.members[0].tierOverride).toBe('bonne');
    ws = reducer(ws, { type: 'placeMember', id, box: 6 });
    expect(ws.members[0]).toMatchObject({ savoirEtre: 3, savoirFaire: 2, tierOverride: null });
  });

  it('clears references to a tier that is removed in settings', () => {
    let ws = workspaceWith([3, 3]);
    ws = reducer(ws, { type: 'updateMember', id: ws.members[0].id, patch: { tierOverride: 'bonne' } });
    const tiers = ws.settings.tiers.filter((t) => t.id !== 'bonne' && t.id !== 'excellente');
    ws = reducer(ws, { type: 'settings', settings: { ...ws.settings, tiers } });
    expect(ws.members[0].tierOverride).toBeNull();
    expect(ws.settings.boxes[3].tierId).toBe('mauvaise');
  });
});

describe('calibration', () => {
  it('compares each tier with its target share of the whole team', () => {
    // 10 people: 1 top talent, 3 good, 5 core, 1 not placed.
    const ws = workspaceWith([3, 3], [2, 3], [3, 2], [3, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [null, null]);
    const cal = calibration(ws);
    expect(cal.total).toBe(10);
    expect(cal.placed).toBe(9);
    expect(cal.unplaced).toBe(1);
    expect(cal.targetSum).toBe(100);
    const byName = Object.fromEntries(cal.rows.map((r) => [r.tier.name, r]));
    expect(byName['Excellente Année']).toMatchObject({ count: 1, percent: 10, gap: 0, targetCount: 1 });
    expect(byName['Bonne Année']).toMatchObject({ count: 3, percent: 30, gap: -10, targetCount: 4 });
    expect(byName['Année normale']).toMatchObject({ count: 5, percent: 50, gap: 10, targetCount: 4 });
    expect(byName['Mauvaise Année']).toMatchObject({ count: 0, percent: 0, gap: -10, targetCount: 1 });
  });

  it('handles an empty team', () => {
    const cal = calibration(createWorkspace());
    expect(cal.total).toBe(0);
    expect(cal.rows.every((r) => r.percent === 0)).toBe(true);
  });
});

describe('increments', () => {
  it('uses the tier increment unless the member has their own', () => {
    const ws = workspaceWith([3, 3], [2, 2], [2, 2], [null, null]);
    ws.settings.tiers.find((t) => t.id === 'excellente')!.increment = 8;
    ws.settings.tiers.find((t) => t.id === 'normale')!.increment = 3;
    const [top, core, other] = ws.members;
    expect(memberIncrement(ws.settings, top)).toBe(8);
    expect(memberIncrement(ws.settings, core)).toBe(3);
    other.incrementOverride = 4;
    expect(memberIncrement(ws.settings, other)).toBe(4);

    const { rows, total } = incrementSummary(ws);
    expect(rows[0]).toMatchObject({ count: 1, withIncrement: 1, average: 8 });
    expect(rows[2]).toMatchObject({ count: 2, withIncrement: 2, average: 3.5 });
    expect(rows[3]).toMatchObject({ count: 0, average: null });
    // The last row holds people not placed yet.
    expect(rows[4]).toMatchObject({ tier: null, count: 1, withIncrement: 0, average: null });
    expect(total).toMatchObject({ count: 4, withIncrement: 3, average: 5 });
  });

  it('has no average while no increment is set', () => {
    const ws = workspaceWith([2, 2]);
    expect(memberIncrement(ws.settings, ws.members[0])).toBeNull();
    expect(incrementSummary(ws).total).toMatchObject({ count: 1, withIncrement: 0, average: null });
  });
});
