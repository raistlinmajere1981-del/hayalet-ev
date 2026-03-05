/**
 * Development Tools - TypeScript Language Service Tools
 *
 * TS Language Service API üzerinden tip bilgisi, definition, references,
 * rename, diagnostics ve document symbols sağlayan MCP tool'ları.
 *
 * Altyapı: src/mcp-server/utils/ts-language-service.ts
 */

import { getTsLanguageService } from "../../utils/ts-language-service.js";
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

// ─── Helper: format output ──────────────────────────────

function formatTypeInfo(result: TypeInfoResult): string {
  let output = `🔍 Type Info\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `Kind: ${result.kind}`;
  if (result.kindModifiers !== "") output += ` (${result.kindModifiers})`;
  output += `\n\n${result.displayString}`;
  if (result.documentation !== "") {
    output += `\n\n📖 Documentation:\n${result.documentation}`;
  }
  return output;
}

function formatDefinitions(results: DefinitionResult[]): string {
  if (results.length === 0) return "❌ No definition found.";
  let output = `🎯 Definition${results.length > 1 ? "s" : ""} (${results.length})\n`;
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
  if (results.length === 0) return "❌ No references found.";
  const defs = results.filter((r) => r.isDefinition);
  const usages = results.filter((r) => !r.isDefinition);
  const writes = results.filter((r) => r.isWriteAccess);
  const files = [...new Set(results.map((r) => r.file))];

  let output = `🔗 References (${results.length})\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📊 ${defs.length} definitions, ${usages.length} usages, ${writes.length} writes\n`;
  output += `📁 ${files.length} files\n\n`;

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
  if (results.length === 0) return "❌ No completions available.";
  let output = `💡 Completions (${results.length})\n`;
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

  let output = `🏥 Diagnostics: ${filePath}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📊 ${errors.length} errors, ${warnings.length} warnings, ${suggestions.length} suggestions\n\n`;

  if (results.length === 0) {
    output += `✨ No issues found!\n`;
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
    return `❌ Cannot rename: ${result.reason ?? "unknown reason"}`;
  }
  if (result.edits.length === 0) {
    return `⚠️ Rename possible but no edits generated.`;
  }

  const totalChanges = result.edits.reduce((sum, e) => sum + e.changes.length, 0);
  let output = `✏️ Rename Preview\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📊 ${totalChanges} changes across ${result.edits.length} files\n\n`;

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
  if (results.length === 0) return `❌ No symbols found in ${filePath}`;

  let output = `📋 Document Symbols: ${filePath}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `📊 ${results.length} top-level symbols\n\n`;

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
  if (results.length === 0) return "❌ No signature help available.";

  let output = `📝 Signature Help\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const sig of results) {
    output += `${sig.label}\n`;
    if (sig.documentation !== "") output += `  📖 ${sig.documentation}\n`;
    if (sig.parameters.length > 0) {
      output += `  Parameters:\n`;
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
  if (!result) return "❌ No type information at this position.";
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
  let output = `📊 TS Language Service Stats\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `Available configs: ${stats.availableConfigs.join(", ")}\n`;
  output += `Loaded projects: ${stats.loadedProjects.length}\n`;
  for (const p of stats.loadedProjects) {
    output += `  → ${p.name}: ${p.fileCount} files, last used ${p.lastUsedAgo}\n`;
  }
  output += `Total files tracked: ${stats.totalFiles}\n`;
  return output;
}

// ─── Tool Definitions ───────────────────────────────────

export const TS_TYPE_INFO_TOOL = {
  name: "hev_dev_type_info",
  description:
    "Bir sembolün tip bilgisini al (hover). Tam type inference sonucu, kind, documentation döner.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
      line: {
        type: "number" as const,
        description: "Satır numarası (1-based)",
      },
      column: {
        type: "number" as const,
        description: "Sütun numarası (1-based)",
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "low",
    useCases: [
      "View inferred types",
      "Check function signatures",
      "Understand type at cursor position",
    ],
    relatedTools: ["hev_dev_go_to_definition", "hev_dev_find_references"],
    agentGuidance:
      "Use to inspect the type of any symbol. Provide file path and 1-based line:column. Returns full TypeScript type info including inferred types.",
    tags: ["typescript", "type-info", "hover", "inspection"],
  },
};

