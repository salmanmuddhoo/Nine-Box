import type { jsPDF } from 'jspdf';
import type { CellDef, CellHookData, RowInput, UserOptions } from 'jspdf-autotable';
import { shade, tint } from '../colors';
import { formatCount, formatPercent } from '../format';
import { boxOf, boxTier, calibration, incrementSummary, isTierAdjusted, memberBox, memberTier } from '../model/logic';
import { LEVELS, type BoxId, type Tier, type Workspace } from '../model/types';

export interface PdfOptions {
  /** Add a page with the distribution against targets and increments per tier. */
  calibration: boolean;
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

  drawTreePages(doc, ws);
  doc.addPage();
  drawGridPage(doc, ws);
  if (options.calibration) {
    doc.addPage();
    drawCalibrationPage(doc, autoTable, ws);
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

// Card sizes for the team tree, largest first; the first one that fits the team is used.
const TREE_SIZES = [
  { w: 31, h: 25, gapX: 3.5, gapY: 9, scale: 1 },
  { w: 27, h: 22.5, gapX: 3, gapY: 8, scale: 0.88 },
  { w: 23.5, h: 20, gapX: 2.5, gapY: 7, scale: 0.78 },
  { w: 20.5, h: 18, gapX: 2, gapY: 6, scale: 0.7 },
];

/**
 * Lays out `count` cards under the manager in `width` × `height` mm. With
 * several rows the column count is even, so the trunk from the manager runs
 * between two cards. `perPage` is below `count` only when even the smallest
 * cards do not fit, in which case the tree continues on further pages.
 */
export function layoutTree(count: number, width: number, height: number) {
  const fit = (size: (typeof TREE_SIZES)[number]) => ({
    maxCols: Math.max(2, Math.floor((width + size.gapX) / (size.w + size.gapX))),
    maxRows: Math.max(1, Math.floor((height + size.gapY) / (size.h + size.gapY))),
  });
  for (const size of TREE_SIZES) {
    const { maxCols, maxRows } = fit(size);
    if (count <= maxCols) return { ...size, cols: Math.max(1, count), rows: 1, perPage: count };
    const evenCols = maxCols - (maxCols % 2);
    if (Math.ceil(count / evenCols) <= maxRows) {
      // Balance the rows, then round up to an even number of columns.
      let cols = Math.ceil(count / Math.ceil(count / evenCols));
      cols += cols % 2;
      return { ...size, cols, rows: Math.ceil(count / cols), perPage: count };
    }
  }
  const size = TREE_SIZES[TREE_SIZES.length - 1];
  const { maxCols, maxRows } = fit(size);
  const cols = maxCols - (maxCols % 2);
  return { ...size, cols, rows: maxRows, perPage: cols * maxRows };
}

const TRUNK: RGB = [150, 144, 184];

function drawTreePages(doc: jsPDF, ws: Workspace) {
  const { w, h, m } = PAGE;
  const managerW = 66;
  const managerH = 16;
  const managerY = m + 17;
  const top = managerY + managerH + 10;
  const bottom = h - m - 9;
  const layout = layoutTree(ws.members.length, w - 2 * m, bottom - top);
  const pages = Math.max(1, Math.ceil(ws.members.length / Math.max(1, layout.perPage)));

  for (let page = 0; page < pages; page++) {
    if (page > 0) doc.addPage();
    legendHeader(doc, 'Team', ws);
    const cx = w / 2;
    drawManagerCard(doc, cx - managerW / 2, managerY, managerW, managerH, ws, page > 0);

    const people = ws.members.slice(page * layout.perPage, (page + 1) * layout.perPage);
    if (people.length === 0) {
      font(doc, 9, 'italic', SOFT);
      doc.text('No team members yet.', cx, top + 10, { align: 'center' });
      continue;
    }

    const rows: (typeof people)[] = [];
    for (let i = 0; i < people.length; i += layout.cols) rows.push(people.slice(i, i + layout.cols));
    const busY = (r: number) => top + r * (layout.h + layout.gapY) - Math.min(4, layout.gapY / 2);

    doc.setDrawColor(...TRUNK);
    doc.setLineWidth(0.3);
    doc.line(cx, managerY + managerH, cx, busY(rows.length - 1));
    rows.forEach((row, r) => {
      const rowW = row.length * layout.w + (row.length - 1) * layout.gapX;
      const x0 = cx - rowW / 2;
      const y = top + r * (layout.h + layout.gapY);
      const centers = row.map((_, i) => x0 + i * (layout.w + layout.gapX) + layout.w / 2);
      doc.setDrawColor(...TRUNK);
      doc.setLineWidth(0.3);
      doc.line(centers[0], busY(r), centers[centers.length - 1], busY(r));
      for (const c of centers) doc.line(c, busY(r), c, y);
      row.forEach((member, i) => drawPersonCard(doc, centers[i] - layout.w / 2, y, layout, ws, member));
    });

    if (people.some((mem) => isTierAdjusted(ws.settings, mem))) {
      font(doc, 6.5, 'italic', SOFT);
      doc.text('* tier adjusted during calibration', w - m, bottom + 2, { align: 'right' });
    }
  }
}

function drawManagerCard(doc: jsPDF, x: number, y: number, cw: number, ch: number, ws: Workspace, continued: boolean) {
  const brand = '#30206B';
  doc.setFillColor(...rgb(tint(brand, 0.92)));
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, cw, ch, 2, 2, 'FD');
  const r = 4.6;
  drawAvatar(doc, x + 3.5 + r, y + ch / 2, r, brand);
  const tx = x + 3.5 + 2 * r + 3;
  const tw = cw - (tx - x) - 3;
  font(doc, 10, 'bold');
  doc.text(fit(doc, ws.team.manager || 'Team manager', tw), tx, y + 7);
  font(doc, 7, 'normal', SOFT);
  const role = ['Team manager', ws.team.name, continued ? '(continued)' : ''].filter(Boolean).join(' · ');
  doc.text(fit(doc, role, tw), tx, y + 11.5);
}

function drawPersonCard(
  doc: jsPDF,
  x: number,
  y: number,
  size: { w: number; h: number; scale: number },
  ws: Workspace,
  member: Workspace['members'][number],
) {
  const { settings } = ws;
  const { w: cw, h: ch, scale } = size;
  const tier = memberTier(settings, member);
  const color = tier?.color ?? UNPLACED;
  const bandH = 5.4 * scale;
  const cx = x + cw / 2;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...rgb(tint(color, 0.45)));
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, cw, ch, 1.5, 1.5, 'FD');
  // Tier band along the bottom: rounded at the bottom only.
  doc.setFillColor(...rgb(tint(color, 0.75)));
  doc.roundedRect(x, y + ch - bandH, cw, bandH, 1.5, 1.5, 'F');
  doc.rect(x, y + ch - bandH, cw, bandH / 2, 'F');
  doc.roundedRect(x, y, cw, ch, 1.5, 1.5, 'S');

  const r = 3.4 * scale;
  drawAvatar(doc, cx, y + 2 * scale + r, r, color);

  font(doc, 7 * scale, 'bold');
  const lines: string[] = doc.splitTextToSize(pdfText(member.name || 'Unnamed'), cw - 3);
  const nameLines = lines.length > 2 ? [lines[0], fit(doc, lines.slice(1).join(' '), cw - 3)] : lines;
  let ty = y + 2 * scale + 2 * r + 3.1 * scale;
  for (const line of nameLines) {
    doc.text(line, cx, ty, { align: 'center' });
    ty += 2.9 * scale;
  }
  if (member.position) {
    font(doc, 5.6 * scale, 'normal', SOFT);
    doc.text(fit(doc, member.position, cw - 3), cx, ty + 0.2 * scale, { align: 'center' });
  }

  font(doc, 6 * scale, 'bold', rgb(shade(color, 0.45)));
  const label = tier ? `${tier.name}${isTierAdjusted(settings, member) ? ' *' : ''}` : 'Not placed';
  doc.text(fit(doc, label, cw - 2), cx, y + ch - bandH / 2 + 0.75 * scale, { align: 'center' });
}

