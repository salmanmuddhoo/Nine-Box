import { describe, expect, it } from 'vitest';
import { createMember, createWorkspace, parseWorkspace, serializeWorkspace } from './workspace';

describe('saved files', () => {
  it('round-trips a workspace', () => {
    const ws = createWorkspace();
    ws.team = { name: 'Finance', manager: 'A. Manager', period: '2026' };
    ws.members = [createMember({ name: 'Alice', savoirEtre: 3, savoirFaire: 2, tierOverride: 'excellente', incrementOverride: 4.5 })];
    expect(parseWorkspace(serializeWorkspace(ws))).toEqual(ws);
  });

  it('upgrades files saved with three levels', () => {
    const ws = parseWorkspace({
      format: 'nine-box-workspace',
      version: 1,
      members: [
        { name: 'Top', savoirEtre: 3, savoirFaire: 3, tierOverride: 'bonne' },
        { name: 'Core', savoirEtre: 2, savoirFaire: 2 },
        { name: 'Fit', savoirEtre: 3, savoirFaire: 1 },
      ],
      settings: {
        savoirEtre: {
          name: 'Comportement',
          levels: [{ label: 'Bas' }, { label: 'Moyen' }, { label: 'Haut', description: 'Exemplaire' }],
        },
        boxes: {
          3: { title: 'Étoiles', action: 'Promouvoir', tierId: 'excellente' },
          5: { title: 'Piliers', action: 'Garder', tierId: 'bonne' },
        },
      },
    });
    expect(ws.version).toBe(2);
    expect(ws.members.map((m) => [m.name, m.savoirEtre, m.savoirFaire])).toEqual([
      ['Top', 4, 4],
      ['Core', 2, 2],
      ['Fit', 4, 1],
    ]);
    expect(ws.members[0].tierOverride).toBe('bonne');
    // "Bon" is slotted in before the old top level.
    expect(ws.settings.savoirEtre.levels.map((l) => l.label)).toEqual(['Bas', 'Moyen', 'Bon', 'Haut']);
    expect(ws.settings.savoirEtre.levels[3].description).toBe('Exemplaire');
    expect(ws.settings.savoirFaire.levels.map((l) => l.label)).toEqual(['Faible', 'Moyen', 'Bon', 'Élevé']);
    // Old box 3 (top right) is now box 4, old box 5 (centre) is box 10; new boxes keep their defaults.
    expect(ws.settings.boxes[4]).toEqual({ title: 'Étoiles', action: 'Promouvoir', tierId: 'excellente' });
    expect(ws.settings.boxes[10]).toEqual({ title: 'Piliers', action: 'Garder', tierId: 'bonne' });
    expect(ws.settings.boxes[7].title).toBe('Performer Solide');
  });

  it('drops fields from earlier versions (salaries, currency, notes)', () => {
    const ws = parseWorkspace({
      format: 'nine-box-workspace',
      version: 2,
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
      version: 2,
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
