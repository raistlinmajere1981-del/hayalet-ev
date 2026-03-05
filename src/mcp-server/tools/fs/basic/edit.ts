/**
 * Advanced File Edit Operations
 *
 * Pattern-based dosya edit with safety features:
 * - Atomic mode (all_or_nothing): Tek edit fail olursa hiçbiri yazılmaz
 * - Overlap/conflict detection: Edit çakışmaları apply öncesi yakalanır
 * - Format-preserving whitespace matching: Esnek eşleşme, orijinal format korunur
 * - Line-ending normalization: LF/CRLF/auto/preserve
 * - Match scope control: first/last/all/indexes
 * - Rich output: Her edit için satır, match count, süre bilgisi
 *
 * @module fs/basic/edit
 */

import { readFile, writeFile } from "fs/promises";
import { logToolError } from "../../../utils/mcp-logger.js";
import { diffContent } from "../../../utils/diff-utils.js";
import { countBracketsContextAware } from "../../dev/structure-visualizer.js";
import type { ToolResult } from "@shared/index-mcp.js";

// ============================================
// Types & Interfaces
// ============================================

export type MatchScope = "first" | "last" | "all";
export type EOLMode = "lf" | "crlf" | "auto" | "preserve";

export interface FileEdit {
  old_text: string;
  new_text: string;
}

export interface EditFileOptions {
  file_path: string;
  edits: FileEdit[];
  dry_run?: boolean;
  ignore_whitespace?: boolean;
  all_or_nothing?: boolean;
  match_scope?: MatchScope | number[];
  normalize_eol?: EOLMode;
}

export interface EditMatchInfo {
  line: number;
  column: number;
  length: number;
}

export interface EditResult {
  index: number;
  edit: FileEdit;
  replacements: number;
  success: boolean;
  error?: string;
  matches?: EditMatchInfo[];
}

interface ApplyEditResult extends EditResult {
  newContent?: string;
}

interface ConflictInfo {
  editA: number;
  editB: number;
  reason: string;
}
// ============================================
// EOL Utilities
// ============================================

function detectEOL(content: string): "lf" | "crlf" {
  const crlfCount = (content.match(/\r\n/g) ?? []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) ?? []).length;
  return crlfCount > lfCount ? "crlf" : "lf";
}

function normalizeEOL(content: string, mode: EOLMode): string {
  if (mode === "preserve") return content;
  const target = mode === "auto" ? detectEOL(content) : mode;
  // First normalize everything to LF, then convert to target
  const normalized = content.replace(/\r\n/g, "\n");
  return target === "crlf" ? normalized.replace(/\n/g, "\r\n") : normalized;
}

// ============================================
// Conflict Detection (P0)
// ============================================

/**
 * Detect overlapping/conflicting edits before applying.
 * Two edits conflict if:
 *  1. They target the exact same old_text
 *  2. One edit's old_text contains another's old_text (subset conflict)
 *  3. One edit's old_text overlaps with another in the source content
 */
