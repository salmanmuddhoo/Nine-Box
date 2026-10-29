import type { Cell, CellValue, Worksheet } from 'exceljs';
import type { Axis, Level, Member, Settings, Workspace } from '../model/types';
import { createMember, parseWorkspace } from '../model/workspace';
import { DATA_SHEET, loadExcelJS } from './excel';

export type ImportResult =
  | { kind: 'workspace'; workspace: Workspace }
  | { kind: 'members'; members: Member[]; sheet: string };

/**
 * Reads an Excel file in one of three shapes:
 * - a workbook exported by this tool (restores everything),
 * - any sheet with a header row containing a name column, which covers the
 *   original IML Nine-Box template ("Employé", "Savoir-être", "Savoir-faire"),
 * - otherwise, a plain list of names in the first column.
 */
export async function readExcel(data: ArrayBuffer, settings: Settings): Promise<ImportResult> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    throw new Error('This file could not be read as an Excel workbook (.xlsx).');
  }

  const dataSheet = wb.getWorksheet(DATA_SHEET);
  if (dataSheet) {
    const chunks: string[] = [];
    dataSheet.getColumn(1).eachCell((cell) => chunks.push(cellText(cell)));
    return { kind: 'workspace', workspace: parseWorkspace(chunks.join('')) };
  }

  const sheets = wb.worksheets.filter((ws) => ws.state === 'visible');
  for (const ws of sheets) {
    const table = findTable(ws, settings);
    if (table) return { kind: 'members', members: readTable(ws, table, settings), sheet: ws.name };
  }

  const first = sheets[0];
  if (!first) throw new Error('This workbook has no visible sheet.');
  const members: Member[] = [];
  first.getColumn(1).eachCell((cell) => {
    const name = cellText(cell).trim();
    if (name) members.push(createMember({ name }));
  });
  return { kind: 'members', members, sheet: first.name };
}

interface Table {
  headerRow: number;
  name: number;
  position?: number;
  savoirEtre?: number;
  savoirFaire?: number;
  comment?: number;
}

const NAME_HEADERS = ['nom', 'name', 'employe', 'employee', 'collaborateur', 'membre', 'member', 'nom complet', 'full name', 'nom et prenom', 'prenom et nom'];
const POSITION_HEADERS = ['poste', 'position', 'role', 'fonction', 'job title', 'title', 'titre'];
const COMMENT_HEADERS = ['commentaire', 'commentaires', 'comment', 'comments', 'notes', 'remarques'];

function findTable(ws: Worksheet, settings: Settings): Table | null {
  const last = Math.min(ws.rowCount, 30);
  for (let r = 1; r <= last; r++) {
    const row = ws.getRow(r);
    const table: Partial<Table> = {};
    // First match wins: the IML template repeats "Savoir-faire" further right as the grid's axis label.
    const take = (key: Exclude<keyof Table, 'headerRow'>, col: number) => {
      table[key] ??= col;
    };
    row.eachCell((cell, col) => {
      const h = normalize(cellText(cell));
      if (!h) return;
      if (NAME_HEADERS.includes(h)) take('name', col);
      else if (POSITION_HEADERS.includes(h)) take('position', col);
      else if (matchesAxis(h, settings.savoirEtre, ['savoir-etre', 'savoir etre'])) take('savoirEtre', col);
      else if (matchesAxis(h, settings.savoirFaire, ['savoir-faire', 'savoir faire'])) take('savoirFaire', col);
      else if (COMMENT_HEADERS.includes(h)) take('comment', col);
    });
    if (table.name !== undefined) return { ...table, headerRow: r } as Table;
  }
  return null;
}

function matchesAxis(header: string, axis: Axis, names: string[]): boolean {
  return [normalize(axis.name), ...names].some((n) => n && header.startsWith(n));
}

function readTable(ws: Worksheet, table: Table, settings: Settings): Member[] {
  const members: Member[] = [];
  for (let r = table.headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const text = (col: number | undefined) => (col === undefined ? '' : cellText(row.getCell(col)).trim());
    const name = text(table.name);
    if (!name) continue;
    members.push(
      createMember({
        name,
        position: text(table.position),
        savoirEtre: parseLevel(text(table.savoirEtre), settings.savoirEtre),
        savoirFaire: parseLevel(text(table.savoirFaire), settings.savoirFaire),
        comment: text(table.comment),
      }),
    );
  }
  return members;
}

const LEVEL_ALIASES: Record<string, Level> = {
  '1': 1, faible: 1, low: 1, bas: 1, basse: 1,
  '2': 2, moyen: 2, moyenne: 2, medium: 2, average: 2,
  '3': 3, bon: 3, bonne: 3, good: 3,
  '4': 4, eleve: 4, elevee: 4, high: 4, haut: 4, fort: 4, forte: 4,
};

/** Accepts "Moyen", "Moyen : Conforme, Solide, Fiable", "2", "medium", or the labels configured in Settings. */
export function parseLevel(value: string, axis: Axis): Level | null {
  const text = normalize(value);
  if (!text) return null;
  const head = normalize(text.split(':')[0]);
  for (let i = 0; i < axis.levels.length; i++) {
    const { label, description } = axis.levels[i];
    const full = normalize(description ? `${label} : ${description}` : label);
    if (head === normalize(label) || text === full) return (i + 1) as Level;
  }
  return LEVEL_ALIASES[head] ?? null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cellText(cell: Cell): string {
  return valueText(cell.value);
}

function valueText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if ('richText' in value) return value.richText.map((t) => t.text).join('');
  if ('formula' in value || 'sharedFormula' in value) return valueText((value as { result?: CellValue }).result ?? null);
  if ('text' in value) return String(value.text);
  return '';
}
