export const FATE_KNOTS_IMAGE_SHEET_MAX_CELLS = 8;

export type FateKnotsImageSheetPurpose =
  "card-art" | "portrait" | "item-art" | "scene-detail" | "icon-art";

export interface FateKnotsImageSheetCell {
  slotId: string;
  contentRefId: string;
  outputAssetId: string;
  row: number;
  column: number;
}

export interface FateKnotsImageSheetDefinition {
  sheetId: string;
  purpose: FateKnotsImageSheetPurpose;
  sourceAssetId: string;
  columns: number;
  rows: number;
  /**
   * Fraction removed from every side of an equal grid cell after splitting.
   * A small inset protects extracted art from separator/gutter bleed.
   */
  safeInsetRatio: number;
  cells: FateKnotsImageSheetCell[];
}

export interface FateKnotsNormalizedCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FateKnotsImageSheetIssueCode =
  | "invalid-grid"
  | "too-many-cells"
  | "invalid-safe-inset"
  | "duplicate-slot"
  | "duplicate-output-asset"
  | "cell-out-of-grid";

export interface FateKnotsImageSheetIssue {
  code: FateKnotsImageSheetIssueCode;
  slotId?: string;
}

export interface FateKnotsImageSheetValidationResult {
  valid: boolean;
  issues: FateKnotsImageSheetIssue[];
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * V1 intentionally caps one generated sheet at eight useful cells. Six or eight
 * illustrations per request are the preferred batch sizes: large enough to cut
 * generation calls, small enough that individual subjects still receive useful
 * image area and can be regenerated independently when one cell is poor.
 */
export function validateFateKnotsImageSheet(
  sheet: FateKnotsImageSheetDefinition
): FateKnotsImageSheetValidationResult {
  const issues: FateKnotsImageSheetIssue[] = [];
  const capacity = sheet.columns * sheet.rows;

  if (
    !Number.isInteger(sheet.columns) ||
    !Number.isInteger(sheet.rows) ||
    sheet.columns <= 0 ||
    sheet.rows <= 0
  ) {
    issues.push({ code: "invalid-grid" });
  }

  if (capacity > FATE_KNOTS_IMAGE_SHEET_MAX_CELLS || sheet.cells.length > capacity) {
    issues.push({ code: "too-many-cells" });
  }

  if (
    !Number.isFinite(sheet.safeInsetRatio) ||
    sheet.safeInsetRatio < 0 ||
    sheet.safeInsetRatio >= 0.25
  ) {
    issues.push({ code: "invalid-safe-inset" });
  }

  if (hasDuplicate(sheet.cells.map((cell) => cell.slotId))) {
    issues.push({ code: "duplicate-slot" });
  }
  if (hasDuplicate(sheet.cells.map((cell) => cell.outputAssetId))) {
    issues.push({ code: "duplicate-output-asset" });
  }

  for (const cell of sheet.cells) {
    if (
      !Number.isInteger(cell.row) ||
      !Number.isInteger(cell.column) ||
      cell.row < 0 ||
      cell.column < 0 ||
      cell.row >= sheet.rows ||
      cell.column >= sheet.columns
    ) {
      issues.push({ code: "cell-out-of-grid", slotId: cell.slotId });
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Returns a provider-independent normalized crop rectangle for one equal-grid
 * cell. The actual image adapter may translate this rectangle into pixels and
 * write the extracted image as `outputAssetId`.
 */
export function getFateKnotsImageSheetCropRect(
  sheet: FateKnotsImageSheetDefinition,
  slotId: string
): FateKnotsNormalizedCropRect | null {
  const validation = validateFateKnotsImageSheet(sheet);
  if (!validation.valid) return null;

  const cell = sheet.cells.find((candidate) => candidate.slotId === slotId);
  if (!cell) return null;

  const cellWidth = 1 / sheet.columns;
  const cellHeight = 1 / sheet.rows;
  const insetX = cellWidth * sheet.safeInsetRatio;
  const insetY = cellHeight * sheet.safeInsetRatio;

  return {
    x: cell.column * cellWidth + insetX,
    y: cell.row * cellHeight + insetY,
    width: cellWidth - insetX * 2,
    height: cellHeight - insetY * 2,
  };
}

/**
 * Image-generation prompt contract for sheet mode.
 *
 * The generated cells should contain illustration only. Card title, rules text,
 * frame, cost icons and other precise UI are rendered by Fate Knots after crop.
 * This avoids asking an image model to reproduce exact typography eight times
 * and lets one universe-specific art batch feed the normal card renderer.
 */
export const FATE_KNOTS_IMAGE_SHEET_PROMPT_RULES = [
  "equal rectangular grid",
  "one self-contained illustration per cell",
  "consistent universe art direction across cells",
  "clear separation between cells",
  "no typography",
  "no card frame",
  "no UI icons",
  "no subject crossing cell boundaries",
] as const;
