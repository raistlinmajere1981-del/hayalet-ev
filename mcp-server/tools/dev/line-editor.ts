/**
 * Development Tools - Line Editor
 * 
 * Satır bazlı dosya düzenleme (büyük dosyalar için find_and_replace alternatifi)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { getContextPreview } from "../../utils/file-utils.js";
import { analyzeScopeImpact, validateBracketBalance } from "./scope-validator.js";

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
  const end = options.endLine ? options.endLine : start + 1;

  if (start < 0 || start >= lines.length) {
    return { success: false, message: `Geçersiz başlangıç satırı: ${options.startLine}` };
  }

  switch (options.operation) {
    case "show": {
      const showEnd = Math.min(end, lines.length);
      const preview = lines.slice(start, showEnd)
        .map((line, i) => `${String(start + i + 1).padStart(4)} | ${line}`)
        .join("\n");
      return { success: true, message: "Satırlar gösteriliyor", preview, linesAffected: showEnd - start };
    }

    case "delete": {
      const safeMode = options.safeMode ?? true; // Default: true for safety
      const validateBrackets = options.validateBrackets !== false;
      const force = options.force === true;
      
      // SCOPE VALIDATION (if safe mode enabled)
      if (safeMode && !force) {
        const scopeCheck = await analyzeScopeImpact(filePath, options.startLine, end);
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
      
      // BRACKET VALIDATION (if enabled)
      if (validateBrackets && !force) {
        const newContent = newLines.join("\n");
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
      
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, end, 5);
      } catch (err) { /* ignore */ }
      
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: silme yapılacak" : `${end - start} satır silindi`,
        linesAffected: end - start,
        contextPreview,
      };
    }

    case "insert":
    case "insert_after": {
      if (!options.content) {
        return { success: false, message: "İçerik gerekli" };
      }
      const insertLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start + 1), ...insertLines, ...lines.slice(start + 1)];
      
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start + 1, start + 1 + insertLines.length, 5);
      } catch (err) { /* ignore */ }
      
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: ekleme yapılacak" : `${insertLines.length} satır eklendi (sonra)`,
        linesAffected: insertLines.length,
        contextPreview,
      };
    }

    case "insert_before": {
      if (!options.content) {
        return { success: false, message: "İçerik gerekli" };
      }
      const insertLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start), ...insertLines, ...lines.slice(start)];
      
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, start + insertLines.length, 5);
      } catch (err) { /* ignore */ }
      
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: ekleme yapılacak" : `${insertLines.length} satır eklendi (önce)`,
        linesAffected: insertLines.length,
        contextPreview,
      };
    }

    case "replace": {
      if (!options.content) {
        return { success: false, message: "İçerik gerekli" };
      }
      
      const safeMode = options.safeMode ?? true; // Default: true for safety
      const validateBrackets = options.validateBrackets !== false;
      const force = options.force === true;
      
      // SCOPE VALIDATION (if safe mode enabled)
      if (safeMode && !force) {
        const scopeCheck = await analyzeScopeImpact(filePath, options.startLine, end);
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
      
      const replaceLines = options.content.split("\n");
      const newLines = [...lines.slice(0, start), ...replaceLines, ...lines.slice(end)];
      
      // BRACKET VALIDATION (if enabled)
      if (validateBrackets && !force) {
        const newContent = newLines.join("\n");
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
      
      let syntaxValid = true;
      let syntaxError: string | undefined;
      
      if (options.validateSyntax && projectRoot && /\.(ts|js|tsx|jsx)$/.test(filePath)) {
        const tempContent = newLines.join("\n");
        try {
          execSync(`node --check --input-type=module`, {
            input: tempContent,
            cwd: projectRoot,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 5000
          });
          syntaxValid = true;
        } catch (err: any) {
          syntaxValid = false;
          const error = err as { stderr?: { toString(): string }; message?: string };
          syntaxError = error.stderr?.toString() || error.message || "Syntax hatası";
          
          if (!options.dryRun) {
            return {
              success: false,
              message: "Syntax hatası tespit edildi, değişiklik yapılmadı",
              syntaxValid: false,
              syntaxError
            };
          }
        }
      }
      
      if (!options.dryRun) {
        writeFileSync(filePath, newLines.join("\n"), "utf-8");
      }
      
      let contextPreview: string | undefined;
      try {
        contextPreview = await getContextPreview(filePath, start, start + replaceLines.length, 5);
      } catch (err) { /* ignore */ }
      
      return { 
        success: true, 
        message: options.dryRun ? "Dry run: değişiklik yapılacak" : `${end - start} satır değiştirildi`,
        linesAffected: end - start,
        contextPreview,
        syntaxValid,
        syntaxError
      };
    }

    default:
      return { success: false, message: `Bilinmeyen işlem: ${options.operation}` };
  }
}

export const LINE_EDITOR_TOOL = {
  name: "hev_dev_edit_lines",
  description: "Satır bazlı dosya düzenleme. Büyük dosyalarda find_and_replace yerine kullanılabilir.",
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
        description: "İşlem türü: replace (satırları değiştir), delete (sil), insert/insert_after (sonra ekle), insert_before (önce ekle), show (göster)",
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
};
