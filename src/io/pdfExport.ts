import type { jsPDF } from 'jspdf';
import type { CellDef, CellHookData, CellInput, RowInput, UserOptions } from 'jspdf-autotable';
import { shade, tint } from '../colors';
import { formatCount, formatMoney, formatPercent } from '../format';
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
import { LEVELS, type BoxId, type Tier, type Workspace } from '../model/types';

export interface PdfOptions {
  /** Distribution against targets and the increment budget. */
  calibration: boolean;
  /** One row per member. */
  team: boolean;
  /** Salaries and increment amounts; percentages are always shown. */
  salaries: boolean;
  /** Guiding questions with the notes taken. */
  notes: boolean;
}

type RGB = [number, number, number];
type AutoTable = (doc: jsPDF, options: UserOptions) => void;

const PAGE = { w: 297, h: 210, m: 12 };
const BRAND: RGB = [48, 32, 107];
const INK: RGB = [36, 26, 82];
const SOFT: RGB = [91, 86, 118];
const LINE: RGB = [220, 218, 232];
const UNPLACED = '#a5a2b8';

export async function exportPdf(ws: Workspace, options: PdfOptions): Promise<Blob> {
  return (await createPdf(ws, options)).output('blob');
}

export async function createPdf(ws: Workspace, options: PdfOptions, compress = true): Promise<jsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress });
  doc.setProperties({ title: pdfText(`Nine-Box review ${ws.team.name} ${ws.team.period}`.trim()), creator: 'Nine-Box' });

  drawGridPage(doc, ws);
  if (options.calibration) {
    doc.addPage();
    drawCalibrationPage(doc, autoTable, ws, options);
  }
  if (options.team && ws.members.length > 0) {
    doc.addPage();
    drawTeamPage(doc, autoTable, ws, options);
  }
  if (options.notes) {
    doc.addPage();
    drawNotesPage(doc, autoTable, ws);
  }
  drawFooters(doc, ws);
  return doc;
}

// The built-in PDF fonts only cover Windows-1252 (all French and English
// letters). Anything else is simplified so it never prints as garbage.
const WIN_ANSI_EXTRA = new Set(
  [0x20ac, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x17d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x17e, 0x178],
);
const REPLACEMENTS: Record<string, string> = { '→': '->', '←': '<-', '−': '-', ' ': ' ', ' ': ' ', '✎': '' };

export function pdfText(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (ch === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(code)) {
      out += ch;
    } else if (ch in REPLACEMENTS) {
      out += REPLACEMENTS[ch];
    } else {
      const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += [...plain].every((c) => c.charCodeAt(0) < 0x7f) && plain ? plain : '?';
    }
  }
  return out;
}

function rgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function font(doc: jsPDF, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: RGB = INK) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** Shortens text with an ellipsis so it fits in `width` mm with the current font. */
function fit(doc: jsPDF, text: string, width: number): string {
  let s = pdfText(text);
  if (doc.getTextWidth(s) <= width) return s;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > width) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Same figure as in the app: a head and shoulders inside a tinted circle. */
function drawAvatar(doc: jsPDF, cx: number, cy: number, r: number, color: string) {
  doc.setFillColor(...rgb(tint(color, 0.78)));
  doc.circle(cx, cy, r, 'F');
  doc.saveGraphicsState();
  doc.circle(cx, cy, r, null);
  doc.clip();
  doc.discardPath();
  doc.setFillColor(...rgb(color));
  doc.circle(cx, cy - r * 0.225, r * 0.36, 'F');
  doc.ellipse(cx, cy + r * 0.85, r * 0.78, r * 0.62, 'F');
  doc.restoreGraphicsState();
}

function drawArrow(doc: jsPDF, x1: number, y1: number, x2: number, y2: number) {
  doc.setDrawColor(...BRAND);
  doc.setFillColor(...BRAND);
  doc.setLineWidth(0.35);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  const head = 1.8;
  doc.line(x1, y1, x2 - ux * head, y2 - uy * head);
  doc.triangle(x2, y2, x2 - ux * head - uy * 1, y2 - uy * head + ux * 1, x2 - ux * head + uy * 1, y2 - uy * head - ux * 1, 'F');
}

