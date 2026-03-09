/**
 * Development Tools - TypeScript Language Service Tools
 *
 * MCP tools powered by the TS Language Service API for type info, definitions,
 * references, rename, diagnostics, and document symbols.
 *
 * Backend: src/mcp-server/utils/ts-language-service.ts
 */

import { getTsLanguageService } from "../../utils/ts-language-service.js";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import type {
  TypeInfoResult,
  DefinitionResult,
  ReferenceResult,
  CompletionResult,
  DiagnosticResult,
  RenameEdit,
  DocumentSymbolResult,
  SignatureHelpResult,
} from "../../utils/ts-language-service.js";

// ─── Shared metadata ────────────────────────────────────

const TS_TOOL_METADATA_BASE = {
  category: "development" as const,
  subcategory: "typescript-language" as const,
  requiresConfirmation: false,
  riskLevel: "low" as const,
};

function tsLangT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.tsLanguage.${key}`, params);
}

function tsLangDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.tsLanguage.definition.${key}`, params);
}

// ─── Helper: format output ──────────────────────────────

function formatTypeInfo(result: TypeInfoResult): string {
  let output = `${tsLangT("runtime.typeInfoTitle")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += tsLangT("runtime.kind", { kind: result.kind });
  if (result.kindModifiers !== "") output += ` (${result.kindModifiers})`;
  output += `\n\n${result.displayString}`;
  if (result.documentation !== "") {
    output += `\n\n${tsLangT("runtime.documentationTitle")}\n${result.documentation}`;
  }
  return output;
}

function formatDefinitions(results: DefinitionResult[]): string {
  if (results.length === 0) return tsLangT("runtime.noDefinition");
  let output = `${tsLangT("runtime.definitionTitle", { count: results.length })}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  for (const def of results) {
    output += `📁 ${def.file}:${def.line}:${def.column}`;
    if (def.kind !== undefined && def.kind.length > 0) output += ` [${def.kind}]`;
    if (def.name !== undefined && def.name.length > 0) output += ` ${def.name}`;
    if (def.containerName !== undefined && def.containerName.length > 0)
      output += ` in ${def.containerName}`;
    output += `\n`;
  }
  return output;
}

function formatReferences(results: ReferenceResult[]): string {
  if (results.length === 0) return tsLangT("runtime.noReferences");
  const defs = results.filter((r) => r.isDefinition);
  const usages = results.filter((r) => !r.isDefinition);
  const writes = results.filter((r) => r.isWriteAccess);
  const files = [...new Set(results.map((r) => r.file))];

  let output = `${tsLangT("runtime.referencesTitle", { count: results.length })}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output +=
    tsLangT("runtime.referencesSummary", {
      definitions: defs.length,
      usages: usages.length,
      writes: writes.length,
    }) + "\n";
  output += `${tsLangT("runtime.filesCount", { count: files.length })}\n\n`;

  // Group by file
  for (const file of files) {
    const fileRefs = results.filter((r) => r.file === file);
    output += `📄 ${file}\n`;
    for (const ref of fileRefs) {
      const tag = ref.isDefinition ? "DEF" : ref.isWriteAccess ? "WRITE" : "READ";
      output += `  L${ref.line}:${ref.column} [${tag}] ${ref.lineText}\n`;
    }
    output += `\n`;
  }
  return output;
}

function formatCompletions(results: CompletionResult[]): string {
  if (results.length === 0) return tsLangT("runtime.noCompletions");
  let output = `${tsLangT("runtime.completionsTitle", { count: results.length })}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  for (const item of results) {
    output += `  ${item.kind.padEnd(12)} ${item.name}`;
    if (item.insertText !== undefined && item.insertText !== item.name) {
      output += ` → ${item.insertText}`;
    }
    output += `\n`;
  }
  return output;
}

