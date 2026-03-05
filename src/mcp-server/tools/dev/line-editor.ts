/**
 * Development Tools - Line Editor
 *
 * Satır bazlı dosya düzenleme (büyük dosyalar için find_and_replace alternatifi)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { getContextPreview } from "../../utils/file-utils.js";
import { analyzeScopeImpact, validateBracketBalance } from "./scope-validator.js";
import {
  validateBrackets as prettierValidateBrackets,
  isCodeFile,
} from "../../utils/prettier-validator.js";

interface EditLinesResult {
  success: boolean;
  message: string;
  linesAffected?: number;
  preview?: string;
  contextPreview?: string;
  syntaxValid?: boolean;
  syntaxError?: string;
  scopeWarnings?: string[];
  bracketIssues?: string[];
  willBreakScope?: boolean;
}

export async function editLines(
  filePath: string,
  options: {
    operation: "replace" | "delete" | "insert" | "insert_after" | "insert_before" | "show";
    startLine: number;
    endLine?: number;
    content?: string;
    dryRun?: boolean;
    validateSyntax?: boolean;
    validateBrackets?: boolean;
    safeMode?: boolean;
    force?: boolean;
    autoIndent?: boolean;
  },
  projectRoot?: string
): Promise<EditLinesResult> {
  if (!existsSync(filePath)) {
    return { success: false, message: `Dosya bulunamadı: ${filePath}` };
  }

  const originalContent = readFileSync(filePath, "utf-8");
  const lines = originalContent.split("\n");
  const start = options.startLine - 1;
  const end = options.endLine ?? start + 1;

  if (start < 0 || start >= lines.length) {
    return { success: false, message: `Geçersiz başlangıç satırı: ${options.startLine}` };
  }

  switch (options.operation) {
    case "show": {
      const showEnd = Math.min(end, lines.length);
      const preview = lines
        .slice(start, showEnd)
        .map((line, i) => `${String(start + i + 1).padStart(4)} | ${line}`)
        .join("\n");
      return {
        success: true,
        message: "Satırlar gösteriliyor",
        preview,
        linesAffected: showEnd - start,
      };
    }

    case "delete": {
      const safeMode = options.safeMode ?? true; // Default: true for safety
      const validateBrackets = options.validateBrackets !== false;
      const force = options.force === true;

      // SCOPE VALIDATION (if safe mode enabled)
      if (safeMode && !force) {
        const scopeCheck = analyzeScopeImpact(filePath, options.startLine, end);
        if (scopeCheck.willBreakScope) {
          return {
            success: false,
            message: "⚠️  Scope kırılma riski tespit edildi!",
            scopeWarnings: scopeCheck.warnings,
            willBreakScope: true,
            linesAffected: 0,
          };
        }
      }

      const newLines = [...lines.slice(0, start), ...lines.slice(end)];

      // BRACKET VALIDATION (Prettier-first, fallback to custom)
      if (validateBrackets && !force) {
        const newContent = newLines.join("\n");

        // Try Prettier first for JS/TS files (more reliable)
        if (isCodeFile(filePath)) {
          const prettierCheck = await prettierValidateBrackets(newContent, filePath);
          if (!prettierCheck.balanced) {
            return {
              success: false,
              message: "⚠️  Syntax error detected (Prettier)",
              bracketIssues: [prettierCheck.error ?? "Unknown syntax error"],
              linesAffected: 0,
            };
          }
        } else {
          // Fallback to custom bracket validation for non-JS/TS files
          const bracketCheck = validateBracketBalance(originalContent, newContent);
          if (!bracketCheck.balanced) {
            return {
              success: false,
              message: "⚠️  Parantez dengesi bozulacak!",
              bracketIssues: bracketCheck.details,
              linesAffected: 0,
            };
          }
        }
      }

      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, end, 5);
      } catch (err) {
        /* ignore */
      }

      if (options.dryRun !== true) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      return {
        success: true,
        message:
          options.dryRun === true ? "Dry run: silme yapılacak" : `${end - start} satır silindi`,
        linesAffected: end - start,
        ...(contextPreview != null ? { contextPreview } : {}),
      };
    }

    case "insert":
    case "insert_after": {
      if (options.content == null) {
        return { success: false, message: "İçerik gerekli" };
      }
      const insertLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start + 1), ...insertLines, ...lines.slice(start + 1)];

      if (options.dryRun !== true) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }

      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(
          filePath,
          start + 1,
          start + 1 + insertLines.length,
          5
        );
      } catch (err) {
        /* ignore */
      }

      return {
        success: true,
        message:
          options.dryRun === true
            ? "Dry run: ekleme yapılacak"
            : `${insertLines.length} satır eklendi (sonra)`,
        linesAffected: insertLines.length,
        ...(contextPreview != null ? { contextPreview } : {}),
      };
    }

    case "insert_before": {
      if (options.content == null) {
        return { success: false, message: "İçerik gerekli" };
      }
      const insertLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start), ...insertLines, ...lines.slice(start)];

      if (options.dryRun !== true) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }

      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, start + insertLines.length, 5);
      } catch (err) {
        /* ignore */
      }

      return {
        success: true,
        message:
          options.dryRun === true
            ? "Dry run: ekleme yapılacak"
            : `${insertLines.length} satır eklendi (önce)`,
        linesAffected: insertLines.length,
        ...(contextPreview != null ? { contextPreview } : {}),
      };
    }

    case "replace": {
      if (options.content == null) {
        return { success: false, message: "İçerik gerekli" };
      }

      const safeMode = options.safeMode ?? true; // Default: true for safety
      const validateBrackets = options.validateBrackets !== false;
      const force = options.force === true;

      // SCOPE VALIDATION (if safe mode enabled)
      // For replace operations, only check scope if line count changes significantly
      if (safeMode && !force) {
        const replaceLineCount = options.content.split("\n").length;
        const originalLineCount = end - start;
        // Only run scope check if we're removing more lines than adding (net deletion)
        // Single-line replacements (1→1) and line additions are safe
        if (replaceLineCount < originalLineCount) {
          const scopeCheck = analyzeScopeImpact(filePath, options.startLine, end);
          if (scopeCheck.willBreakScope) {
            return {
              success: false,
              message: `⚠️  Scope kırılma riski tespit edildi!\n${scopeCheck.warnings.join("\n")}\n\nBu kontrolü atlamak için force: true kullanın.`,
              scopeWarnings: scopeCheck.warnings,
              willBreakScope: true,
              linesAffected: 0,
            };
          }
        }
      }

      const replaceLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start), ...replaceLines, ...lines.slice(end)];

      // BRACKET VALIDATION (Prettier-first, fallback to custom)
      if (validateBrackets && !force) {
        const newContent = newLines.join("\n");

        // Try Prettier first for JS/TS files (more reliable)
        if (isCodeFile(filePath)) {
          const prettierCheck = await prettierValidateBrackets(newContent, filePath);
          if (!prettierCheck.balanced) {
            return {
              success: false,
              message: "⚠️  Syntax error detected (Prettier)",
              bracketIssues: [prettierCheck.error ?? "Unknown syntax error"],
              linesAffected: 0,
            };
          }
        } else {
          // Fallback to custom bracket validation for non-JS/TS files
          const bracketCheck = validateBracketBalance(originalContent, newContent);
          if (!bracketCheck.balanced) {
            return {
              success: false,
              message: "⚠️  Parantez dengesi bozulacak!",
              bracketIssues: bracketCheck.details,
              linesAffected: 0,
            };
          }
        }
      }

      let syntaxValid = true;
      let syntaxError: string | undefined;

      if (
        options.validateSyntax === true &&
        projectRoot != null &&
        /\.(ts|js|tsx|jsx)$/.test(filePath)
      ) {
        const tempContent = newLines.join("\n");
        try {
          execSync(`node --check --input-type=module`, {
            input: tempContent,
            cwd: projectRoot,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 5000,
          });
          syntaxValid = true;
        } catch (err: unknown) {
          syntaxValid = false;
          const error = err as { stderr?: { toString(): string }; message?: string };
          syntaxError = error.stderr?.toString() ?? error.message ?? "Syntax hatası";

          if (options.dryRun !== true) {
            return {
              success: false,
              message: "Syntax hatası tespit edildi, değişiklik yapılmadı",
              syntaxValid: false,
              syntaxError,
            };
          }
        }
      }

      if (options.dryRun !== true) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }

      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, start + replaceLines.length, 5);
      } catch (err) {
        /* ignore */
      }

      return {
        success: true,
        message:
          options.dryRun === true
            ? "Dry run: değişiklik yapılacak"
            : `${end - start} satır değiştirildi`,
        linesAffected: end - start,
        ...(contextPreview != null ? { contextPreview } : {}),
        syntaxValid,
        ...(syntaxError != null ? { syntaxError } : {}),
      };
    }

    default:
      return { success: false, message: "Bilinmeyen işlem" };
  }
}