interface Placed {
  name: string;
  color: string;
  adjusted: boolean;
}

/** Title with the tier legend on its right, then a line of details. */
function legendHeader(doc: jsPDF, title: string, ws: Workspace) {
  const { w, m } = PAGE;
  // The legend is laid out right to left; the title gets what is left.
  font(doc, 7.5, 'bold');
  let lx = w - m;
  for (const tier of [...ws.settings.tiers].reverse()) {
    const label = pdfText(`${tier.name} ${formatPercent(tier.target)}`);
    lx -= doc.getTextWidth(label);
    doc.setTextColor(...rgb(shade(tier.color, 0.45)));
    doc.text(label, lx, m + 4.8);
    drawAvatar(doc, lx - 3, m + 3.6, 1.8, tier.color);
    lx -= 9;
  }
  font(doc, 15, 'bold', BRAND);
  doc.text(fit(doc, `${title}${ws.team.name ? ` — ${ws.team.name}` : ''}`, lx - m - 4), m, m + 5);
  font(doc, 8.5, 'normal', SOFT);
  const placed = ws.members.filter((mem) => memberBox(mem) !== null).length;
  const meta = [
    ws.team.manager && `Manager: ${ws.team.manager}`,
    ws.team.period && `Review period: ${ws.team.period}`,
    `${placed} of ${ws.members.length} people placed`,
    `Exported ${new Date().toLocaleDateString()}`,
  ].filter(Boolean);
  doc.text(fit(doc, meta.join('   ·   '), w - 2 * m), m, m + 10.5);
}

