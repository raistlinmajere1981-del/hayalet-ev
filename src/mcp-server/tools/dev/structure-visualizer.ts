/**
 * Development Tools - Structure Visualizer
 *
 * Public surface + MCP tool definition.
 * Core implementation lives in structure-visualizer-core.ts
 */

export { visualizeStructure, countBracketsContextAware } from "./structure-visualizer-core.js";

// ============================================
// MCP Tool Definition
// ============================================

export const STRUCTURE_VISUALIZER_TOOL = {
  name: "hev_dev_visualize_structure",
  description: "Dosya yapısını görselleştir (AST scope tree, bracket analysis, unclosed detection)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Analiz edilecek dosya yolu",
      },
      show_scopes: {
        type: "boolean",
        description: "Scope hierarchy göster",
        default: true,
      },
      show_brackets: {
        type: "boolean",
        description: "Bracket analysis göster",
        default: true,
      },
      show_comments: {
        type: "boolean",
        description: "Comment blocks göster",
        default: false,
      },
      show_strings: {
        type: "boolean",
        description: "String literals göster",
        default: false,
      },
      max_depth: {
        type: "number",
        description: "Maksimum scope derinliği",
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
      "Visualize code structure and scopes",
      "Detect unclosed brackets",
      "Analyze comment blocks and AST hierarchy",
    ],
    relatedTools: ["hev_dev_check_syntax", "hev_fs_show"],
    agentGuidance:
      "Advanced AST-based structure visualization. Shows scope hierarchy, bracket analysis, and unclosed detection. Use for debugging complex nesting issues.",
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["ast", "structure", "visualization", "scopes", "brackets", "advanced"],
  },
};
