/**
 * Filesystem Tools - Code Operations
 * 
 * Code-specific operations: expand chunks, find & replace
 */

import { readFile } from "fs/promises";
import { expandSymbols, expandLineRanges, addLineNumbers } from "../../utils/file-utils.js";
import { getContextPreview } from "../../utils/file-utils.js";
import { logToolError } from "../../utils/mcp-logger.js";

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
  dryRun?: boolean
): Promise<ReplaceResult> {
  const progress = createProgress({ operation: "Find & Replace", quiet: true });
  progress.update(0, `${filePath} işleniyor...`);
  
  const result = await findAndReplace(filePath, find, replace, {
    ignoreWhitespace,
    dryRun
  });
  
  // Context preview oluştur (değişiklik yapıldıysa)
  let contextPreview: string | undefined;
  if (result.success && result.replacements > 0) {
    try {
      // İlk değişikliğin olduğu satırı bul
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      let firstChangeLineIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(replace)) {
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
    if (dryRun) {
      progress.done(`Preview: ${result.replacements} değişiklik`);
    } else {
      progress.done(`${result.replacements} değişiklik yapıldı`);
    }
  } else {
    progress.fail(result.error || "Bilinmeyen hata");
  }
  
  return {
    file: filePath,
    replacements: result.replacements,
    success: result.success,
    error: result.error,
    preview: result.preview,
    contextPreview
  };
}

// Tool Definitions
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Dosya yolu",
        },
        line_ranges: {
          type: "array",
          items: {
            type: "array",
            items: { type: "integer" },
          },
          description: "Genişletilecek satır aralıkları [[start, end], ...]. Tüm dosya için [[0, -1]]",
          default: [],
        },
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "Aranacak sembol patternleri (fonksiyon, class isimleri vb.)",
          default: [],
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_fs_find_and_replace",
    description: "Dosyada bul ve değiştir. ignoreWhitespace=true ile whitespace farkları ignore edilir. dryRun=true ile önizleme modunda çalışır.",
    inputSchema: {

      properties: {
        file_path: {
          type: "string",
          description: "Dosya yolu",
        },
        find: {
          type: "string",
          description: "Bulunacak metin",
        },
        replace: {
          type: "string",
          description: "Yerine konacak metin",
        },
        ignore_whitespace: {
          type: "boolean",
          description: "Whitespace farklarını ignore et (boşluk, tab, newline sayısı fark etmez)",
          default: false,
        },
        dry_run: {
          type: "boolean",
          description: "Önizleme modu - değişiklikleri göster ama dosyaya yazma",
          default: false,
        },
      },
      required: ["file_path", "find", "replace"],
    },
  },
  {
    name: "hev_fs_grep",
    description: "Dosyalarda pattern ara. 3 mod: 1) Sadece content_pattern: içerik ara, 2) Sadece path_glob: dosya yolu ara, 3) Her ikisi: filtrelenmiş dosyalarda ara",
    inputSchema: {
      type: "object" as const,
      properties: {
        content_pattern: {
          type: "string",
          description: "Aranacak regex pattern (içerik için)",
        },
        path_glob: {
          type: "string",
          description: "Dosya yolu glob pattern (örn: '*.ts', '**/test/*.js')",
        },
      },
    },
  },
  {
    name: "hev_fs_expand_folder",
    description: "Klasör yapısını göster (tree view).",
    inputSchema: {
      type: "object" as const,
