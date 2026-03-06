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
import { applyEdit } from "./edit/apply.js";
import { detectConflicts } from "./edit/conflict.js";
import { detectEOL, normalizeEOL } from "./edit/eol.js";
import { formatOutput } from "./edit/format-output.js";
import type { EditFileOptions, EditResult, ConflictInfo, EOLMode } from "./edit/types.js";
import { checkBracketBalance } from "./edit/validator.js";
import type { ToolResult } from "@shared/index-mcp.js";

export type { EOLMode, EditFileOptions, EditResult, FileEdit, MatchScope } from "./edit/types.js";

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
    if (edits.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ edits dizisi boş: ${filePath}\nHiçbir değişiklik yapılmadı. En az bir {old_text, new_text} edit gereklidir.`,
          },
        ],
        isError: true,
      };
    }

    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      return {
        content: [{ type: "text", text: `❌ Dosya bulunamadı: ${filePath}` }],
        isError: true,
      };
    }

    const lineCount = (content.match(/\n/g) ?? []).length + 1;
    const fileSize = Buffer.byteLength(content, "utf-8");

    const originalEOL = detectEOL(content);
    if (normalizeEol !== "preserve") {
      content = normalizeEOL(content, normalizeEol as EOLMode);
    }

    const originalContent = content;

    const conflicts = detectConflicts(content, edits);
    if (conflicts.length > 0 && allOrNothing) {
      const conflictLines = conflicts.map(
        (c: ConflictInfo) => `  ⚠️ Edit ${c.editA + 1} ↔ Edit ${c.editB + 1}: ${c.reason}`
      );
      return {
        content: [
          {
            type: "text",
            text: `❌ Conflict detected (atomic mode):\n${conflictLines.join("\n")}\n\nHiçbir değişiklik uygulanmadı. Çakışmaları çözüp tekrar deneyin.`,
          },
        ],
        isError: true,
      };
    }

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

    if (allOrNothing && failCount > 0) {
      const elapsed = Math.round(performance.now() - startTime);
      const failDetails = results
        .filter((r) => !r.success)
        .map((r) => `  ❌ Edit ${r.index + 1}: ${r.error ?? "unknown"}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `❌ Atomic rollback: ${filePath}\n⏱️ ${elapsed}ms\n\n${failCount}/${edits.length} edit başarısız — hiçbir değişiklik uygulanmadı (all_or_nothing=true)\n\n${failDetails}`,
          },
        ],
        isError: true,
      };
    }

    const hasChanges = workingContent !== originalContent;
    const finalContent = hasChanges ? workingContent : originalContent;

    const diffResult = diffContent(originalContent, finalContent, filePath, filePath);
    const diff = diffResult.identical ? "(Değişiklik yok)" : diffResult.unified;

    const isCodeFile = /\.(ts|tsx|js|jsx|json|css|html|vue|svelte)$/.test(filePath);
    let bracketStatus = "";
    if (isCodeFile && hasChanges) {
      const bracketCheck = checkBracketBalance(finalContent);
      bracketStatus = bracketCheck.ok
        ? "🔒 Parantez dengesi: OK"
        : `⚠️ Parantez dengesi: ${bracketCheck.detail ?? "unknown"}`;
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
        matchScope: matchScope,
        atomic: allOrNothing,
      });
      return { content: [{ type: "text", text: output }] };
    }

    if (hasChanges) {
      let writeContent = finalContent;
      if (normalizeEol === "preserve" || normalizeEol === "auto") {
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
      matchScope: matchScope,
      atomic: allOrNothing,
    });
    return { content: [{ type: "text", text: output }] };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_fs_edit", err, { file_path: filePath, editCount: edits.length });
    return {
      content: [{ type: "text", text: `❌ Edit hatası: ${err.message}` }],
      isError: true,
    };
  }
}