function drawGridPage(doc: jsPDF, ws: Workspace) {
  const { settings } = ws;
  const { w, h, m } = PAGE;
  legendHeader(doc, 'Nine-Box grid', ws);

  const n = LEVELS.length;
  const axisW = 8;
  const labelW = 25;
  const gap = 2.5;
  const top = m + 16;
  const left = m + axisW + labelW;
  const right = w - m;
  const bottom = h - m - 7 - 16;
  const boxW = (right - left - (n - 1) * gap) / n;
  const boxH = (bottom - top - (n - 1) * gap) / n;

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
      const box = boxOf(se, sf)!;
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
  doc.circle(x + bw - 4, y + 4.9, 2.5, 'FD');
  font(doc, 7.5, 'bold', ink);
  doc.text(String(people.length), x + bw - 4, y + 5.9, { align: 'center' });

  font(doc, 8, 'bold');
  doc.text(fit(doc, config.title, bw - 10), x + 2, y + 5.4);
  font(doc, 6, 'italic', SOFT);
  doc.text(fit(doc, config.action, bw - 10), x + 2, y + 8.6);
  if (tier) {
    font(doc, 6, 'bold', ink);
    const label = fit(doc, tier.name, bw - 8);
    doc.setFillColor(...rgb(tint(color, 0.72)));
    doc.roundedRect(x + 2, y + 10, doc.getTextWidth(label) + 3.6, 3.5, 1.75, 1.75, 'F');
    doc.text(label, x + 3.8, y + 12.5);
  }

  const areaX = x + 1.6;
  const areaY = y + 14.8;
  const areaW = bw - 3.2;
  const areaH = bh - 14.8 - 1.2;
  const layout = layoutNames(people.length, areaW, areaH);
  const shown = layout.overflow ? layout.capacity - 1 : people.length;
  const textSize = layout.rowH >= 4.6 ? 7.2 : layout.rowH >= 4 ? 6.6 : layout.rowH >= 3.5 ? 6 : 5.4;
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
    doc.text(`+${people.length - shown} more`, areaX + col * layout.colW, areaY + row * layout.rowH + layout.rowH / 2 + textSize * 0.13);
  }
}

/** Picks the roomiest row height and column count that fits every name in the box. */
export function layoutNames(count: number, width: number, height: number) {
  let last = { rowH: 3, cols: 1, rows: 1, colW: width };
  for (const rowH of [4.6, 4.0, 3.5, 3.0]) {
    for (const cols of [1, 2, 3]) {
      const colW = width / cols;
      if (cols > 1 && colW < 17) continue;
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

function drawCalibrationPage(doc: jsPDF, autoTable: AutoTable, ws: Workspace) {
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
  const incRows = inc.rows.filter((row) => row.tier !== null || row.count > 0);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: lastY(doc) + 16,
    head: [['Tier', right('Members'), right('Default increment'), right('Average increment')]],
    body: incRows.map((row) => [
      row.tier ? pdfText(row.tier.name) : 'Not placed yet',
      right(String(row.count)),
      right(row.tier ? formatPercent(row.tier.increment) || 'not set' : ''),
      right(formatPercent(row.average)),
    ]),
    foot: [['Total', right(String(inc.total.count)), '', right(formatPercent(inc.total.average))]],
    ...tierCells(incRows.map((r) => r.tier)),
  });
  font(doc, 7.5, 'italic', SOFT);
  doc.text("Average increment is the simple average of each person's increment %.", PAGE.m, lastY(doc) + 4.5);
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