function formatDiagnostics(results: DiagnosticResult[], filePath: string): string {
  const errors = results.filter((d) => d.category === "error");
  const warnings = results.filter((d) => d.category === "warning");
  const suggestions = results.filter((d) => d.category === "suggestion");

  let output = `${tsLangT("runtime.diagnosticsTitle", { filePath })}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output +=
    tsLangT("runtime.diagnosticsSummary", {
      errors: errors.length,
      warnings: warnings.length,
      suggestions: suggestions.length,
    }) + "\n\n";

  if (results.length === 0) {
    output += `${tsLangT("runtime.noIssues")}\n`;
    return output;
  }

  const icons: Record<string, string> = {
    error: "❌",
    warning: "⚠️",
    suggestion: "💡",
    message: "ℹ️",
  };

  for (const diag of results) {
    const icon = icons[diag.category] ?? "ℹ️";
    output += `${icon} L${diag.line}:${diag.column} TS${diag.code}: ${diag.message}\n`;
  }
  return output;
}

function formatRenameEdits(result: {
  canRename: boolean;
  reason?: string;
  edits: RenameEdit[];
}): string {
  if (!result.canRename) {
    return tsLangT("runtime.cannotRename", {
      reason: result.reason ?? tsLangT("runtime.unknownReason"),
    });
  }
  if (result.edits.length === 0) {
    return tsLangT("runtime.renameNoEdits");
  }

  const totalChanges = result.edits.reduce((sum, e) => sum + e.changes.length, 0);
  let output = `${tsLangT("runtime.renamePreviewTitle")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output +=
    tsLangT("runtime.renameSummary", {
      changes: totalChanges,
      files: result.edits.length,
    }) + "\n\n";

  for (const edit of result.edits) {
    output += `📄 ${edit.file} (${edit.changes.length} changes)\n`;
    for (const change of edit.changes) {
      output += `  L${change.line}:${change.column} → "${change.newText}"\n`;
    }
    output += `\n`;
  }
  return output;
}

function formatDocumentSymbols(results: DocumentSymbolResult[], filePath: string): string {
  if (results.length === 0) return tsLangT("runtime.noSymbols", { filePath });

  let output = `${tsLangT("runtime.documentSymbolsTitle", { filePath })}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${tsLangT("runtime.topLevelSymbols", { count: results.length })}\n\n`;

  const renderSymbol = (sym: DocumentSymbolResult, indent: number): void => {
    const prefix = "  ".repeat(indent);
    output += `${prefix}${sym.kind.padEnd(14)} ${sym.name} (L${sym.line}-${sym.endLine})\n`;
    if (sym.children) {
      for (const child of sym.children) {
        renderSymbol(child, indent + 1);
      }
    }
  };

  for (const sym of results) {
    renderSymbol(sym, 0);
  }
  return output;
}

function formatSignatureHelp(results: SignatureHelpResult[]): string {
  if (results.length === 0) return tsLangT("runtime.noSignatureHelp");

  let output = `${tsLangT("runtime.signatureHelpTitle")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const sig of results) {
    output += `${sig.label}\n`;
    if (sig.documentation !== "")
      output += `  ${tsLangT("runtime.documentationInline", { text: sig.documentation })}\n`;
    if (sig.parameters.length > 0) {
      output += `  ${tsLangT("runtime.parametersTitle")}\n`;
      for (let i = 0; i < sig.parameters.length; i++) {
        const p = sig.parameters[i];
        if (!p) continue;
        const active = i === sig.activeParameter ? " 👈" : "";
        output += `    ${p.name}: ${p.type}${active}\n`;
        if (p.documentation !== "") output += `      ${p.documentation}\n`;
      }
    }
    output += `\n`;
  }
  return output;
}

// ─── Handler Functions ──────────────────────────────────

export function tsGetTypeInfo(
  projectRoot: string,
  filePath: string,
  line: number,
  column: number
): string {
  const mgr = getTsLanguageService(projectRoot);
  const result = mgr.getTypeInfo(filePath, line, column);
  if (!result) return tsLangT("runtime.noTypeInfo");
  return formatTypeInfo(result);
}

export function tsGetDefinition(
  projectRoot: string,
  filePath: string,
  line: number,
  column: number
): string {
  const mgr = getTsLanguageService(projectRoot);
  const results = mgr.getDefinition(filePath, line, column);
  return formatDefinitions(results);
}

export function tsGetReferences(
  projectRoot: string,
  filePath: string,
  line: number,
  column: number
): string {
  const mgr = getTsLanguageService(projectRoot);
  const results = mgr.getReferences(filePath, line, column);
  return formatReferences(results);
}

export function tsGetCompletions(
  projectRoot: string,
  filePath: string,
  line: number,
  column: number,
  maxItems?: number
): string {
  const mgr = getTsLanguageService(projectRoot);
  const results = mgr.getCompletions(
    filePath,
    line,
    column,
    maxItems !== undefined ? { maxItems } : {}
  );
  return formatCompletions(results);
}

export function tsGetDiagnostics(projectRoot: string, filePath: string): string {
  const mgr = getTsLanguageService(projectRoot);
  const results = mgr.getDiagnostics(filePath);
  return formatDiagnostics(results, filePath);
}

export function tsGetRenameEdits(
  projectRoot: string,
  filePath: string,
  line: number,
  column: number,
  newName: string
): string {
  const mgr = getTsLanguageService(projectRoot);
  const result = mgr.getRenameEdits(filePath, line, column, newName);
  return formatRenameEdits(result);
}

export function tsGetDocumentSymbols(projectRoot: string, filePath: string): string {
  const mgr = getTsLanguageService(projectRoot);
  const results = mgr.getDocumentSymbols(filePath);
  return formatDocumentSymbols(results, filePath);
}

export function tsGetSignatureHelp(
  projectRoot: string,
  filePath: string,
  line: number,
  column: number
): string {
  const mgr = getTsLanguageService(projectRoot);
  const results = mgr.getSignatureHelp(filePath, line, column);
  return formatSignatureHelp(results);
}

export function tsGetStats(projectRoot: string): string {
  const mgr = getTsLanguageService(projectRoot);
  const stats = mgr.getStats();
  let output = `${tsLangT("runtime.statsTitle")}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `${tsLangT("runtime.availableConfigs", { configs: stats.availableConfigs.join(", ") })}\n`;
  output += `${tsLangT("runtime.loadedProjects", { count: stats.loadedProjects.length })}\n`;
  for (const p of stats.loadedProjects) {
    output += `  → ${tsLangT("runtime.projectLine", {
      name: p.name,
      fileCount: p.fileCount,
      lastUsedAgo: p.lastUsedAgo,
    })}\n`;
  }
  output += `${tsLangT("runtime.totalFiles", { count: stats.totalFiles })}\n`;
  return output;
}

// ─── Tool Definitions ───────────────────────────────────

export const TS_TYPE_INFO_TOOL = {
  name: "hev_dev_type_info",
  description: tsLangDefT("typeInfo.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
      line: {
        type: "number" as const,
        description: tsLangDefT("common.line"),
      },
      column: {
        type: "number" as const,
        description: tsLangDefT("common.column"),
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "low",
    useCases: [
      tsLangDefT("typeInfo.useCases.viewTypes"),
      tsLangDefT("typeInfo.useCases.functionSignatures"),
      tsLangDefT("typeInfo.useCases.cursorType"),
    ],
    relatedTools: ["hev_dev_go_to_definition", "hev_dev_find_references"],
    agentGuidance: tsLangDefT("typeInfo.agentGuidance"),
    tags: ["typescript", "type-info", "hover", "inspection"],
  },
};

export const TS_GO_TO_DEFINITION_TOOL = {
  name: "hev_dev_go_to_definition",
  description: tsLangDefT("goToDefinition.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
      line: {
        type: "number" as const,
        description: tsLangDefT("common.line"),
      },
      column: {
        type: "number" as const,
        description: tsLangDefT("common.column"),
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "low",
    useCases: [
      tsLangDefT("goToDefinition.useCases.navigate"),
      tsLangDefT("goToDefinition.useCases.findDeclaration"),
      tsLangDefT("goToDefinition.useCases.importSource"),
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_find_references"],
    agentGuidance: tsLangDefT("goToDefinition.agentGuidance"),
    tags: ["typescript", "navigation", "definition", "go-to"],
  },
};

export const TS_FIND_REFERENCES_TOOL = {
  name: "hev_dev_find_references",
  description: tsLangDefT("findReferences.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
      line: {
        type: "number" as const,
        description: tsLangDefT("common.line"),
      },
      column: {
        type: "number" as const,
        description: tsLangDefT("common.column"),
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "medium",
    useCases: [
      tsLangDefT("findReferences.useCases.allUsages"),
      tsLangDefT("findReferences.useCases.impactAnalysis"),
      tsLangDefT("findReferences.useCases.dependencies"),
    ],
    relatedTools: ["hev_dev_safe_rename", "hev_dev_go_to_definition"],
    agentGuidance: tsLangDefT("findReferences.agentGuidance"),
    tags: ["typescript", "references", "cross-file", "impact-analysis"],
  },
};

export const TS_SAFE_RENAME_TOOL = {
  name: "hev_dev_safe_rename",
  description: tsLangDefT("safeRename.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
      line: {
        type: "number" as const,
        description: tsLangDefT("common.line"),
      },
      column: {
        type: "number" as const,
        description: tsLangDefT("common.column"),
      },
      new_name: {
        type: "string" as const,
        description: tsLangDefT("common.newName"),
      },
    },
    required: ["file_path", "line", "column", "new_name"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "medium",
    riskLevel: "low",
    useCases: [
      tsLangDefT("safeRename.useCases.safeRename"),
      tsLangDefT("safeRename.useCases.previewImpact"),
      tsLangDefT("safeRename.useCases.crossFile"),
    ],
    relatedTools: ["hev_dev_find_references", "hev_dev_type_info"],
    agentGuidance: tsLangDefT("safeRename.agentGuidance"),
    tags: ["typescript", "rename", "refactoring", "preview"],
  },
};

export const TS_DIAGNOSTICS_TOOL = {
  name: "hev_dev_ts_diagnostics",
  description: tsLangDefT("diagnostics.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
    },
    required: ["file_path"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "medium",
    complexity: "low",
    useCases: [
      tsLangDefT("diagnostics.useCases.checkFile"),
      tsLangDefT("diagnostics.useCases.semanticDiagnostics"),
      tsLangDefT("diagnostics.useCases.validateChanges"),
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_typescript_type_helper"],
    agentGuidance: tsLangDefT("diagnostics.agentGuidance"),
    tags: ["typescript", "diagnostics", "errors", "validation"],
  },
};

export const TS_DOCUMENT_SYMBOLS_TOOL = {
  name: "hev_dev_document_symbols",
  description: tsLangDefT("documentSymbols.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
    },
    required: ["file_path"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "medium",
    complexity: "low",
    useCases: [
      tsLangDefT("documentSymbols.useCases.outline"),
      tsLangDefT("documentSymbols.useCases.listSymbols"),
      tsLangDefT("documentSymbols.useCases.navigateLargeFiles"),
    ],
    relatedTools: ["hev_dev_search_symbol", "hev_dev_type_info"],
    agentGuidance: tsLangDefT("documentSymbols.agentGuidance"),
    tags: ["typescript", "symbols", "outline", "navigation"],
  },
};

export const TS_COMPLETIONS_TOOL = {
  name: "hev_dev_completions",
  description: tsLangDefT("completions.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
      line: {
        type: "number" as const,
        description: tsLangDefT("common.line"),
      },
      column: {
        type: "number" as const,
        description: tsLangDefT("common.column"),
      },
      max_items: {
        type: "number" as const,
        description: tsLangDefT("common.maxItems"),
        default: 30,
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "medium",
    complexity: "low",
    useCases: [
      tsLangDefT("completions.useCases.codeCompletion"),
      tsLangDefT("completions.useCases.exploreApis"),
      tsLangDefT("completions.useCases.objectProperties"),
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_signature_help"],
    agentGuidance: tsLangDefT("completions.agentGuidance"),
    tags: ["typescript", "completion", "autocomplete", "code-assist"],
  },
};

export const TS_SIGNATURE_HELP_TOOL = {
  name: "hev_dev_signature_help",
  description: tsLangDefT("signatureHelp.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: tsLangDefT("common.filePath"),
      },
      line: {
        type: "number" as const,
        description: tsLangDefT("common.line"),
      },
      column: {
        type: "number" as const,
        description: tsLangDefT("signatureHelp.column"),
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "low",
    complexity: "low",
    useCases: [
      tsLangDefT("signatureHelp.useCases.parameterHints"),
      tsLangDefT("signatureHelp.useCases.argumentTypes"),
      tsLangDefT("signatureHelp.useCases.understandSignatures"),
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_completions"],
    agentGuidance: tsLangDefT("signatureHelp.agentGuidance"),
    tags: ["typescript", "signature", "parameters", "function-help"],
  },
};

export const TS_SERVICE_STATS_TOOL = {
  name: "hev_dev_ts_service_stats",
  description: tsLangDefT("serviceStats.description"),
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "low",
    complexity: "low",
    useCases: [
      tsLangDefT("serviceStats.useCases.checkStatus"),
      tsLangDefT("serviceStats.useCases.monitorMemory"),
      tsLangDefT("serviceStats.useCases.debugIssues"),
    ],
    relatedTools: ["hev_dev_type_info"],
    agentGuidance: tsLangDefT("serviceStats.agentGuidance"),
    tags: ["typescript", "service", "stats", "diagnostics"],
  },
};

// ─── All Tool Definitions ───────────────────────────────

export const TS_LANGUAGE_TOOL_DEFINITIONS = [
  TS_TYPE_INFO_TOOL,
  TS_GO_TO_DEFINITION_TOOL,
  TS_FIND_REFERENCES_TOOL,
  TS_SAFE_RENAME_TOOL,
  TS_DIAGNOSTICS_TOOL,
  TS_DOCUMENT_SYMBOLS_TOOL,
  TS_COMPLETIONS_TOOL,
  TS_SIGNATURE_HELP_TOOL,
  TS_SERVICE_STATS_TOOL,
];
