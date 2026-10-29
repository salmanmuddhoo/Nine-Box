import { describe, expect, it } from 'vitest';
import { createMember, createWorkspace } from '../model/workspace';
import { createPdf, layoutNames, layoutTree, pdfText, type PdfOptions } from './pdfExport';

const ALL: PdfOptions = { calibration: true };

function sampleWorkspace() {
  const ws = createWorkspace();
  ws.team = { name: 'Finance', manager: 'Salman Muddhoo', period: '2026' };
  ws.members = [
    createMember({ name: 'Alice Martin', position: 'Analyste', savoirEtre: 4, savoirFaire: 4, incrementOverride: 6 }),
    createMember({ name: 'Bob Dupont', savoirEtre: 2, savoirFaire: 2, tierOverride: 'bonne' }),
    createMember({ name: 'Chloé Lefèvre', savoirEtre: 3, savoirFaire: 3 }),
    createMember({ name: 'Dev Ramsamy' }),
  ];
  return ws;
}

describe('pdfText', () => {
  it('keeps French text and simplifies characters the PDF fonts cannot show', () => {
    expect(pdfText('Élevé, Contrôleuse, Œuvre — 5 €')).toBe('Élevé, Contrôleuse, Œuvre — 5 €');
    expect(pdfText('Savoir-faire → −1,4')).toBe('Savoir-faire -> -1,4');
    expect(pdfText('Łukasz 李')).toBe('?ukasz ?');
  });
});

// A box of the 4 × 4 grid leaves about 55 × 19 mm for names.
describe('layoutNames', () => {
  it('uses one roomy column while names fit', () => {
    expect(layoutNames(4, 55, 19)).toMatchObject({ cols: 1, rowH: 4.6, overflow: false });
  });

  it('adds columns and tightens rows for crowded boxes', () => {
    expect(layoutNames(8, 55, 19)).toMatchObject({ cols: 2, rowH: 4.6, overflow: false });
    expect(layoutNames(15, 55, 19)).toMatchObject({ cols: 3, rowH: 3.5, overflow: false });
  });

  it('reports overflow when even the densest layout is full', () => {
    const layout = layoutNames(100, 55, 19);
    expect(layout.overflow).toBe(true);
    expect(layout.capacity).toBeLessThan(100);
  });
});

// The tree page leaves about 273 × 134 mm below the manager.
describe('layoutTree', () => {
  it('puts a small team on one row of large cards', () => {
    expect(layoutTree(8, 273, 134)).toMatchObject({ rows: 1, cols: 8, scale: 1, perPage: 8 });
  });

  it('balances several rows with an even number of columns', () => {
    expect(layoutTree(21, 273, 134)).toMatchObject({ rows: 3, cols: 8, scale: 1, perPage: 21 });
    expect(layoutTree(12, 273, 134)).toMatchObject({ rows: 2, cols: 6, perPage: 12 });
  });

  it('shrinks the cards for a big team, then continues on more pages', () => {
    expect(layoutTree(60, 273, 134)).toMatchObject({ cols: 12, rows: 5, scale: 0.7, perPage: 60 });
    expect(layoutTree(200, 273, 134).perPage).toBe(60);
  });
});

describe('createPdf', () => {
  it('starts with the team tree, then the grid, then calibration if asked', async () => {
    const ws = sampleWorkspace();
    expect((await createPdf(ws, ALL, false)).getNumberOfPages()).toBe(3);
    expect((await createPdf(ws, { calibration: false }, false)).getNumberOfPages()).toBe(2);
    expect((await createPdf(createWorkspace(), ALL, false)).getNumberOfPages()).toBe(3);
    ws.members = Array.from({ length: 130 }, (_, i) => createMember({ name: `Person ${i + 1}`, savoirEtre: 2, savoirFaire: 2 }));
    expect((await createPdf(ws, { calibration: false }, false)).getNumberOfPages()).toBe(4);
  });

  it('shows the manager, every member with their tier, and the increments', async () => {
    const text = (await createPdf(sampleWorkspace(), ALL, false)).output();
    expect(text).toContain('Salman Muddhoo');
    expect(text).toContain('Team manager');
    expect(text).toContain('Alice Martin');
    expect(text).toContain('Analyste');
    expect(text).toContain('Bonne Année *');
    expect(text).toContain('Not placed');
    expect(text).toContain('Bob Dupont *');
    expect(text).toContain('Average increment');
    expect(text).toContain('6 %');
    expect(text).not.toMatch(/salary/i);
  });
});