export const LINE_EDITOR_TOOL = {
  name: "hev_dev_edit_lines",
  description:
    "Satır bazlı dosya düzenleme. operation: 'replace'|'delete'|'insert'|'insert_after'|'insert_before'|'show'. replace/delete için start_line+end_line gerekli, insert için start_line+content gerekli. Önce hev_fs_read ile satır numaralarını öğren.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu",
      },
      operation: {
        type: "string" as const,
        enum: ["replace", "delete", "insert", "insert_after", "insert_before", "show"],
        description:
          "İşlem türü: replace (satırları değiştir), delete (sil), insert/insert_after (sonra ekle), insert_before (önce ekle), show (göster)",
      },
      start_line: {
        type: "integer" as const,
        description: "Başlangıç satırı (1-indexed)",
      },
      end_line: {
        type: "integer" as const,
        description: "Bitiş satırı (dahil, delete/replace için)",
      },
      content: {
        type: "string" as const,
        description: "Yeni içerik (replace/insert için)",
      },
      dry_run: {
        type: "boolean" as const,
        description: "Değişiklikleri uygulama, sadece önizle",
        default: false,
      },
      validate_brackets: {
        type: "boolean" as const,
        description: "Parantez dengesi kontrolü (default: true)",
        default: true,
      },
      safe_mode: {
        type: "boolean" as const,
        description: "Scope kırılma kontrolü (default: true)",
        default: true,
      },
      force: {
        type: "boolean" as const,
        description: "Güvenlik kontrollerini atla (dikkatli kullan!)",
        default: false,
      },
    },
    required: ["file_path", "operation", "start_line"],
  },
  metadata: {
    category: "development",
    subcategory: "code-editing",
    priority: "high",
    complexity: "complex",
    useCases: [
      "Precise line-based editing for large files",
      "Safe replacements with bracket validation",
      "Scope-aware deletions",
    ],
    relatedTools: ["hev_fs_find_and_replace", "hev_fs_show", "hev_dev_check_syntax"],
    agentGuidance:
      "Advanced line editor with safety checks. ALWAYS use hev_fs_read first to get line numbers. Has safe_mode and bracket validation. Use for large files where find_and_replace is risky. operation: replace (start_line, end_line, content), delete (start_line, end_line), insert/insert_after (start_line, content), insert_before (start_line, content), show (start_line, end_line).",
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["line-editing", "safe", "scope-aware", "bracket-validation", "precise"],
  },
};