function detectConflicts(content: string, edits: FileEdit[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < edits.length; i++) {
    const editA = edits[i];
    if (!editA) continue;
    for (let j = i + 1; j < edits.length; j++) {
      const editB = edits[j];
      if (!editB) continue;

      // Case 1: Identical old_text
      if (editA.old_text === editB.old_text) {
        conflicts.push({
          editA: i,
          editB: j,
          reason: `Aynı old_text hedeflenmiş: "${editA.old_text.slice(0, 40)}${editA.old_text.length > 40 ? "..." : ""}"`,
        });
        continue;
      }

      // Case 2: Subset — one contains the other
      if (editA.old_text.includes(editB.old_text)) {
        conflicts.push({
          editA: i,
          editB: j,
          reason: `Edit ${j + 1}'in old_text'i Edit ${i + 1}'in old_text'inin alt kümesi`,
        });
        continue;
      }
      if (editB.old_text.includes(editA.old_text)) {
        conflicts.push({
          editA: i,
          editB: j,
          reason: `Edit ${i + 1}'in old_text'i Edit ${j + 1}'in old_text'inin alt kümesi`,
        });
        continue;
      }

      // Case 3: Overlapping ranges in content
      const positionsA = findAllPositions(content, editA.old_text);
      const positionsB = findAllPositions(content, editB.old_text);

      for (const posA of positionsA) {
        for (const posB of positionsB) {
          const endA = posA + editA.old_text.length;
          const endB = posB + editB.old_text.length;
          if (posA < endB && posB < endA) {
            conflicts.push({
              editA: i,
              editB: j,
              reason: `Çakışan aralıklar: Edit ${i + 1} [${posA}:${endA}] vs Edit ${j + 1} [${posB}:${endB}]`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

function findAllPositions(content: string, search: string): number[] {
  const positions: number[] = [];
  let idx = content.indexOf(search);
  while (idx !== -1) {
    positions.push(idx);
    idx = content.indexOf(search, idx + 1);
  }
  return positions;
}
// ============================================
// Match Utilities
// ============================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find line/column info for all occurrences of a pattern in content
 */
function findMatchInfo(content: string, search: string): EditMatchInfo[] {
  const matches: EditMatchInfo[] = [];
  let idx = content.indexOf(search);
  while (idx !== -1) {
    const before = content.slice(0, idx);
    const line = (before.match(/\n/g) ?? []).length + 1;
    const lastNewline = before.lastIndexOf("\n");
    const column = idx - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;
    matches.push({ line, column, length: search.length });
    idx = content.indexOf(search, idx + 1);
  }
  return matches;
}

/**
 * Find match info using whitespace-insensitive regex
 */
function findMatchInfoRegex(content: string, regex: RegExp): EditMatchInfo[] {
  const matches: EditMatchInfo[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(0, m.index);
    const line = (before.match(/\n/g) ?? []).length + 1;
    const lastNewline = before.lastIndexOf("\n");
    const column = m.index - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;
    matches.push({ line, column, length: m[0].length });
  }
  return matches;
}

// ============================================
// Scope Filtering
// ============================================

/**
 * Filter match indices based on match_scope setting.
 * Returns which occurrence indices (0-based) to actually replace.
 */
function filterByScope(totalMatches: number, scope: MatchScope | number[]): number[] {
  if (Array.isArray(scope)) {
    // Validate and clamp indices
    return scope.filter((i) => i >= 0 && i < totalMatches);
  }
  switch (scope) {
    case "first":
      return totalMatches > 0 ? [0] : [];
    case "last":
      return totalMatches > 0 ? [totalMatches - 1] : [];
    case "all":
      return Array.from({ length: totalMatches }, (_, i) => i);
    default:
      return [];
  }
}
// ============================================
// Edit Logic
// ============================================

/**
 * Apply a single edit to content with scope and whitespace options.
 *
 * Format-preserving whitespace (P1):
 * When ignore_whitespace=true, we match flexibly but preserve the
 * original indentation/spacing structure. We do this by capturing
 * whitespace segments and replaying them into new_text.
 */
function applyEdit(
  content: string,
  edit: FileEdit,
  index: number,
  ignoreWhitespace: boolean,
  scope: MatchScope | number[]
): ApplyEditResult {
  const { old_text: oldText } = edit;

  if (oldText === "") {
    return {
      index,
      edit,
      replacements: 0,
      success: false,
      error: "old_text bo\u015f olamaz",
    };
  }

  if (ignoreWhitespace) {
    return applyEditWhitespaceInsensitive(content, edit, index, scope);
  }

  return applyEditExact(content, edit, index, scope);
}

/**
 * Exact match edit with scope support
 */
function applyEditExact(
  content: string,
  edit: FileEdit,
  index: number,
  scope: MatchScope | number[]
): ApplyEditResult {
  const { old_text: oldText, new_text: newText } = edit;
  const allMatches = findMatchInfo(content, oldText);
  const totalMatches = allMatches.length;

  if (totalMatches === 0) {
    return {
      index,
      edit,
      replacements: 0,
      success: false,
      error: "Pattern bulunamad\u0131 (exact match)",
    };
  }

  const selectedIndices = filterByScope(totalMatches, scope);
  if (selectedIndices.length === 0) {
    return {
      index,
      edit,
      replacements: 0,
      success: false,
      error: `Scope ile e\u015fle\u015fen occurrence yok (toplam ${totalMatches} match, scope: ${JSON.stringify(scope)})`,
    };
  }

  // Build new content by replacing only selected occurrences
  let newContent = "";
  let lastEnd = 0;
  let replaced = 0;
  const positions = findAllPositions(content, oldText);

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (pos === undefined) continue;
    if (selectedIndices.includes(i)) {
      newContent += content.slice(lastEnd, pos) + newText;
      replaced++;
    } else {
      newContent += content.slice(lastEnd, pos) + oldText;
    }
    lastEnd = pos + oldText.length;
  }
  newContent += content.slice(lastEnd);

  return {
    index,
    edit,
    replacements: replaced,
    success: true,
    newContent,
    matches: selectedIndices
      .map((i) => allMatches[i])
      .filter((m): m is EditMatchInfo => m !== undefined),
  };
}

/**
 * Whitespace-insensitive match with format-preserving replace (P1).
 *
 * Strategy: Match flexibly using \\s+ regex, but when replacing,
 * preserve the leading indentation of the matched block.
 */
function applyEditWhitespaceInsensitive(
  content: string,
  edit: FileEdit,
  index: number,
  scope: MatchScope | number[]
): ApplyEditResult {
  const { old_text: oldText, new_text: newText } = edit;

  // Build whitespace-flexible regex
  const pattern = escapeRegex(oldText).replace(/\\s\+/g, "\\s+").replace(/\s+/g, "\\s+");
  const regex = new RegExp(pattern, "g");

  const allMatches = findMatchInfoRegex(content, regex);
  const totalMatches = allMatches.length;

  if (totalMatches === 0) {
    return {
      index,
      edit,
      replacements: 0,
      success: false,
      error: "Pattern bulunamad\u0131 (whitespace-insensitive)",
    };
  }

  const selectedIndices = filterByScope(totalMatches, scope);
  if (selectedIndices.length === 0) {
    return {
      index,
      edit,
      replacements: 0,
      success: false,
      error: `Scope ile e\u015fle\u015fen occurrence yok (toplam ${totalMatches} match, scope: ${JSON.stringify(scope)})`,
    };
  }

  // Replace selected occurrences, preserving original indentation
  let matchIndex = 0;
  let replaced = 0;
  const newContent = content.replace(regex, (matched, offset) => {
    const currentIndex = matchIndex++;
    if (!selectedIndices.includes(currentIndex)) {
      return matched; // Keep original
    }
    replaced++;

    // Preserve leading indentation from original matched text
    const offsetNumber = typeof offset === "number" ? offset : 0;
    const beforeMatch = content.slice(0, offsetNumber);
    const lastNewline = beforeMatch.lastIndexOf("\n");
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const leadingIndent = content.slice(lineStart, offsetNumber).match(/^(\s*)/)?.[1] ?? "";

    // If new_text is multi-line, apply the same base indentation
    if (newText.includes("\n")) {
      const oldIndent = oldText.match(/^(\s*)/)?.[1] ?? "";
      const lines = newText.split("\n");
      const adjusted = lines.map((line, i) => {
        if (i === 0) return line; // First line gets position from match
        // Strip old indent, add matched indent
        if (line.startsWith(oldIndent)) {
          return leadingIndent + line.slice(oldIndent.length);
        }
        return leadingIndent + line;
      });
      return adjusted.join("\n");
    }

    return newText;
  });

  return {
    index,
    edit,
    replacements: replaced,
    success: true,
    newContent,
    matches: selectedIndices
      .map((i) => allMatches[i])
      .filter((m): m is EditMatchInfo => m !== undefined),
  };
}
// ============================================
// Bracket Balance Check (countBracketsContextAware kullanır)
// ============================================

function checkBracketBalance(content: string): { ok: boolean; detail?: string } {
  const result = countBracketsContextAware(content);

  if (result.balanced) {
    return { ok: true };
  }

  // Detaylı hata mesajı oluştur
  const details: string[] = [];
  const pairs: Array<{ open: string; close: string; name: string }> = [
    { open: "(", close: ")", name: "Parantez" },
    { open: "{", close: "}", name: "Süslü Parantez" },
    { open: "[", close: "]", name: "Köşeli Parantez" },
  ];

  for (const pair of pairs) {
    const openCount = result.open[pair.open]?.length ?? 0;
    const closeCount = result.close[pair.close]?.length ?? 0;
    if (openCount !== closeCount) {
      const diff = Math.abs(openCount - closeCount);
      const missing = openCount > closeCount ? pair.close : pair.open;
      details.push(
        `${pair.name}: ${diff} adet '${missing}' ${openCount > closeCount ? "eksik" : "fazla"}`
      );
    }
  }

  return { ok: false, detail: details.join(", ") };
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Apply multiple edits to a file with pattern matching.
 * Supports atomic mode, conflict detection, scope control,
 * EOL normalization, and format-preserving whitespace matching.
 */
export async function editFileContent(options: EditFileOptions): Promise<ToolResult> {
  const {
    file_path: filePath,
    edits,
    dry_run: dryRun = false,
    ignore_whitespace: ignoreWhitespace = false,
    all_or_nothing: allOrNothing = false,
    match_scope: matchScope = "all",
    normalize_eol: normalizeEol = "auto",
  } = options;

  const startTime = performance.now();

  try {
    // P2: Empty edits validation
    if (edits.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `\u26a0\ufe0f edits dizisi bo\u015f: ${filePath}\nHi\u00e7bir de\u011fi\u015fiklik yap\u0131lmad\u0131. En az bir {old_text, new_text} edit gereklidir.`,
          },
        ],
        isError: true,
      };
    }

    // Read file
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      return {
        content: [{ type: "text", text: `\u274c Dosya bulunamad\u0131: ${filePath}` }],
        isError: true,
      };
    }

    // File stats for output
    const lineCount = (content.match(/\n/g) ?? []).length + 1;
    const fileSize = Buffer.byteLength(content, "utf-8");

    // P1: EOL normalization
    const originalEOL = detectEOL(content);
    if (normalizeEol !== "preserve") {
      content = normalizeEOL(content, normalizeEol);
    }

    const originalContent = content;

    // P0: Conflict detection
    const conflicts = detectConflicts(content, edits);
    if (conflicts.length > 0 && allOrNothing) {
      const conflictLines = conflicts.map(
        (c) => `  \u26a0\ufe0f Edit ${c.editA + 1} \u2194 Edit ${c.editB + 1}: ${c.reason}`
      );
      return {
        content: [
          {
            type: "text",
            text: `\u274c Conflict detected (atomic mode):\n${conflictLines.join("\n")}\n\nHi\u00e7bir de\u011fi\u015fiklik uygulanmad\u0131. Çak\u0131\u015fmalar\u0131 \u00e7\u00f6z\u00fcp tekrar deneyin.`,
          },
        ],
        isError: true,
      };
    }

    // Apply edits
    const results: EditResult[] = [];
    let workingContent = content;

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      if (!edit) continue;
      const result = applyEdit(workingContent, edit, i, ignoreWhitespace, matchScope);
      results.push(result);

      if (result.success && result.newContent !== undefined) {
        workingContent = result.newContent;
      }
    }

    const failCount = results.filter((r) => !r.success).length;

    // P0: Atomic mode — if any edit failed, rollback all
    if (allOrNothing && failCount > 0) {
      const elapsed = Math.round(performance.now() - startTime);
      const failDetails = results
        .filter((r) => !r.success)
        .map((r) => `  \u274c Edit ${r.index + 1}: ${r.error ?? "unknown"}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `\u274c Atomic rollback: ${filePath}\n\u23f1\ufe0f ${elapsed}ms\n\n${failCount}/${edits.length} edit ba\u015far\u0131s\u0131z \u2014 hi\u00e7bir de\u011fi\u015fiklik uygulanmad\u0131 (all_or_nothing=true)\n\n${failDetails}`,
          },
        ],
        isError: true,
      };
    }

    // Determine final content
    const hasChanges = workingContent !== originalContent;
    const finalContent = hasChanges ? workingContent : originalContent;

    // Generate diff
    const diffResult = diffContent(originalContent, finalContent, filePath, filePath);
    const diff = diffResult.identical ? "(De\u011fi\u015fiklik yok)" : diffResult.unified;

    // Bracket balance check (only for code files)
    const isCodeFile = /\.(ts|tsx|js|jsx|json|css|html|vue|svelte)$/.test(filePath);
    let bracketStatus = "";
    if (isCodeFile && hasChanges) {
      const bracketCheck = checkBracketBalance(finalContent);
      bracketStatus = bracketCheck.ok
        ? "\ud83d\udd12 Parantez dengesi: OK"
        : `\u26a0\ufe0f Parantez dengesi: ${bracketCheck.detail ?? "unknown"}`;
    }

    const elapsed = Math.round(performance.now() - startTime);

    if (dryRun) {
      const output = formatOutput({
        mode: "dry-run",
        filePath,
        results,
        diff,
        hasChanges,
        elapsed,
        lineCount,
        fileSize,
        conflicts,
        bracketStatus,
        matchScope,
        atomic: allOrNothing,
      });
      return { content: [{ type: "text", text: output }] };
    }

    // Write changes
    if (hasChanges) {
      // Restore original EOL style if needed
      let writeContent = finalContent;
      if (normalizeEol === "preserve" || normalizeEol === "auto") {
        // If original was CRLF and we normalized to LF for matching, convert back
        if (originalEOL === "crlf" && normalizeEol === "auto") {
          writeContent = writeContent.replace(/(?<!\r)\n/g, "\r\n");
        }
      }
      await writeFile(filePath, writeContent, "utf-8");
    }

    const output = formatOutput({
      mode: "apply",
      filePath,
      results,
      diff,
      hasChanges,
      elapsed,
      lineCount,
      fileSize,
      conflicts,
      bracketStatus,
      matchScope,
      atomic: allOrNothing,
    });
    return { content: [{ type: "text", text: output }] };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_edit", err, { file_path: filePath, editCount: edits.length });
    return {
      content: [{ type: "text", text: `\u274c Edit hatas\u0131: ${err.message}` }],
      isError: true,
    };
  }
}
// ============================================
// Output Formatting
// ============================================

interface FormatOptions {
  mode: "dry-run" | "apply";
  filePath: string;
  results: EditResult[];
  diff: string;
  hasChanges: boolean;
  elapsed: number;
  lineCount: number;
  fileSize: number;
  conflicts: ConflictInfo[];
  bracketStatus: string;
  matchScope: MatchScope | number[];
  atomic: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatOutput(opts: FormatOptions): string {
  const {
    mode,
    filePath,
    results,
    diff,
    hasChanges,
    elapsed,
    lineCount,
    fileSize,
    conflicts,
    bracketStatus,
    matchScope,
    atomic,
  } = opts;

  const successCount = results.filter((r) => r.success).length;
  const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0);

  const icon = mode === "dry-run" ? "\ud83d\udd0d" : "\u2705";
  const modeLabel = mode === "dry-run" ? "DRY-RUN" : "Edit Tamamland\u0131";

  const lines: string[] = [
    `${icon} ${modeLabel}: ${filePath} (${formatFileSize(fileSize)}, ${lineCount} sat\u0131r)`,
    `\u23f1\ufe0f ${elapsed}ms`,
    "",
    "\u2550".repeat(60),
    `\ud83d\udcca ${successCount}/${results.length} edit ba\u015far\u0131l\u0131 \u2022 ${totalReplacements} replacement${atomic ? " \u2022 atomic: on" : ""}`,
    "",
  ];

  // Conflict warnings
  if (conflicts.length > 0) {
    lines.push(`\u26a0\ufe0f ${conflicts.length} conflict tespit edildi:`);
    for (const c of conflicts) {
      lines.push(`  Edit ${c.editA + 1} \u2194 Edit ${c.editB + 1}: ${c.reason}`);
    }
    lines.push("");
  }

  // Per-edit details
  for (const result of results) {
    const status = result.success ? "\u2705" : "\u274c";
    const matchInfo =
      result.matches && result.matches.length > 0
        ? result.matches.map((m) => `L${m.line}`).join(", ")
        : "";
    const scopeLabel = Array.isArray(matchScope)
      ? `indexes: [${matchScope.join(",")}]`
      : matchScope !== "all"
        ? `scope: ${matchScope}`
        : "";

    const oldText = result.edit.old_text;
    const preview = oldText.slice(0, 50).replace(/\n/g, "\\n");
    const truncated = oldText.length > 50 ? "..." : "";

    let detail = `${status} Edit ${result.index + 1}: `;
    if (result.success) {
      detail += `${result.replacements} replacement`;
      if (matchInfo !== "") detail += ` [${matchInfo}]`;
      if (scopeLabel !== "") detail += ` (${scopeLabel})`;
    } else {
      detail += result.error ?? "Bilinmeyen hata";
    }
    lines.push(detail);
    const newText = result.edit.new_text;
    const newPreview = newText.slice(0, 50).replace(/\n/g, "\\n");
    const newTruncated = newText.length > 50 ? "..." : "";
    lines.push(`   "${preview}${truncated}" \u2192 "${newPreview}${newTruncated}"`);
    lines.push("");
  }

  // Diff
  lines.push("\u2500".repeat(60));
  if (mode === "dry-run") {
    lines.push("\u00d6nizleme:");
  } else {
    lines.push("Uygulanan De\u011fi\u015fiklikler:");
  }
  lines.push(diff);
  lines.push("");

  // Bracket status
  if (bracketStatus !== "") {
    lines.push(bracketStatus);
  }

  // Footer
  if (mode === "dry-run") {
    lines.push(
      hasChanges
        ? "\ud83d\udca1 De\u011fi\u015fiklikler uygulanmad\u0131 (dry-run)"
        : "\ud83d\udca1 De\u011fi\u015fiklik yok"
    );
    lines.push("\ud83d\udca1 Uygulamak i\u00e7in dry_run=false kullan\u0131n");
  }

  if (/\.(ts|tsx)$/.test(filePath) && mode === "apply" && hasChanges) {
    lines.push("\ud83d\udca1 TS kontrol\u00fc: hev_dev_check_syntax");
  }

  return lines.join("\n");
}
// ============================================
// Tool Definition
// ============================================

export const EDIT_FILE_TOOL = {
  name: "hev_fs_edit",
  description: [
    "Dosyada pattern-based edit yap.",
    "",
    "KULLANIM: edits: [{old_text: 'mevcut metin', new_text: 'yeni metin'}]",
    "old_text dosyada exact match ile bulunur ve new_text ile de\u011fi\u015ftirilir.",
    "",
    "PARAMETRELER:",
    "\u2022 edits (zorunlu): [{old_text, new_text}] dizisi. En az 1 edit gerekli.",
    "\u2022 dry_run: true ile \u00f6nizle, false ile uygula (varsay\u0131lan: false)",
    "\u2022 all_or_nothing: true ise tek edit fail olursa hi\u00e7biri yaz\u0131lmaz (varsay\u0131lan: false)",
    "\u2022 match_scope: 'first'|'last'|'all'|[0,2] \u2014 hangi occurrence de\u011fi\u015fir (varsay\u0131lan: 'all')",
    "\u2022 ignore_whitespace: true ise bo\u015fluk farklar\u0131n\u0131 yoksayar, orijinal format korunur (varsay\u0131lan: false)",
    "\u2022 normalize_eol: 'lf'|'crlf'|'auto'|'preserve' \u2014 sat\u0131r sonu normalizasyonu (varsay\u0131lan: 'auto')",
    "",
    "\u00d6NEML\u0130:",
    "\u2022 old_text dosyadaki metinle birebir e\u015fle\u015fmeli (indent ve newline dahil)",
    "\u2022 Birden fazla occurrence varsa match_scope ile kontrol et",
    "\u2022 Kritik edit'lerde all_or_nothing=true kullan",
    "\u2022 \u00d6nce dry_run=true ile test et, sonra uygula",
  ].join("\n"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "D\u00fczenlenecek dosya yolu",
      },
      edits: {
        type: "array",
        description:
          "Edit listesi. Her eleman {old_text: string, new_text: string}. old_text: de\u011fi\u015ftirilecek metin (exact match), new_text: yeni metin. \u0130kisi de zorunlu.",
        items: {
          type: "object",
          properties: {
            old_text: {
              type: "string",
              description: "De\u011fi\u015ftirilecek mevcut metin (exact match)",
            },
            new_text: {
              type: "string",
              description: "Yerine yaz\u0131lacak metin",
            },
          },
          required: ["old_text", "new_text"],
        },
      },
      dry_run: {
        type: "boolean",
        description: "true: \u00f6nizle (dosyay\u0131 de\u011fi\u015ftirme), false: uygula",
        default: false,
      },
      all_or_nothing: {
        type: "boolean",
        description:
          "true: herhangi bir edit fail olursa hi\u00e7biri uygulanmaz (atomic). false: ba\u015far\u0131l\u0131 olanlar uygulan\u0131r",
        default: false,
      },
      match_scope: {
        oneOf: [
          {
            type: "string",
            enum: ["first", "last", "all"],
            description:
              "first: ilk e\u015fle\u015fme, last: son e\u015fle\u015fme, all: t\u00fcm e\u015fle\u015fmeler",
          },
          {
            type: "array",
            items: { type: "integer", minimum: 0 },
            description: "Belirli occurrence index'leri (0-based)",
          },
        ],
        description: "Hangi occurrence'lar de\u011fi\u015ftirilsin (varsay\u0131lan: 'all')",
        default: "all",
      },
      ignore_whitespace: {
        type: "boolean",
        description:
          "true: bo\u015fluk/indent farklar\u0131n\u0131 yoksay, orijinal format korunsun. false: exact match",
        default: false,
      },
      normalize_eol: {
        type: "string",
        enum: ["lf", "crlf", "auto", "preserve"],
        description:
          "Sat\u0131r sonu: lf (Unix), crlf (Windows), auto (dosyan\u0131n stilini koru), preserve (hi\u00e7 de\u011fi\u015ftirme)",
        default: "auto",
      },
    },
    required: ["file_path", "edits"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "basic",
    priority: "high",
    complexity: "complex",
    useCases: [
      "K\u0131smi dosya de\u011fi\u015fikli\u011fi",
      "Multi-line edit",
      "Batch replace",
      "Refactoring",
      "Atomic edit (all_or_nothing)",
      "Scoped replace (first/last/all)",
    ],
    relatedTools: ["hev_fs_write", "hev_dev_edit_lines", "hev_dev_check_syntax"],
    agentGuidance: [
      "K\u0131smi dosya de\u011fi\u015fiklikleri i\u00e7in kullan. Tam dosya \u00fczerine yazmak yerine pattern-based edit yapar.",
      "\u00d6nce dry_run=true ile test et, ba\u015far\u0131l\u0131ysa dry_run=false ile uygula.",
      "old_text dosyadaki metinle birebir e\u015fle\u015fmeli (bo\u015fluk, indent, newline dahil).",
      "Birden fazla occurrence varsa match_scope='first' ile sadece ilkini de\u011fi\u015ftir.",
      "Kritik de\u011fi\u015fikliklerde all_or_nothing=true kullan \u2014 bir edit fail olursa hi\u00e7biri yaz\u0131lmaz.",
      ".ts/.tsx dosyalar\u0131nda edit sonras\u0131 hev_dev_check_syntax \u00e7al\u0131\u015ft\u0131r.",
    ].join(" "),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["file", "edit", "modify", "replace", "patch", "atomic", "scope"],
  },
};
