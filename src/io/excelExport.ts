import type { Cell, Font, Worksheet } from 'exceljs';
import { GUIDING_QUESTIONS } from '../model/defaults';
import {
  boxTier,
  calibration,
  incrementAmount,
  incrementSummary,
  isTierAdjusted,
  levelText,
  memberBox,
  memberIncrement,
  memberTier,
  newSalary,
} from '../model/logic';
import { LEVELS, type BoxId, type Workspace } from '../model/types';
import { serializeWorkspace } from '../model/workspace';
import { DATA_CHUNK, DATA_SHEET, loadExcelJS } from './excel';
import { tint } from '../colors';

const FONT: Partial<Font> = { name: 'Arial', size: 10 };
const HEADER_FILL = 'FF30206B';
const TEAM_SHEET = 'Team';
const TEAM_HEADER_ROW = 6;

export async function exportExcel(ws: Workspace): Promise<Blob> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nine-Box';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  addTeamSheet(wb.addWorksheet(TEAM_SHEET, { views: [{ state: 'frozen', ySplit: TEAM_HEADER_ROW }] }), ws);
  addGridSheet(wb.addWorksheet('Nine-Box Grid'), ws);
  addCalibrationSheet(wb.addWorksheet('Calibration'), ws);
  addQuestionsSheet(wb.addWorksheet('Guiding questions'), ws);

  // The full workspace, so this workbook can be opened again in the tool.
  const data = wb.addWorksheet(DATA_SHEET, { state: 'veryHidden' });
  const json = serializeWorkspace(ws);
  for (let i = 0; i * DATA_CHUNK < json.length; i++) {
    data.getCell(i + 1, 1).value = json.slice(i * DATA_CHUNK, (i + 1) * DATA_CHUNK);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function argb(hex: string): string {
  return 'FF' + hex.replace('#', '').toUpperCase();
}

function put(cell: Cell, value: Cell['value'], font: Partial<Font> = {}): Cell {
  cell.value = value;
  cell.font = { ...FONT, ...font };
  cell.alignment = { vertical: 'top', wrapText: true };
  return cell;
}

const TITLE_FONT: Partial<Font> = { bold: true, size: 16, color: { argb: HEADER_FILL } };
const NOTE_FONT: Partial<Font> = { italic: true, color: { argb: 'FF666666' } };

/** Unwrapped text, so it can run across the empty cells to its right. */
function line(cell: Cell, text: string, font: Partial<Font>): Cell {
  put(cell, text, font);
  cell.alignment = { vertical: 'top' };
  return cell;
}

function fill(cell: Cell, hex: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } };
}

