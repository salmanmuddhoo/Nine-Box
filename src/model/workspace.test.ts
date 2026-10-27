import { describe, expect, it } from 'vitest';
import { createMember, createWorkspace, parseWorkspace, serializeWorkspace } from './workspace';

describe('saved files', () => {
  it('round-trips a workspace', () => {
    const ws = createWorkspace();
    ws.team = { name: 'Finance', manager: 'A. Manager', period: '2026' };
    ws.members = [createMember({ name: 'Alice', savoirEtre: 3, savoirFaire: 2, tierOverride: 'excellente', incrementOverride: 4.5 })];
    expect(parseWorkspace(serializeWorkspace(ws))).toEqual(ws);
  });

  it('drops fields from earlier versions (salaries, currency, notes)', () => {
    const ws = parseWorkspace({
      format: 'nine-box-workspace',
      members: [{ name: 'Alice', salary: 1000 }],
      settings: { currency: 'Rs' },
      notes: { scope: 'Finance' },
    });
    expect(ws.members[0]).not.toHaveProperty('salary');
    expect(ws.settings).not.toHaveProperty('currency');
    expect(ws).not.toHaveProperty('notes');
  });

  it('rejects files from elsewhere', () => {
    expect(() => parseWorkspace('{"members": []}')).toThrow(/not saved by the Nine-Box tool/);
    expect(() => parseWorkspace('not json')).toThrow(/not valid JSON/);
  });

  it('repairs malformed values instead of failing', () => {
    const ws = parseWorkspace({
      format: 'nine-box-workspace',
      team: { name: 42 },
      members: [
        { name: 'Bob', savoirEtre: 7, savoirFaire: '2', tierOverride: 'unknown', incrementOverride: 'lots' },
        'garbage',
      ],
      settings: {
        tiers: [{ id: 'a', name: 'A', color: 'red', target: 100 }],
        boxes: { 5: { title: 'Custom', tierId: 'missing' } },
      },
    });
    expect(ws.team.name).toBe('42');
    expect(ws.members).toHaveLength(1);
    expect(ws.members[0]).toMatchObject({ name: 'Bob', savoirEtre: null, savoirFaire: null, tierOverride: null, incrementOverride: null });
    expect(ws.settings.tiers).toEqual([{ id: 'a', name: 'A', color: '#888888', target: 100, increment: null }]);
    expect(ws.settings.boxes[5]).toMatchObject({ title: 'Custom', tierId: 'a' });
    expect(ws.settings.savoirEtre.levels[1].label).toBe('Moyen');
  });
});