export const TS_GO_TO_DEFINITION_TOOL = {
  name: "hev_dev_go_to_definition",
  description: "Bir sembolün tanımlandığı yere git (go-to-definition). Dosya, satır, sütun döner.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
      line: {
        type: "number" as const,
        description: "Satır numarası (1-based)",
      },
      column: {
        type: "number" as const,
        description: "Sütun numarası (1-based)",
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "low",
    useCases: [
      "Navigate to function/class definition",
      "Find where a symbol is declared",
      "Jump to import source",
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_find_references"],
    agentGuidance:
      "Use to find where a symbol is defined. Returns exact file:line:column. Works cross-file within the same tsconfig project.",
    tags: ["typescript", "navigation", "definition", "go-to"],
  },
};

export const TS_FIND_REFERENCES_TOOL = {
  name: "hev_dev_find_references",
  description:
    "Bir sembolün projede kullanıldığı tüm yerleri bul (find-all-references). Cross-file, definition/usage/write ayrımı yapar.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
      line: {
        type: "number" as const,
        description: "Satır numarası (1-based)",
      },
      column: {
        type: "number" as const,
        description: "Sütun numarası (1-based)",
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "high",
    complexity: "medium",
    useCases: [
      "Find all usages of a function/variable",
      "Impact analysis before refactoring",
      "Understand symbol dependencies",
    ],
    relatedTools: ["hev_dev_safe_rename", "hev_dev_go_to_definition"],
    agentGuidance:
      "Use to find all references to a symbol across the project. Groups by file, shows definition vs usage vs write access. Works within tsconfig project scope.",
    tags: ["typescript", "references", "cross-file", "impact-analysis"],
  },
};

export const TS_SAFE_RENAME_TOOL = {
  name: "hev_dev_safe_rename",
  description:
    "Bir sembolü projede güvenli şekilde yeniden adlandır (preview). Tüm dosyalardaki değişiklikleri gösterir, uygulamaz.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
      line: {
        type: "number" as const,
        description: "Satır numarası (1-based)",
      },
      column: {
        type: "number" as const,
        description: "Sütun numarası (1-based)",
      },
      new_name: {
        type: "string" as const,
        description: "Yeni sembol adı",
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
      "Safely rename variables/functions/classes",
      "Preview rename impact before applying",
      "Cross-file symbol renaming",
    ],
    relatedTools: ["hev_dev_find_references", "hev_dev_type_info"],
    agentGuidance:
      "Use to preview a rename operation. Shows all files and positions that would change. Does NOT apply changes — use hev_fs_edit to apply after reviewing. Works cross-file within tsconfig project.",
    tags: ["typescript", "rename", "refactoring", "preview"],
  },
};

export const TS_DIAGNOSTICS_TOOL = {
  name: "hev_dev_ts_diagnostics",
  description:
    "Dosyadaki TypeScript hatalarını, uyarılarını ve önerilerini al (semantic + syntactic + suggestion).",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
    },
    required: ["file_path"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "medium",
    complexity: "low",
    useCases: [
      "Check file for TypeScript errors",
      "Get semantic diagnostics",
      "Validate types after code changes",
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_typescript_type_helper"],
    agentGuidance:
      "Use to get all TypeScript diagnostics for a single file. Faster than tsc --noEmit (only checks one file). Returns errors, warnings, and suggestions with line numbers.",
    tags: ["typescript", "diagnostics", "errors", "validation"],
  },
};

export const TS_DOCUMENT_SYMBOLS_TOOL = {
  name: "hev_dev_document_symbols",
  description:
    "Dosyadaki tüm sembolleri ağaç yapısında listele (outline). Fonksiyon, class, interface, const, type, enum.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
    },
    required: ["file_path"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "medium",
    complexity: "low",
    useCases: [
      "Get file outline/structure",
      "List all functions and classes",
      "Navigate large files",
    ],
    relatedTools: ["hev_dev_search_symbol", "hev_dev_type_info"],
    agentGuidance:
      "Use to get a hierarchical symbol tree for a file. Shows functions, classes, interfaces with line ranges. Good for understanding file structure.",
    tags: ["typescript", "symbols", "outline", "navigation"],
  },
};

export const TS_COMPLETIONS_TOOL = {
  name: "hev_dev_completions",
  description:
    "Bir pozisyonda kod tamamlama önerileri al (auto-complete). Modül export'ları dahil.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
      line: {
        type: "number" as const,
        description: "Satır numarası (1-based)",
      },
      column: {
        type: "number" as const,
        description: "Sütun numarası (1-based)",
      },
      max_items: {
        type: "number" as const,
        description: "Maksimum öneri sayısı (varsayılan: 30)",
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
      "Get code completion suggestions",
      "Explore available APIs",
      "Check object properties",
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_signature_help"],
    agentGuidance:
      "Use to get auto-complete suggestions at a position. Good for exploring available properties after a dot. Returns name, kind, and insert text.",
    tags: ["typescript", "completion", "autocomplete", "code-assist"],
  },
};

export const TS_SIGNATURE_HELP_TOOL = {
  name: "hev_dev_signature_help",
  description:
    "Fonksiyon çağrısında parametre bilgisi al (signature help). Aktif parametre işaretlenir.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu (proje köküne göre)",
      },
      line: {
        type: "number" as const,
        description: "Satır numarası (1-based)",
      },
      column: {
        type: "number" as const,
        description: "Sütun numarası (1-based), fonksiyon parantezinin içinde olmalı",
      },
    },
    required: ["file_path", "line", "column"],
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "low",
    complexity: "low",
    useCases: [
      "Get function parameter hints",
      "Check expected argument types",
      "Understand function signatures",
    ],
    relatedTools: ["hev_dev_type_info", "hev_dev_completions"],
    agentGuidance:
      "Use inside a function call to get parameter information. Cursor must be inside the parentheses. Shows parameter names, types, and documentation.",
    tags: ["typescript", "signature", "parameters", "function-help"],
  },
};

export const TS_SERVICE_STATS_TOOL = {
  name: "hev_dev_ts_service_stats",
  description:
    "TS Language Service'in durumunu göster (yüklü projeler, dosya sayıları, son kullanım zamanları).",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  metadata: {
    ...TS_TOOL_METADATA_BASE,
    priority: "low",
    complexity: "low",
    useCases: ["Check TS service status", "Monitor memory usage", "Debug service issues"],
    relatedTools: ["hev_dev_type_info"],
    agentGuidance:
      "Use to check which TS projects are loaded, file counts, and last usage times. Useful for debugging or understanding service state.",
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
