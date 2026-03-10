/**
 * Development Tools - AST-based Code Insertion
 *
 * TypeScript AST kullanarak kod ekleme yapar (duplicate prevention)
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { logToolError } from "../../utils/mcp-logger.js";

interface ASTInsertOptions {
  file_path: string;
  after_pattern: string; // Function/class name or regex
  insert_type: "if_block" | "function" | "method" | "import" | "export";
  code: string;
  dry_run?: boolean;
}

interface ASTInsertResult {
  success: boolean;
  output: string;
  preview?: string;
  inserted_at?: number;
}

function astInsertT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.astInsert.${key}`, params);
}

function astInsertDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.astInsert.definition.${key}`, params);
}

export function insertCodeWithAST(
  options: ASTInsertOptions,
  projectRoot?: string
): ASTInsertResult {
  const {
    file_path: filePath,
    after_pattern: afterPattern,
    insert_type: insertType,
    code,
    dry_run: dryRun = true,
  } = options;

  const fullPath = projectRoot !== undefined ? join(projectRoot, filePath) : filePath;

  try {
    const content = readFileSync(fullPath, "utf-8");
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    // Find insertion point using AST
    const insertionPoint = findInsertionPoint(sourceFile, afterPattern, insertType);

    if (!insertionPoint) {
      return {
        success: false,
        output: astInsertT("runtime.insertionPointNotFound", { afterPattern }),
      };
    }

    // Insert code at the found position
    const lines = content.split("\n");
    const newCode = formatCode(code, insertType, lines[insertionPoint.line - 1] ?? "");

    lines.splice(insertionPoint.line, 0, newCode);
    const newContent = lines.join("\n");

    // Generate preview
    const preview = generatePreview(lines, insertionPoint.line, newCode);

    // Apply if not dry run
    if (!dryRun) {
      writeFileSync(fullPath, newContent, "utf-8");
    }

    return {
      success: true,
      output: formatOutput(filePath, insertionPoint.line, dryRun),
      preview,
      inserted_at: insertionPoint.line,
    };
  } catch (error) {
    logToolError("ast-code-inserter", error as Error, {});
    return {
      success: false,
      output: astInsertT("runtime.error", { message: String(error) }),
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function findInsertionPoint(
  sourceFile: ts.SourceFile,
  pattern: string,
  _insertType: string
): { line: number; column: number } | null {
  let insertionPoint: { line: number; column: number } | null = null;

  function visit(node: ts.Node): void {
    // Find the target node based on pattern
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const name = node.name?.getText(sourceFile);
      if (name !== undefined && (name === pattern || name.match(new RegExp(pattern)))) {
        // Insert after this function/method
        const pos = sourceFile.getLineAndCharacterOfPosition(node.end);
        insertionPoint = { line: pos.line + 1, column: 0 };
      }
    }

    if (ts.isIfStatement(node)) {
      const text = node.getText(sourceFile).substring(0, 50);
      if (text.includes(pattern)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.end);
        insertionPoint = { line: pos.line + 1, column: 0 };
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return insertionPoint;
}

function formatCode(code: string, _insertType: string, previousLine: string): string {
  // Match indentation of previous line
  const indent = previousLine.match(/^\\s*/)?.[0] ?? "";

  const lines = code.split("\\n");
  return lines
    .map((line, idx) => {
      if (idx === 0) return `${indent}${line}`;
      return `${indent}${line}`;
    })
    .join("\\n");
}

function generatePreview(lines: string[], insertLine: number, newCode: string): string {
  let preview = `${astInsertT("runtime.previewTitle")}\\n`;
  preview += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
  preview += `${astInsertT("runtime.insertionPointLine", { insertLine })}\\n\\n`;

  const start = Math.max(0, insertLine - 3);
  const end = Math.min(lines.length, insertLine + 3);

  for (let i = start; i < end; i++) {
    if (i === insertLine) {
      preview += `+ ${newCode}\\n`;
    }
    const marker = i === insertLine - 1 ? "→" : " ";
    preview += `${marker} ${i + 1} │ ${lines[i] ?? ""}\\n`;
  }

  return preview;
}

function formatOutput(filePath: string, line: number, dryRun: boolean): string {
  let output = `${astInsertT("runtime.title")}\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
  output += `${astInsertT("runtime.fileLine", { filePath })}\\n`;
  output += `${astInsertT("runtime.lineLine", { line })}\\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n`;

  if (dryRun) {
    output += `${astInsertT("runtime.dryRun")}\\n`;
    output += `\\n${astInsertT("runtime.applyHint")}\\n`;
  } else {
    output += `${astInsertT("runtime.success")}\\n`;
  }

  return output;
}

// ============================================
// MCP Tool Definition
// ============================================

export const AST_CODE_INSERTER_TOOL = {
  name: "hev_dev_ast_insert",
  description: astInsertDefT("description"),
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: astInsertDefT("filePath"),
      },
      after_pattern: {
        type: "string",
        description: astInsertDefT("afterPattern"),
      },
      insert_type: {
        type: "string",
        enum: ["if_block", "function", "method", "import", "export"],
        description: astInsertDefT("insertType"),
      },
      code: {
        type: "string",
        description: astInsertDefT("code"),
      },
      dry_run: {
        type: "boolean",
        description: astInsertDefT("dryRun"),
        default: true,
      },
    },
    required: ["file_path", "after_pattern", "insert_type", "code"],
  },
  metadata: {
    category: "development",
    subcategory: "code-editing",
    priority: "high",
    complexity: "complex",
    useCases: [
      astInsertDefT("useCases.astAware"),
      astInsertDefT("useCases.preventDuplicates"),
      astInsertDefT("useCases.smartPositioning"),
    ],
    relatedTools: ["hev_dev_smart_insert", "hev_fs_find_and_replace", "hev_dev_edit_lines"],
    agentGuidance: astInsertDefT("agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["ast", "insert", "duplicate-prevention", "smart-positioning"],
  },
};