function pageTitle(doc: jsPDF, title: string, ws: Workspace) {
  const { m } = PAGE;
  font(doc, 15, 'bold', BRAND);
  doc.text(fit(doc, title, PAGE.w - 2 * m), m, m + 5);
  font(doc, 8.5, 'normal', SOFT);
  const meta = [
    ws.team.name && `Team: ${ws.team.name}`,
    ws.team.manager && `Manager: ${ws.team.manager}`,
    ws.team.period && `Review period: ${ws.team.period}`,
    `Exported ${new Date().toLocaleDateString()}`,
  ].filter(Boolean);
  doc.text(fit(doc, meta.join('   ·   '), PAGE.w - 2 * m), m, m + 10.5);
}

interface Placed {
  name: string;
  color: string;
  adjusted: boolean;
}

function drawGridPage(doc: jsPDF, ws: Workspace) {
  const { settings } = ws;
  const { w, h, m } = PAGE;

  // Tier legend on the right of the title line, laid out right to left; the title gets what is left.
  font(doc, 7.5, 'bold');
  let lx = w - m;
  for (const tier of [...settings.tiers].reverse()) {
    const label = pdfText(`${tier.name} ${formatPercent(tier.target)}`);
    lx -= doc.getTextWidth(label);
    doc.setTextColor(...rgb(shade(tier.color, 0.45)));
    doc.text(label, lx, m + 4.8);
    drawAvatar(doc, lx - 3, m + 3.6, 1.8, tier.color);
    lx -= 9;
  }
  font(doc, 15, 'bold', BRAND);
  doc.text(fit(doc, `Nine-Box grid${ws.team.name ? ` — ${ws.team.name}` : ''}`, lx - m - 4), m, m + 5);
  font(doc, 8.5, 'normal', SOFT);
  const placed = ws.members.filter((mem) => memberBox(mem) !== null).length;
  const meta = [
    ws.team.manager && `Manager: ${ws.team.manager}`,
    ws.team.period && `Review period: ${ws.team.period}`,
    `${placed} of ${ws.members.length} people placed`,
    `Exported ${new Date().toLocaleDateString()}`,
  ].filter(Boolean);
  doc.text(fit(doc, meta.join('   ·   '), w - 2 * m), m, m + 10.5);

  const axisW = 8;
  const labelW = 25;
  const gap = 2.5;
  const top = m + 16;
  const left = m + axisW + labelW;
  const right = w - m;
  const bottom = h - m - 7 - 16;
  const boxW = (right - left - 2 * gap) / 3;
  const boxH = (bottom - top - 2 * gap) / 3;

  const byBox = new Map<BoxId, Placed[]>();
  for (const mem of ws.members) {
    const box = memberBox(mem);
    if (!box) continue;
    const entry = { name: mem.name || 'Unnamed', color: memberTier(settings, mem)?.color ?? UNPLACED, adjusted: isTierAdjusted(settings, mem) };
    byBox.set(box, [...(byBox.get(box) ?? []), entry]);
  }

  [...LEVELS].reverse().forEach((sf, row) => {
    const y = top + row * (boxH + gap);
    const level = settings.savoirFaire.levels[sf - 1];
    font(doc, 6.5, 'normal', SOFT);
    const desc: string[] = doc.splitTextToSize(pdfText(level.description), labelW - 3).slice(0, 4);
    const ly = y + boxH / 2 - (3.6 + desc.length * 2.8) / 2 + 3;
    desc.forEach((line, i) => doc.text(line, m + axisW, ly + 3.6 + i * 2.8));
    font(doc, 8.5, 'bold');
    doc.text(fit(doc, level.label, labelW - 3), m + axisW, ly);

    LEVELS.forEach((se, col) => {
      const box = ((3 - sf) * 3 + se) as BoxId;
      drawBox(doc, left + col * (boxW + gap), y, boxW, boxH, ws, box, byBox.get(box) ?? []);
    });
  });

  // Horizontal axis: level labels under each column, then the axis name with an arrow.
  LEVELS.forEach((se, col) => {
    const level = settings.savoirEtre.levels[se - 1];
    const cx = left + col * (boxW + gap) + boxW / 2;
    font(doc, 8.5, 'bold');
    doc.text(fit(doc, level.label, boxW), cx, bottom + 4.5, { align: 'center' });
    font(doc, 6.5, 'normal', SOFT);
    doc.text(fit(doc, level.description, boxW), cx, bottom + 7.8, { align: 'center' });
  });
  font(doc, 9.5, 'bold', BRAND);
  const xName = pdfText(settings.savoirEtre.name);
  const xMid = (left + right) / 2;
  const xWidth = doc.getTextWidth(xName);
  doc.text(xName, xMid - xWidth / 2, bottom + 13.5);
  drawArrow(doc, xMid + xWidth / 2 + 2, bottom + 12.4, xMid + xWidth / 2 + 16, bottom + 12.4);

  // Vertical axis, written bottom to top.
  const yName = pdfText(settings.savoirFaire.name);
  const yWidth = doc.getTextWidth(yName);
  const yMid = (top + bottom) / 2;
  doc.text(yName, m + 4, yMid + yWidth / 2, { angle: 90 });
  drawArrow(doc, m + 2.9, yMid - yWidth / 2 - 2, m + 2.9, yMid - yWidth / 2 - 16);

  if ([...byBox.values()].some((list) => list.some((p) => p.adjusted))) {
    font(doc, 6.5, 'italic', SOFT);
    doc.text('* tier adjusted during calibration; the figure shows the final tier', right, bottom + 13.5, { align: 'right' });
  }
}

