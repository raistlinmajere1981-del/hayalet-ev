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
        const line = lines[i];
        if (line && line.includes(replace)) {
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
export const EXPAND_CODE_CHUNKS_TOOL = {
  name: "hev_fs_expand_code_chunks",
  description: "Dosyada kod parçalarını genişlet",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Dosya yolu" },
      line_ranges: { type: "array", items: { type: "array", items: { type: "integer" } }, description: "Satır aralıkları", default: [] },
      patterns: { type: "array", items: { type: "string" }, description: "Aranacak semboller", default: [] }
    },
    required: ["file_path"]
  }
};

export const FIND_AND_REPLACE_TOOL = {
  name: "hev_fs_find_and_replace",
  description: "Dosyada bul ve değiştir",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "Dosya yolu" },
      find: { type: "string", description: "Bulunacak metin" },
      replace: { type: "string", description: "Yerine konacak metin" },
      ignore_whitespace: { type: "boolean", description: "Whitespace ignore et", default: false },
      dry_run: { type: "boolean", description: "Önizleme modu", default: false }
    },
    required: ["file_path", "find", "replace"]
  }
};