export const EDIT_FILE_TOOL = {
  name: "hev_fs_edit",
  description: [
    "Dosyada pattern-based edit yap.",
    "",
    "KULLANIM: edits: [{old_text: 'mevcut metin', new_text: 'yeni metin'}]",
    "old_text dosyada exact match ile bulunur ve new_text ile değiştirilir.",
    "",
    "PARAMETRELER:",
    "• edits (zorunlu): [{old_text, new_text}] dizisi. En az 1 edit gerekli.",
    "• dry_run: true ile önizle, false ile uygula (varsayılan: false)",
    "• all_or_nothing: true ise tek edit fail olursa hiçbiri yazılmaz (varsayılan: false)",
    "• match_scope: 'first'|'last'|'all'|[0,2] — hangi occurrence değişir (varsayılan: 'all')",
    "• ignore_whitespace: true ise boşluk farklarını yoksayar, orijinal format korunur (varsayılan: false)",
    "• normalize_eol: 'lf'|'crlf'|'auto'|'preserve' — satır sonu normalizasyonu (varsayılan: 'auto')",
    "",
    "ÖNEMLİ:",
    "• old_text dosyadaki metinle birebir eşleşmeli (indent ve newline dahil)",
    "• Birden fazla occurrence varsa match_scope ile kontrol et",
    "• Kritik edit'lerde all_or_nothing=true kullan",
    "• Önce dry_run=true ile test et, sonra uygula",
  ].join("\n"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Düzenlenecek dosya yolu",
      },
      edits: {
        type: "array",
        description:
          "Edit listesi. Her eleman {old_text: string, new_text: string}. old_text: değiştirilecek metin (exact match), new_text: yeni metin. İkisi de zorunlu.",
        items: {
          type: "object",
          properties: {
            old_text: {
              type: "string",
              description: "Değiştirilecek mevcut metin (exact match)",
            },
            new_text: {
              type: "string",
              description: "Yerine yazılacak metin",
            },
          },
          required: ["old_text", "new_text"],
        },
      },
      dry_run: {
        type: "boolean",
        description: "true: önizle (dosyayı değiştirme), false: uygula",
        default: false,
      },
      all_or_nothing: {
        type: "boolean",
        description:
          "true: herhangi bir edit fail olursa hiçbiri uygulanmaz (atomic). false: başarılı olanlar uygulanır",
        default: false,
      },
      match_scope: {
        oneOf: [
          {
            type: "string",
            enum: ["first", "last", "all"],
            description: "first: ilk eşleşme, last: son eşleşme, all: tüm eşleşmeler",
          },
          {
            type: "array",
            items: { type: "integer", minimum: 0 },
            description: "Belirli occurrence index'leri (0-based)",
          },
        ],
        description: "Hangi occurrence'lar değiştirilsin (varsayılan: 'all')",
        default: "all",
      },
      ignore_whitespace: {
        type: "boolean",
        description:
          "true: boşluk/indent farklarını yoksay, orijinal format korunsun. false: exact match",
        default: false,
      },
      normalize_eol: {
        type: "string",
        enum: ["lf", "crlf", "auto", "preserve"],
        description:
          "Satır sonu: lf (Unix), crlf (Windows), auto (dosyanın stilini koru), preserve (hiç değiştirme)",
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
      "Kısmi dosya değişikliği",
      "Multi-line edit",
      "Batch replace",
      "Refactoring",
      "Atomic edit (all_or_nothing)",
      "Scoped replace (first/last/all)",
    ],
    relatedTools: ["hev_fs_write", "hev_dev_edit_lines", "hev_dev_check_syntax"],
    agentGuidance: [
      "Kısmi dosya değişiklikleri için kullan. Tam dosya üzerine yazmak yerine pattern-based edit yapar.",
      "Önce dry_run=true ile test et, başarılıysa dry_run=false ile uygula.",
      "old_text dosyadaki metinle birebir eşleşmeli (boşluk, indent, newline dahil).",
      "Birden fazla occurrence varsa match_scope='first' ile sadece ilkini değiştir.",
      "Kritik değişikliklerde all_or_nothing=true kullan — bir edit fail olursa hiçbiri yazılmaz.",
      ".ts/.tsx dosyalarında edit sonrası hev_dev_check_syntax çalıştır.",
    ].join(" "),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["file", "edit", "modify", "replace", "patch", "atomic", "scope"],
  },
};
