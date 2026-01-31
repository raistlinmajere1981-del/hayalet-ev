/**
 * Development Tools - Diagram Generator
 * 
 * Modül bağımlılık diagramı oluşturma (Mermaid/DOT)
 */

import { readFileSync } from "fs";
import { join, basename } from "path";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles } from "./shared/utils.js";

interface DiagramResult {
  format: "mermaid" | "dot";
  diagram: string;
  nodeCount: number;
  edgeCount: number;
}

export async function generateDiagram(
  projectRoot: string,
  options: { format?: "mermaid" | "dot"; module?: string; depth?: number } = {}
): Promise<DiagramResult> {
  const format = options.format || "mermaid";
  // const _maxDepth = options.depth || 10; // TODO: Implement depth limiting
  
  const allFiles: string[] = [];
  for (const srcDir of DEV_CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    allFiles.push(...files);
  }

  // Build dependency graph
  const graph: Map<string, string[]> = new Map();
  
  for (const file of allFiles) {
    const fileName = basename(file).replace(/\.(ts|js|mjs|cjs)$/, "");
    
    // Filter by module if specified
    if (options.module && !file.includes(options.module)) continue;
    
    try {
      const content = readFileSync(join(projectRoot, file), "utf-8");
      const imports = [...content.matchAll(/from\s+['"]\.\.?\/([^'"]+)['"]/g)]
        .map(m => basename(m[1] || '').replace(/\.(ts|js|mjs|cjs)$/, ''));
      
      if (imports.length > 0) {
        graph.set(fileName, imports);
      }
    } catch { /* ignore */ }
  }

  // Generate output
  let diagram = "";
  let edgeCount = 0;
  
  if (format === "mermaid") {
    diagram = "```mermaid\nflowchart TD\n";
    for (const [from, tos] of graph) {
      for (const to of tos) {
        diagram += `  ${from} --> ${to}\n`;
        edgeCount++;
      }
    }
    diagram += "```";
  } else {
    diagram = "digraph Dependencies {\n  rankdir=LR;\n  node [shape=box];\n";
    for (const [from, tos] of graph) {
      for (const to of tos) {
        diagram += `  \"${from}\" -> \"${to}\";\n`;
        edgeCount++;
      }
    }
    diagram += "}";
  }

  return {
    format,
    diagram,
    nodeCount: graph.size,
    edgeCount,
  };
}

export const DIAGRAM_GENERATOR_TOOL = {
  name: "hev_dev_generate_diagram",
  description: "Modül bağımlılık diagramı oluştur (Mermaid veya DOT formatında)",
  inputSchema: {
    type: "object" as const,
    properties: {
      format: {
        type: "string" as const,
        enum: ["mermaid", "dot"],
        description: "Çıktı formatı",
        default: "mermaid",
      },
      module: {
        type: "string" as const,
        description: "Sadece belirli modülü filtrele (örn: 'webview', 'traffic')",
      },
      depth: {
        type: "integer" as const,
        description: "Maksimum derinlik",
        default: 10,
            },
    },
  },
  metadata: {
    category: 'development',
    subcategory: 'analysis',
    priority: 'low',
    complexity: 'medium',
    useCases: [
      'Visualize module dependencies',
      'Understand project architecture',
      'Generate documentation diagrams'
    ],
    relatedTools: ['hev_dev_analyze_project', 'hev_fs_grep'],
    agentGuidance: 'Generates Mermaid or DOT diagrams. Use module parameter to filter specific areas. Good for architecture documentation.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['diagram', 'visualization', 'dependencies', 'mermaid', 'architecture']
  }
};
