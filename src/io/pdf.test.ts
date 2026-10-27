import { describe, expect, it } from 'vitest';
import { createMember, createWorkspace } from '../model/workspace';
import { createPdf, layoutNames, pdfText, type PdfOptions } from './pdfExport';

const ALL: PdfOptions = { calibration: true, team: true };

function sampleWorkspace() {
  const ws = createWorkspace();
  ws.team = { name: 'Finance', manager: 'Manager', period: '2026' };
  ws.members = [
    createMember({ name: 'Alice Martin', savoirEtre: 3, savoirFaire: 3, incrementOverride: 6 }),
    createMember({ name: 'Bob Dupont', savoirEtre: 2, savoirFaire: 2, tierOverride: 'bonne' }),
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

describe('layoutNames', () => {
  it('uses one roomy column while names fit', () => {
    expect(layoutNames(5, 74, 28)).toMatchObject({ cols: 1, rowH: 4.6, overflow: false });
  });

  it('adds columns and tightens rows for crowded boxes', () => {
    expect(layoutNames(12, 74, 28)).toMatchObject({ cols: 2, rowH: 4.6, overflow: false });
    expect(layoutNames(22, 74, 28)).toMatchObject({ cols: 3, overflow: false });
  });

  it('reports overflow when even the densest layout is full', () => {
    const layout = layoutNames(100, 74, 28);
    expect(layout.overflow).toBe(true);
    expect(layout.capacity).toBeLessThan(100);
  });
});

describe('createPdf', () => {
  it('builds one page per chosen section', async () => {
    const ws = sampleWorkspace();
    expect((await createPdf(ws, ALL, false)).getNumberOfPages()).toBe(3);
    expect((await createPdf(ws, { calibration: false, team: false }, false)).getNumberOfPages()).toBe(1);
    // No team list page for an empty team.
    expect((await createPdf(createWorkspace(), ALL, false)).getNumberOfPages()).toBe(2);
  });

  it('writes the names, tiers and increments', async () => {
    const text = (await createPdf(sampleWorkspace(), ALL, false)).output();
    expect(text).toContain('Alice Martin');
    expect(text).toContain('Bob Dupont *');
    expect(text).toContain('Dev Ramsamy');
    expect(text).toContain('Average increment');
    expect(text).toContain('6 %');
    expect(text).not.toMatch(/salary/i);
  });
});
