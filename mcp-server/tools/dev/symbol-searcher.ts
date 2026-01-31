/**
 * Development Tools - Symbol Searcher
 * 
 * Projede sembol arama (fonksiyon, class, interface, type, const)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles } from "./shared/utils.js";

export async function searchSymbol(projectRoot: string, symbol: string, options: { type?: "function" | "class" | "interface" | "type" | "const" | "all" } = {}): Promise<{ matches: Array<{ file: string; line: number; type: string; context: string }>; total: number }> {
  const allFiles: string[] = [];
  for (const srcDir of DEV_CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }
  
  const matches: Array<{ file: string; line: number; type: string; context: string }> = [];
  const symbolType = options.type || "all";
  
  // Build regex patterns based on type
  const patterns: Record<string, RegExp> = {
    function: new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+(${symbol})\\s*\\(`, "i"),
    class: new RegExp(`(?:export\\s+)?(?:abstract\\s+)?class\\s+(${symbol})`, "i"),
    interface: new RegExp(`(?:export\\s+)?interface\\s+(${symbol})`, "i"),
    type: new RegExp(`(?:export\\s+)?type\\s+(${symbol})\\s*=`, "i"),
    const: new RegExp(`(?:export\\s+)?const\\s+(${symbol})\\s*[=:]`, "i"),
  };
  
  const searchPatterns = symbolType === "all" ? Object.entries(patterns) : [[symbolType, patterns[symbolType]]];
  
  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const lines = content.split("\n");
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const [type, pattern] of searchPatterns as [string, RegExp][]) {
          if (pattern && pattern.test(line || '')) {
            matches.push({
              file,
              line: i + 1,
              type,
              context: (line || '').trim().slice(0, 100),
            });
          }
        }
        
        // Also search for usage (not just definition)
        if ((line || '').includes(symbol) && !matches.some(m => m.file === file && m.line === i + 1)) {
          matches.push({
            file,
            line: i + 1,
            type: "usage",
            context: (line || '').trim().slice(0, 100),
          });
        }
      }
    } catch { /* ignore */ }
  }
  
  // Limit results
  return { matches: matches.slice(0, 100), total: matches.length };
}

export const SYMBOL_SEARCHER_TOOL = {
  name: "hev_dev_search_symbol",
  description: "Projede sembol ara (fonksiyon, class, interface, type, const)",
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
    category: 'development',
    subcategory: 'analysis',
    priority: 'medium',
    complexity: 'medium',
    useCases: [
      'Find function/class definitions',
      'Locate symbol usages',
      'Code navigation and discovery'
    ],
    relatedTools: ['hev_fs_grep', 'hev_fs_open_files'],
    agentGuidance: 'Use to find symbol definitions and usages. Searches across project. Returns both definitions and usages (limited to 100 results).',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['search', 'symbols', 'code-navigation', 'definitions']
  }
};