function drawBox(doc: jsPDF, x: number, y: number, bw: number, bh: number, ws: Workspace, box: BoxId, people: Placed[]) {
  const { settings } = ws;
  const config = settings.boxes[box];
  const tier = boxTier(settings, box);
  const color = tier?.color ?? UNPLACED;
  const ink = rgb(shade(color, 0.45));

  doc.setFillColor(...rgb(tint(color, 0.9)));
  doc.setDrawColor(...rgb(tint(color, 0.6)));
  doc.setLineWidth(0.25);
  doc.rect(x, y, bw, bh, 'FD');
  doc.setFillColor(...rgb(color));
  doc.rect(x, y, bw, 1.3, 'F');

  // Head count bubble.
  doc.setFillColor(255, 255, 255);
  doc.circle(x + bw - 4.6, y + 5.4, 2.9, 'FD');
  font(doc, 8, 'bold', ink);
  doc.text(String(people.length), x + bw - 4.6, y + 6.5, { align: 'center' });

  font(doc, 9, 'bold');
  doc.text(fit(doc, config.title, bw - 12), x + 2.5, y + 6.2);
  font(doc, 6.5, 'italic', SOFT);
  doc.text(fit(doc, config.action, bw - 12), x + 2.5, y + 9.6);
  if (tier) {
    font(doc, 6.5, 'bold', ink);
    const label = fit(doc, tier.name, bw - 10);
    doc.setFillColor(...rgb(tint(color, 0.72)));
    doc.roundedRect(x + 2.5, y + 11.2, doc.getTextWidth(label) + 4, 3.8, 1.9, 1.9, 'F');
    doc.text(label, x + 4.5, y + 13.9);
  }

  const areaX = x + 2;
  const areaY = y + 17;
  const areaW = bw - 4;
  const areaH = bh - 17 - 1.5;
  const layout = layoutNames(people.length, areaW, areaH);
  const shown = layout.overflow ? layout.capacity - 1 : people.length;
  const textSize = layout.rowH >= 4.6 ? 7.5 : layout.rowH >= 4 ? 6.8 : 6;
  const r = layout.rowH * 0.36;

  people.slice(0, shown).forEach((person, i) => {
    const col = Math.floor(i / layout.rows);
    const row = i % layout.rows;
    const px = areaX + col * layout.colW;
    const cy = areaY + row * layout.rowH + layout.rowH / 2;
    drawAvatar(doc, px + r, cy, r, person.color);
    font(doc, textSize, 'normal');
    const label = person.adjusted ? `${person.name} *` : person.name;
    doc.text(fit(doc, label, layout.colW - 2 * r - 2.5), px + 2 * r + 1.2, cy + textSize * 0.13);
  });
  if (layout.overflow) {
    const i = shown;
    const col = Math.floor(i / layout.rows);
    const row = i % layout.rows;
    font(doc, textSize, 'italic', SOFT);
    doc.text(`+${people.length - shown} more (see team list)`, areaX + col * layout.colW, areaY + row * layout.rowH + layout.rowH / 2 + textSize * 0.13);
  }
}

