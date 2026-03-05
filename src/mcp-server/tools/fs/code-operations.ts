/**
 * Filesystem Tools - Code Operations
 *
 * Code-specific operations: expand chunks, find & replace
 */

import { readFile } from "fs/promises";
import { expandSymbols, expandLineRanges, addLineNumbers } from "../../utils/file-utils.js";
import { getContextPreview, findAndReplace } from "../../utils/file-utils.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";
import { isCodeFile, compareBeforeAfter } from "../../utils/prettier-validator.js";

interface ReplaceResult {
  file: string;
  replacements: number;
  success: boolean;
  error?: string;
  preview?: string;
  contextPreview?: string;
}

export async function expandCodeChunks(
  filePath: string,
  lineRanges: [number, number][] = [],
  patterns: string[] = []
): Promise<{ content: string; error?: string }> {
  try {
    // Önce patterns ile ara
    if (patterns.length > 0) {
      const content = await expandSymbols(filePath, patterns);
      return { content };
    }

    // Line ranges ile genişlet
    if (lineRanges.length > 0) {
      const content = await expandLineRanges(filePath, lineRanges);
      return { content };
    }

    // Hiçbiri verilmediyse tüm dosyayı göster
    const fileContent = await readFile(filePath, "utf-8");
    return { content: addLineNumbers(fileContent) };
  } catch (error) {
    logToolError("hev_fs_expand_code_chunks", error as Error, { filePath, lineRanges, patterns });
    return { content: "", error: (error as Error).message };
  }
}

export async function findAndReplaceCode(
  filePath: string,
  find: string,
  replace: string,
  ignoreWhitespace?: boolean,
  dryRun?: boolean,
  validateSyntax?: boolean // NEW: Prettier-based syntax validation (default: true)
): Promise<ReplaceResult> {
  const progress = createProgress({ operation: "Find & Replace", quiet: true });
  progress.update(0, `${filePath} işleniyor...`);

  // First, do a dry-run to get the new content for validation
  const result = await findAndReplace(filePath, find, replace, {
    ...(ignoreWhitespace !== undefined ? { ignoreWhitespace } : {}),
    dryRun: true, // Always dry-run first for validation
  });

  // NEW: Prettier-based syntax validation (if enabled and code file)
  // NEW: Prettier-based syntax validation (if enabled and code file)
  if (
    validateSyntax !== false &&
    result.success &&
    result.replacements > 0 &&
    isCodeFile(filePath)
  ) {
    try {
      const originalContent = await readFile(filePath, "utf-8");
      // Manually apply the replacement to get new content for validation
      const newContent =
        ignoreWhitespace === true
          ? originalContent.replace(
              new RegExp(
                find
                  .split(/\s+/)
                  .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                  .join("\\s+"),
                "g"
              ),
              replace
            )
          : originalContent.split(find).join(replace);

      const syntaxCheck = await compareBeforeAfter(originalContent, newContent, filePath);

      if (!syntaxCheck.valid) {
        progress.fail("Syntax hatası tespit edildi");
        return {
          file: filePath,
          replacements: 0,
          success: false,
          error: `⚠️ Prettier syntax validation failed!\n${syntaxCheck.newErrors?.join("\n") ?? "Unknown syntax error"}\n\n💡 Tip: Use dry_run=true to preview changes, or set validate_syntax=false to skip validation.`,
        };
      }
    } catch (err) {
      // If validation fails unexpectedly, log but don't block
      logToolError("findAndReplaceCode:syntaxValidation", err as Error, { filePath });
    }
  }

  // If validation passed and not dry-run, actually write the file
  if (dryRun !== true && result.success) {
    await findAndReplace(filePath, find, replace, {
      ...(ignoreWhitespace !== undefined ? { ignoreWhitespace } : {}),
      dryRun: false, // Now actually write
    });
  }

  // Context preview oluştur (değişiklik yapıldıysa)
  let contextPreview: string | undefined;
  if (result.success && result.replacements > 0) {
    try {
      // İlk değişikliğin olduğu satırı bul
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      let firstChangeLineIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line?.includes(replace) === true) {
          firstChangeLineIndex = i;
          break;
        }
      }

      if (firstChangeLineIndex >= 0) {
        // Değişiklik yapılan ilk satır etrafında context preview
        contextPreview = await getContextPreview(
          filePath,
          firstChangeLineIndex,
          firstChangeLineIndex + 1,
          5
        );
      }
    } catch (err) {
      // Context preview oluşturulamazsa sessizce devam et
    }
  }

  if (result.success) {
    if (dryRun === true) {
      progress.done(`Preview: ${result.replacements} değişiklik`);
    } else {
      progress.done(`${result.replacements} değişiklik yapıldı`);
    }
  } else {
    progress.fail(result.error ?? "Bilinmeyen hata");
  }

  return {
    file: filePath,
    replacements: result.replacements,
    success: result.success,
    ...(result.error !== undefined && result.error.length > 0 ? { error: result.error } : {}),
    ...(result.preview !== undefined && result.preview.length > 0
      ? { preview: result.preview }
      : {}),
    ...(contextPreview !== undefined && contextPreview.length > 0 ? { contextPreview } : {}),
  };
}

// Tool Definitions
export const EXPAND_CODE_CHUNKS_TOOL = {
  name: "hev_fs_expand_code_chunks",
  description: "Dosyada kod parçalarını genişlet",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Dosya yolu" },
      line_ranges: {
        type: "array",
        items: { type: "array", items: { type: "integer" } },
        description: "Satır aralıkları",
        default: [],
      },
      patterns: {
        type: "array",
        items: { type: "string" },
        description: "Aranacak semboller",
        default: [],
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "code-operations",
  },
};

export const FIND_AND_REPLACE_TOOL = {
  name: "hev_fs_find_and_replace",
  description:
    "Dosyada bul ve değiştir. Pattern bulunamazsa yakın eşleşmeler önerir. ignore_whitespace ile whitespace-insensitive arama yapabilir.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Dosya yolu" },
      find: { type: "string", description: "Bulunacak metin (exact match)" },
      replace: { type: "string", description: "Yerine konacak metin" },
      ignore_whitespace: {
        type: "boolean",
        description:
          "Whitespace farklılıklarını görmezden gel (boşluk/tab/newline). Multi-line pattern'lerde kullanışlı.",
        default: false,
      },
      dry_run: {
        type: "boolean",
        description: "Sadece önizleme göster, değişiklik yapma",
        default: false,
      },
      validate_syntax: {
        type: "boolean",
        description:
          "Prettier ile syntax validation yap (bracket dengesi, syntax hatası). JS/TS dosyaları için önerilir.",
        default: true,
      },
    },
    required: ["file_path", "find", "replace"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "code-operations",
  },
};
