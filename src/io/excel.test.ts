import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../model/defaults';
import { createMember, createWorkspace } from '../model/workspace';
import { exportExcel } from './excelExport';
import { parseLevel, readExcel } from './excelImport';

async function toBuffer(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('parseLevel', () => {
  const axis = defaultSettings().savoirEtre;
  it.each([
    ['Faible : Amélioration requise, Risque Comportemental', 1],
    ['Moyen : Conforme, Solide, Fiable', 2],
    ['Bon : Engagé, Proactif, Au-dessus des Attentes', 3],
    ['Élevé', 4],
    ['eleve', 4],
    ['  MOYEN ', 2],
    ['high', 4],
    ['bonne', 3],
    ['1', 1],
    ['', null],
    ['Excellent', null],
  ])('%s → %s', (text, expected) => {
    expect(parseLevel(text, axis)).toBe(expected);
  });
});

describe('readExcel', () => {
  it('reads the IML Nine-Box template layout', async () => {
    // Same layout as "2. Nine-Box Grid" in Nine_Box_Grid_Template_Pour_IML.xlsx.
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Instructions').getCell('B3').value = 'The Nine-Box Grid Template';
    const ws = wb.addWorksheet('2. Nine-Box Grid');
    ws.getCell('B10').value = 'Employé';
    ws.getCell('D10').value = 'Savoir-être';
    ws.getCell('F10').value = 'Savoir-faire';
    ws.getCell('H10').value = 'Tier';
    ws.getCell('I10').value = 'Savoir-faire';
    ws.getCell('D11').value = 'Élevé : Exemplaire, Modèle, Forte Responsabilité\nMoyen : Conforme, Solide, Fiable';
    ws.getCell('B17').value = 'E1';
    ws.getCell('D17').value = 'Faible : Amélioration requise, Risque Comportemental';
    ws.getCell('F17').value = 'Faible : Impact/Potentiel Inférieur aux Attentes';
    ws.getCell('B18').value = 'E2';
    ws.getCell('D18').value = 'Moyen : Conforme, Solide, Fiable';
    ws.getCell('F18').value = 'Élevé : Impact/Potentiel Fort, Croissance Exceptionnelle';
    ws.getCell('H18').value = { formula: 'IF(1,"Tiers 1 (Bleu)")', result: 'Tiers 1 (Bleu)' };
    ws.getCell('B19').value = 'E3';
    // The grid on the right of the same sheet lists names again; it must be ignored.
    ws.getCell('R14').value = 'E2';

    const result = await readExcel(await toBuffer(wb), defaultSettings());
    expect(result.kind).toBe('members');
    if (result.kind !== 'members') return;
    expect(result.sheet).toBe('2. Nine-Box Grid');
    expect(result.members.map((m) => [m.name, m.savoirEtre, m.savoirFaire])).toEqual([
      ['E1', 1, 1],
      ['E2', 2, 4],
      ['E3', null, null],
    ]);
  });

  it('reads a list with French headers and ignores other columns', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Liste');
    ws.addRow(['Nom', 'Poste', 'Salaire', 'Commentaires']);
    ws.addRow(['Alice', 'Analyste', 45000, 'Très bien']);
    ws.addRow(['Bob', 'Comptable', 38500]);
    const result = await readExcel(await toBuffer(wb), defaultSettings());
    if (result.kind !== 'members') throw new Error('expected members');
    expect(result.members.map((m) => [m.name, m.position, m.comment])).toEqual([
      ['Alice', 'Analyste', 'Très bien'],
      ['Bob', 'Comptable', ''],
    ]);
    expect(result.members[0]).not.toHaveProperty('salary');
  });

  it('falls back to names in the first column', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['Alice']);
    ws.addRow(['']);
    ws.addRow(['Bob']);
    const result = await readExcel(await toBuffer(wb), defaultSettings());
    expect(result.kind === 'members' && result.members.map((m) => m.name)).toEqual(['Alice', 'Bob']);
  });

  it('rejects files that are not workbooks', async () => {
    await expect(readExcel(new TextEncoder().encode('hello').buffer as ArrayBuffer, defaultSettings())).rejects.toThrow(
      /could not be read/,
    );
  });
});

