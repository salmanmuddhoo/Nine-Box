import type * as ExcelJSModule from 'exceljs';

export type ExcelJS = typeof ExcelJSModule;

let loaded: Promise<ExcelJS> | null = null;

/** ExcelJS is large, so it is only loaded the first time a file is imported or exported. */
export function loadExcelJS(): Promise<ExcelJS> {
  loaded ??= import('exceljs').then((mod) => ((mod as { default?: ExcelJS }).default ?? mod) as ExcelJS);
  return loaded;
}

/** Name of the hidden sheet that carries the full workspace, so exported workbooks can be reopened. */
export const DATA_SHEET = '_nine-box';

/** Excel limits a cell to 32,767 characters. */
export const DATA_CHUNK = 30000;
