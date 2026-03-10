/**
 * Development Tools - Structure Visualizer
 *
 * Public surface + MCP tool definition.
 * Core implementation lives in structure-visualizer-core.ts
 */

import { createMcpTranslatorSync } from "../../utils/i18n/index.js";

export { visualizeStructure, countBracketsContextAware } from "./structure-visualizer-core.js";

function structureVizDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(
    `mcpServer.devTools.structureVisualizer.definition.${key}`,
    params
  );
}

// ============================================
// MCP Tool Definition
// ============================================

export const STRUCTURE_VISUALIZER_TOOL = {
  name: "hev_dev_visualize_structure",
  description: structureVizDefT("description"),
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: structureVizDefT("filePath"),
      },
      show_scopes: {
        type: "boolean",
        description: structureVizDefT("showScopes"),
        default: true,
      },
      show_brackets: {
        type: "boolean",
        description: structureVizDefT("showBrackets"),
        default: true,
      },
      show_comments: {
        type: "boolean",
        description: structureVizDefT("showComments"),
        default: false,
      },
      show_strings: {
        type: "boolean",
        description: structureVizDefT("showStrings"),
        default: false,
      },
      max_depth: {
        type: "number",
        description: structureVizDefT("maxDepth"),
        default: 10,
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "development",
    subcategory: "analysis",
    priority: "medium",
    complexity: "complex",
    useCases: [
      structureVizDefT("useCases.visualizeScopes"),
      structureVizDefT("useCases.detectUnclosed"),
      structureVizDefT("useCases.commentAst"),
    ],
    relatedTools: ["hev_dev_check_syntax", "hev_fs_show"],
    agentGuidance: structureVizDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["ast", "structure", "visualization", "scopes", "brackets", "advanced"],
  },
};