function headerRow(sheet: Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => {
    const cell = put(sheet.getCell(row, i + 1), h, { bold: true, color: { argb: 'FFFFFFFF' } });
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function titleBlock(sheet: Worksheet, title: string, ws: Workspace) {
  line(sheet.getCell('A1'), title, TITLE_FONT);
  const lines = [
    ['Team', ws.team.name],
    ['Manager', ws.team.manager],
    ['Review period', ws.team.period],
  ];
  lines.forEach(([label, value], i) => {
    put(sheet.getCell(i + 2, 1), label, { bold: true });
    put(sheet.getCell(i + 2, 2), value);
  });
}

function teamRange(ws: Workspace, column: string): string {
  const first = TEAM_HEADER_ROW + 1;
  const last = Math.max(first, TEAM_HEADER_ROW + ws.members.length);
  return `'${TEAM_SHEET}'!$${column}$${first}:$${column}$${last}`;
}

function money(ws: Workspace): string {
  return ws.settings.currency ? `"${ws.settings.currency.replace(/"/g, '')} "#,##0.00` : '#,##0.00';
}

function addTeamSheet(sheet: Worksheet, ws: Workspace) {
  const { settings } = ws;
  titleBlock(sheet, 'Nine-Box review', ws);
  const headers = [
    'Name',
    'Position',
    settings.savoirEtre.name,
    settings.savoirFaire.name,
    'Box',
    'Recommended action',
    'Tier',
    'Tier adjusted',
    'Increment %',
    'Current salary',
    'Increment amount',
    'New salary',
    'Comments',
  ];
  headerRow(sheet, TEAM_HEADER_ROW, headers);
  [24, 22, 14, 14, 24, 32, 18, 10, 12, 16, 16, 16, 40].forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  ws.members.forEach((m, i) => {
    const r = TEAM_HEADER_ROW + 1 + i;
    const box = memberBox(m);
    const tier = memberTier(settings, m);
    const pct = memberIncrement(settings, m);
    const amount = incrementAmount(settings, m);
    const salary = newSalary(settings, m);
    const values: Cell['value'][] = [
      m.name,
      m.position,
      levelText(settings, 'savoirEtre', m.savoirEtre),
      levelText(settings, 'savoirFaire', m.savoirFaire),
      box ? settings.boxes[box].title : '',
      box ? settings.boxes[box].action : '',
      tier?.name ?? '',
      isTierAdjusted(settings, m) ? 'Yes' : '',
      pct === null ? null : pct / 100,
      m.salary,
      { formula: `IF(OR(I${r}="",J${r}=""),"",J${r}*I${r})`, result: amount ?? '' },
      { formula: `IF(K${r}="","",J${r}+K${r})`, result: salary ?? '' },
      m.comment,
    ];
    values.forEach((v, c) => put(sheet.getCell(r, c + 1), v));
    sheet.getCell(r, 9).numFmt = '0.0%';
    for (const c of [10, 11, 12]) sheet.getCell(r, c).numFmt = money(ws);
    if (tier) fill(sheet.getCell(r, 7), tint(tier.color, 0.8));
  });

  const last = TEAM_HEADER_ROW + Math.max(1, ws.members.length);
  sheet.autoFilter = { from: { row: TEAM_HEADER_ROW, column: 1 }, to: { row: last, column: headers.length } };
  line(sheet.getCell(last + 2, 1), 'Increment % comes from the tier unless it was set for the member. Amounts are calculated from it.', NOTE_FONT);
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function addGridSheet(sheet: Worksheet, ws: Workspace) {
  const { settings } = ws;
  line(sheet.getCell('A1'), `Nine-Box Grid${ws.team.name ? ` — ${ws.team.name}` : ''}`, TITLE_FONT);
  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 16;
  for (const c of [3, 4, 5]) sheet.getColumn(c).width = 38;

  const byBox = new Map<BoxId, string[]>();
  for (const m of ws.members) {
    const box = memberBox(m);
    if (!box) continue;
    const label = isTierAdjusted(settings, m) ? `${m.name} (→ ${memberTier(settings, m)?.name})` : m.name;
    byBox.set(box, [...(byBox.get(box) ?? []), label]);
  }

  const top = 3;
  [...LEVELS].reverse().forEach((sf, rowIndex) => {
    const r = top + rowIndex * 2;
    sheet.mergeCells(r, 2, r + 1, 2);
    const label = put(sheet.getCell(r, 2), settings.savoirFaire.levels[sf - 1].label, { bold: true });
    label.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    let maxNames = 0;
    LEVELS.forEach((se, colIndex) => {
      const box = ((3 - sf) * 3 + se) as BoxId;
      const config = settings.boxes[box];
      const tier = boxTier(settings, box);
      const names = byBox.get(box) ?? [];
      maxNames = Math.max(maxNames, names.length);
      const head = put(sheet.getCell(r, 3 + colIndex), {
        richText: [
          { text: `${config.title} (${names.length})`, font: { ...FONT, bold: true, size: 11 } },
          { text: `\n${config.action}`, font: { ...FONT, italic: true, size: 9 } },
          { text: `\nTier: ${tier?.name ?? ''}`, font: { ...FONT, size: 9, bold: true } },
        ],
      });
      const body = put(sheet.getCell(r + 1, 3 + colIndex), names.join('\n'));
      for (const cell of [head, body]) {
        fill(cell, tint(tier?.color ?? '#cccccc', 0.85));
        cell.border = { left: { style: 'thin' }, right: { style: 'thin' } };
      }
      head.border = { ...head.border, top: { style: 'thin' } };
      body.border = { ...body.border, bottom: { style: 'thin' } };
    });
    sheet.getRow(r).height = 54;
    sheet.getRow(r + 1).height = Math.max(60, 14 * maxNames + 6);
  });

  const bottom = top + 6;
  LEVELS.forEach((se, i) => {
    const cell = put(sheet.getCell(bottom, 3 + i), settings.savoirEtre.levels[se - 1].label, { bold: true });
    cell.alignment = { horizontal: 'center' };
  });
  sheet.mergeCells(bottom + 1, 3, bottom + 1, 5);
  const xAxis = put(sheet.getCell(bottom + 1, 3), `${settings.savoirEtre.name} →`, { bold: true, size: 12 });
  xAxis.alignment = { horizontal: 'center' };
  sheet.mergeCells(top, 1, top + 5, 1);
  const yAxis = put(sheet.getCell(top, 1), `${settings.savoirFaire.name} →`, { bold: true, size: 12 });
  yAxis.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
}

function addCalibrationSheet(sheet: Worksheet, ws: Workspace) {
  const cal = calibration(ws);
  const inc = incrementSummary(ws);
  line(sheet.getCell('A1'), 'Calibration', TITLE_FONT);
  put(sheet.getCell('A2'), 'Team size', { bold: true });
  put(sheet.getCell('B2'), { formula: `COUNTA(${teamRange(ws, 'A')})`, result: cal.total });
  [22, 12, 14, 14, 12, 12, 14, 18, 18].forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  const head = 4;
  headerRow(sheet, head, [
    'Tier',
    'Target %',
    'Target headcount',
    'Actual headcount',
    'Actual %',
    'Gap',
    'Default increment %',
    'Payroll',
    'Increment cost',
  ]);
  const tierRange = teamRange(ws, 'G');
  cal.rows.forEach((row, i) => {
    const r = head + 1 + i;
    const costs = inc.rows[i];
    const cells: Cell['value'][] = [
      row.tier.name,
      row.tier.target / 100,
      { formula: `B${r}*$B$2`, result: row.targetCount },
      { formula: `COUNTIF(${tierRange},A${r})`, result: row.count },
      { formula: `IF($B$2=0,0,D${r}/$B$2)`, result: row.percent / 100 },
      { formula: `E${r}-B${r}`, result: row.gap / 100 },
      row.tier.increment === null ? null : row.tier.increment / 100,
      { formula: `SUMIF(${tierRange},A${r},${teamRange(ws, 'J')})`, result: costs.payroll },
      { formula: `SUMIF(${tierRange},A${r},${teamRange(ws, 'K')})`, result: costs.increment },
    ];
    cells.forEach((v, c) => put(sheet.getCell(r, c + 1), v));
    fill(sheet.getCell(r, 1), tint(row.tier.color, 0.8));
  });

  const firstTier = head + 1;
  const lastTier = head + cal.rows.length;
  const unplacedRow = lastTier + 1;
  const totalRow = lastTier + 2;
  const unplaced = inc.rows[inc.rows.length - 1];
  put(sheet.getCell(unplacedRow, 1), 'Not placed yet', { italic: true });
  put(sheet.getCell(unplacedRow, 4), { formula: `$B$2-SUM(D${firstTier}:D${lastTier})`, result: cal.unplaced });
  put(sheet.getCell(unplacedRow, 5), { formula: `IF($B$2=0,0,D${unplacedRow}/$B$2)`, result: cal.total ? cal.unplaced / cal.total : 0 });
  put(sheet.getCell(unplacedRow, 8), { formula: `SUM(${teamRange(ws, 'J')})-SUM(H${firstTier}:H${lastTier})`, result: unplaced.payroll });

  put(sheet.getCell(totalRow, 1), 'Total', { bold: true });
  const sum = (col: string, result: number) =>
    put(sheet.getCell(`${col}${totalRow}`), { formula: `SUM(${col}${firstTier}:${col}${unplacedRow})`, result }, { bold: true });
  sum('B', cal.targetSum / 100);
  sum('C', (cal.targetSum / 100) * cal.total);
  sum('D', cal.total);
  sum('E', cal.total ? 1 : 0);
  sum('H', inc.total.payroll);
  sum('I', inc.total.increment);

  for (let r = firstTier; r <= totalRow; r++) {
    for (const c of ['B', 'E', 'F', 'G']) sheet.getCell(`${c}${r}`).numFmt = '0.0%';
    sheet.getCell(`C${r}`).numFmt = '0.0';
    for (const c of ['H', 'I']) sheet.getCell(`${c}${r}`).numFmt = money(ws);
  }
  line(sheet.getCell(totalRow + 2, 1), 'Gap = actual % minus target %. Positive means more people in the tier than the target.', NOTE_FONT);
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function addQuestionsSheet(sheet: Worksheet, ws: Workspace) {
  line(sheet.getCell('A1'), 'Guiding questions', TITLE_FONT);
  headerRow(sheet, 3, ['Topic', 'Question', 'Notes']);
  [30, 60, 60].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  GUIDING_QUESTIONS.forEach((q, i) => {
    const r = 4 + i;
    put(sheet.getCell(r, 1), q.title, { bold: true });
    put(sheet.getCell(r, 2), q.question);
    put(sheet.getCell(r, 3), ws.notes[q.id] ?? '');
  });
}
