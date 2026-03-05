/**
 * Development Tools - Symbol Searcher
 *
 * Projede sembol arama (fonksiyon, class, interface, type, const).
 * Hybrid: Regex ile hızlı tarama + TS Language Service ile tip zenginleştirme.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles } from "./shared/utils.js";
import { getTsLanguageService } from "../../utils/ts-language-service.js";

type SymbolType = "function" | "class" | "interface" | "type" | "const" | "all";

interface SymbolMatch {
  file: string;
  line: number;
  type: string;
  context: string;
  typeInfo?: string;
}

/**
 * Regex'te özel karakterleri escape et
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hybrid sembol arama: Regex ile hızlı tarama + TS API ile tip bilgisi zenginleştirme.
 */
export async function searchSymbol(
  projectRoot: string,
  symbol: string,
  options: { type?: SymbolType } = {}
): Promise<{ matches: SymbolMatch[]; total: number; method: string }> {
  const symbolType = options.type ?? "all";
  const matches: SymbolMatch[] = [];

  // Tüm proje dosyalarını topla
  const allFiles: string[] = [];
  for (const srcDir of DEV_CONFIG.srcDirs) {
    // eslint-disable-next-line no-await-in-loop
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }

  // Regex pattern'leri
  const escapedSymbol = escapeRegex(symbol);
  const patterns: Record<string, RegExp> = {
    function: new RegExp(
      `(?:export\\s+)?(?:async\\s+)?function\\s+(${escapedSymbol})\\s*[(<]`,
      "i"
    ),
    class: new RegExp(`(?:export\\s+)?(?:abstract\\s+)?class\\s+(${escapedSymbol})`, "i"),
    interface: new RegExp(`(?:export\\s+)?interface\\s+(${escapedSymbol})`, "i"),
    type: new RegExp(`(?:export\\s+)?type\\s+(${escapedSymbol})\\s*[=<]`, "i"),
    const: new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+(${escapedSymbol})\\s*[=:]`, "i"),
  };

  const searchPatterns: [string, RegExp][] =
    symbolType === "all"
      ? Object.entries(patterns)
      : [[symbolType, patterns[symbolType] as RegExp]];

  // Faz 1: Regex ile hızlı tarama (tanım arama)
  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        for (const [type, pattern] of searchPatterns) {
          if (pattern.test(line)) {
            matches.push({
              file,
              line: i + 1,
              type,
              context: line.trim().slice(0, 120),
            });
          }
        }
      }
    } catch {
      /* ignore unreadable files */
    }
  }

  // Faz 2: TS Language Service ile tip bilgisi zenginleştirme
  // Sadece tanım sonuçlarının ilk 10'unu zenginleştir (performans için)
  try {
    const mgr = getTsLanguageService(projectRoot);
    const enrichLimit = Math.min(matches.length, 10);

    for (let i = 0; i < enrichLimit; i++) {
      const m = matches[i];
      if (!m) continue;
      try {
        // Satırdaki sembolün sütun pozisyonunu bul
        const content = readFileSync(join(projectRoot, m.file), "utf-8");
        const line = content.split("\n")[m.line - 1] ?? "";
        const col = line.indexOf(symbol);
        if (col >= 0) {
          const typeInfo = mgr.getTypeInfo(m.file, m.line, col + 1);
          if (typeInfo) {
            m.typeInfo = typeInfo.displayString.slice(0, 200);
          }
        }
      } catch {
        /* skip enrichment for this match */
      }
    }
  } catch {
    /* TS API unavailable, regex results are still valid */
  }

  // Deduplicate: aynı dosya+satır+tip
  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const key = `${m.file}:${m.line}:${m.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    matches: unique.slice(0, 100),
    total: unique.length,
    method: unique.some((m) => m.typeInfo !== undefined && m.typeInfo.length > 0)
      ? "hybrid"
      : "regex",
  };
}

// ============================================
// MCP Tool Definition
// ============================================

export const SYMBOL_SEARCHER_TOOL = {
  name: "hev_dev_search_symbol",
  description:
    "Projede sembol ara (fonksiyon, class, interface, type, const). Regex tarama + TS Language Service tip bilgisi zenginleştirme.",
  inputSchema: {
    type: "object" as const,
    properties: {
      symbol: {
        type: "string" as const,
        description: "Aranacak sembol adı",
      },
      type: {
        type: "string" as const,
        enum: ["function", "class", "interface", "type", "const", "all"],
        description: "Sembol tipi",
        default: "all",
      },
    },
    required: ["symbol"],
  },
  metadata: {
    category: "development" as const,
    subcategory: "analysis" as const,
    priority: "medium" as const,
    complexity: "medium" as const,
    useCases: [
      "Find function/class definitions",
      "Locate symbol declarations",
      "Code navigation and discovery",
    ],
    relatedTools: [
      "hev_dev_find_references",
      "hev_dev_go_to_definition",
      "hev_dev_document_symbols",
    ],
    agentGuidance:
      "Use to find symbol definitions across the project. Uses fast regex scan + TS Language Service type enrichment. Returns definition locations with type info (limited to 100 results). For usage/references, prefer hev_dev_find_references.",
    requiresConfirmation: false,
    riskLevel: "low" as const,
    tags: ["search", "symbols", "code-navigation", "definitions"],
  },
};