describe('exportExcel', () => {
  function sampleWorkspace() {
    const ws = createWorkspace();
    ws.team = { name: 'Équipe Finance', manager: 'Manager', period: '2026' };
    ws.settings.tiers.forEach((t, i) => (t.increment = [8, 5, 3, 0][i]));
    ws.members = [
      createMember({ name: 'Alice', savoirEtre: 4, savoirFaire: 4 }),
      createMember({ name: 'Bob', savoirEtre: 2, savoirFaire: 2, tierOverride: 'bonne', comment: 'Strong H2' }),
      createMember({ name: 'Chloé', savoirEtre: 1, savoirFaire: 1 }),
      createMember({ name: 'Dev', position: 'New joiner' }),
    ];
    return ws;
  }

  it('can be opened again with everything restored', async () => {
    const ws = sampleWorkspace();
    const blob = await exportExcel(ws);
    const result = await readExcel(await blob.arrayBuffer(), defaultSettings());
    expect(result).toEqual({ kind: 'workspace', workspace: ws });
  });

  it('writes readable sheets with matching values', async () => {
    const ws = sampleWorkspace();
    const blob = await exportExcel(ws);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Team', 'Nine-Box Grid', 'Calibration', '_nine-box']);

    const team = wb.getWorksheet('Team')!;
    expect(team.getRow(6).values).toEqual([
      undefined,
      'Name',
      'Position',
      'Savoir-être',
      'Savoir-faire',
      'Box',
      'Recommended action',
      'Tier',
      'Tier adjusted',
      'Increment %',
      'Comments',
    ]);
    expect(team.getCell('A7').value).toBe('Alice');
    expect(team.getCell('G7').value).toBe('Excellente Année');
    expect(team.getCell('I7').value).toBe(0.08);
    expect(team.getCell('G8').value).toBe('Bonne Année');
    expect(team.getCell('H8').value).toBe('Yes');
    expect(team.getCell('I8').value).toBe(0.05);
    expect(team.getCell('J8').value).toBe('Strong H2');
    expect(team.getCell('G10').value).toBe('');

    const cal = wb.getWorksheet('Calibration')!;
    expect(cal.getCell('A5').value).toBe('Excellente Année');
    expect(cal.getCell('D5').value).toMatchObject({ formula: "COUNTIF('Team'!$G$7:$G$10,A5)", result: 1 });
    expect(cal.getCell('D6').value).toMatchObject({ result: 1 });
    expect(cal.getCell('D9').value).toMatchObject({ result: 1 });
    expect(cal.getRow(4).values).toContain('Average increment %');
    expect(cal.getCell('H5').value).toMatchObject({ formula: `IFERROR(AVERAGEIF('Team'!$G$7:$G$10,A5,'Team'!$I$7:$I$10),"")`, result: 0.08 });
    // Nobody in "Année normale": the cell stays blank (Excel computes it on open).
    expect((cal.getCell('H7').value as { result?: unknown }).result ?? '').toBe('');
    expect((cal.getCell('H10').value as { result: number }).result).toBeCloseTo(13 / 300);

    const grid = wb.getWorksheet('Nine-Box Grid')!;
    // Four rows of two cells (box header, then names) from row 3; boxes in columns C to F.
    expect(grid.getCell('F3').value).toMatchObject({ richText: expect.arrayContaining([expect.objectContaining({ text: 'Top Talent (1)' })]) });
    expect(grid.getCell('F4').value).toBe('Alice');
    expect(grid.getCell('D8').value).toBe('Bob (→ Bonne Année)');
    expect(grid.getCell('C10').value).toBe('Chloé');
    expect(grid.getCell('E5').value).toMatchObject({ richText: expect.arrayContaining([expect.objectContaining({ text: 'Performer Solide (0)' })]) });
  });
});