/** Picks the roomiest row height and column count that fits every name in the box. */
export function layoutNames(count: number, width: number, height: number) {
  let last = { rowH: 3.5, cols: 1, rows: 1, colW: width };
  for (const rowH of [4.6, 4.0, 3.5]) {
    for (const cols of [1, 2, 3]) {
      const colW = width / cols;
      if (cols > 1 && colW < 22) continue;
      const rows = Math.max(1, Math.floor(height / rowH));
      last = { rowH, cols, rows, colW };
      if (rows * cols >= count) return { ...last, capacity: rows * cols, overflow: false };
    }
  }
  return { ...last, capacity: last.rows * last.cols, overflow: true };
}

const TABLE_STYLE: Partial<UserOptions> = {
  theme: 'grid',
  margin: { left: PAGE.m, right: PAGE.m, bottom: PAGE.m + 6 },
  styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, lineColor: LINE, lineWidth: 0.2, cellPadding: 1.8, valign: 'middle' },
  headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
  footStyles: { fillColor: [240, 239, 246], textColor: INK, fontStyle: 'bold' },
};

/** Tints the cell of column `column` with the tier of each body row. */
function tierCells(tiers: (Tier | null)[], column = 0): Partial<UserOptions> {
  return {
    didParseCell: (data: CellHookData) => {
      const tier = tiers[data.row.index];
      if (data.section !== 'body' || data.column.index !== column || !tier) return;
      data.cell.styles.fillColor = rgb(tint(tier.color, 0.82));
      data.cell.styles.textColor = rgb(shade(tier.color, 0.45));
      data.cell.styles.fontStyle = 'bold';
    },
  };
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? PAGE.m;
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  font(doc, 11, 'bold', BRAND);
  doc.text(pdfText(text), PAGE.m, y);
}

function right(content: string): CellDef {
  return { content: pdfText(content), styles: { halign: 'right' } };
}

function drawCalibrationPage(doc: jsPDF, autoTable: AutoTable, ws: Workspace, options: PdfOptions) {
  const { settings } = ws;
  const cal = calibration(ws);
  const inc = incrementSummary(ws);
  pageTitle(doc, 'Calibration', ws);

  sectionTitle(doc, `Distribution against targets (${cal.total} people)`, PAGE.m + 19);
  const rows: RowInput[] = cal.rows.map((row) => {
    const diff = row.count - row.targetCount;
    const gap = cal.total === 0 || Math.abs(diff) < 1 ? 'On target' : `${diff > 0 ? '+' : '-'}${formatCount(Math.abs(diff))} ${diff > 0 ? 'over' : 'under'}`;
    return [pdfText(row.tier.name), right(formatPercent(row.tier.target)), right(formatCount(row.targetCount)), right(String(row.count)), right(formatPercent(row.percent)), gap];
  });
  const tiers: (Tier | null)[] = cal.rows.map((r) => r.tier);
  if (cal.unplaced > 0) {
    rows.push(['Not placed yet', '', '', right(String(cal.unplaced)), right(formatPercent((cal.unplaced / cal.total) * 100)), '']);
    tiers.push(null);
  }
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: PAGE.m + 22,
    head: [['Tier', right('Target'), right('Target headcount'), right('Actual'), right('Actual %'), 'Gap']],
    body: rows,
    ...tierCells(tiers),
  });
  font(doc, 7.5, 'italic', SOFT);
  doc.text('"On target" means within one person of the target headcount.', PAGE.m, lastY(doc) + 4.5);

  sectionTitle(doc, 'Annual increments', lastY(doc) + 13);
  const money = (n: number) => right(formatMoney(n, settings.currency));
  const incRows = inc.rows.filter((row) => row.tier !== null || row.count > 0);
  const body: RowInput[] = incRows.map((row) => {
    const base: CellInput[] = [row.tier ? pdfText(row.tier.name) : 'Not placed yet', right(String(row.count)), right(row.tier ? formatPercent(row.tier.increment) || 'not set' : '')];
    return options.salaries
      ? [...base, money(row.payroll), money(row.increment), right(row.payroll ? formatPercent((row.increment / row.payroll) * 100) : '')]
      : base;
  });
  const head: CellInput[] = ['Tier', right('Members'), right('Default increment')];
  const foot: CellInput[] = ['Total', right(String(inc.total.count)), ''];
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: lastY(doc) + 16,
    head: [options.salaries ? [...head, right('Current payroll'), right('Increment cost'), right('% of payroll')] : head],
    body,
    foot: [
      options.salaries
        ? [...foot, money(inc.total.payroll), money(inc.total.increment), right(inc.total.payroll ? formatPercent((inc.total.increment / inc.total.payroll) * 100) : '')]
        : foot,
    ],
    ...tierCells(incRows.map((r) => r.tier)),
  });
}

function drawTeamPage(doc: jsPDF, autoTable: AutoTable, ws: Workspace, options: PdfOptions) {
  const { settings } = ws;
  pageTitle(doc, 'Team', ws);
  const head: CellInput[] = ['Name', 'Position', pdfText(settings.savoirEtre.name), pdfText(settings.savoirFaire.name), 'Box', 'Tier', right('Increment')];
  if (options.salaries) head.push(right('Current salary'), right('New salary'));
  head.push('Comments');

  const tiers = ws.members.map((mem) => memberTier(settings, mem));
  const body: RowInput[] = ws.members.map((mem, i) => {
    const box = memberBox(mem);
    const tier = tiers[i];
    const row: CellInput[] = [
      pdfText(mem.name),
      pdfText(mem.position),
      pdfText(levelText(settings, 'savoirEtre', mem.savoirEtre)),
      pdfText(levelText(settings, 'savoirFaire', mem.savoirFaire)),
      box ? pdfText(settings.boxes[box].title) : '',
      tier ? pdfText(tier.name) + (isTierAdjusted(settings, mem) ? ' *' : '') : 'Not placed',
      right(formatPercent(memberIncrement(settings, mem))),
    ];
    if (options.salaries) {
      const amount = incrementAmount(settings, mem);
      row.push(right(formatMoney(mem.salary, settings.currency)), right(amount === null ? '' : formatMoney(newSalary(settings, mem), settings.currency)));
    }
    row.push(pdfText(mem.comment));
    return row;
  });

  autoTable(doc, {
    ...TABLE_STYLE,
    startY: PAGE.m + 15,
    head: [head],
    body,
    columnStyles: { [head.length - 1]: { cellWidth: options.salaries ? 55 : 80 } },
    ...tierCells(tiers, 5),
  });
  if (ws.members.some((mem) => isTierAdjusted(settings, mem))) {
    font(doc, 7.5, 'italic', SOFT);
    doc.text('* tier adjusted during calibration', PAGE.m, lastY(doc) + 4.5);
  }
}

function drawNotesPage(doc: jsPDF, autoTable: AutoTable, ws: Workspace) {
  pageTitle(doc, 'Guiding questions', ws);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: PAGE.m + 15,
    head: [['Topic', 'Question', 'Notes']],
    body: GUIDING_QUESTIONS.map((q) => [
      { content: pdfText(q.title), styles: { fontStyle: 'bold' } },
      { content: pdfText(q.question), styles: { textColor: SOFT } },
      pdfText(ws.notes[q.id] ?? ''),
    ]),
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 100 } },
    styles: { ...TABLE_STYLE.styles, valign: 'top' },
  });
}

function drawFooters(doc: jsPDF, ws: Workspace) {
  const total = doc.getNumberOfPages();
  const label = ['Confidential', ws.team.name, ws.team.period].filter(Boolean).join('  ·  ');
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    font(doc, 7, 'normal', SOFT);
    doc.text(fit(doc, label, 200), PAGE.m, PAGE.h - 6);
    doc.text(`Page ${i} of ${total}`, PAGE.w - PAGE.m, PAGE.h - 6, { align: 'right' });
  }
}
