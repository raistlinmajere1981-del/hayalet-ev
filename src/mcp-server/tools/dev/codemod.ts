/**
 * Development Tools - Codemod
 *
 * AST-based code transformations using jscodeshift
 * Safe refactoring with formatting preservation
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  replaceFunctionCalls,
  renameVariable,
  replaceImportSource,
  addImport,
  removeUnusedImports,
  batchTransform,
} from "../../utils/ast-transformer.js";
import { validateWithPrettier } from "../../utils/prettier-validator.js";
import { logToolError } from "../../utils/mcp-logger.js";

interface CodemodOptions {
  file_path: string;
  transformation: {
    type: "function_call" | "variable" | "import" | "add_import" | "remove_unused" | "batch";
    old_name?: string;
    new_name?: string;
    old_source?: string;
    new_source?: string;
    imports?: string[];
    source?: string;
    operations?: Array<{
      type: "function_call" | "variable" | "import";
      old_name?: string;
      new_name?: string;
      old_source?: string;
      new_source?: string;
    }>;
  };
  dry_run?: boolean;
  validate_syntax?: boolean;
}

interface CodemodResult {
  success: boolean;
  code?: string;
  modified: boolean;
  error?: string;
  syntax_valid?: boolean;
  file_path: string;
}

/**
 * Run a codemod transformation
 *
 * @example
 * // Rename function calls
 * runCodemod({
 *   file_path: 'file.js',
 *   transformation: { type: 'function_call', old_name: 'oldFunc', new_name: 'newFunc' },
 *   dry_run: true
 * })
 */
export async function runCodemod(options: CodemodOptions): Promise<CodemodResult> {
  const {
    file_path: filePath,
    transformation,
    dry_run: dryRun = false,
    validate_syntax: validateSyntax = true,
  } = options;

  if (!existsSync(filePath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`,
      modified: false,
      file_path: filePath,
    };
  }

  try {
    const originalCode = readFileSync(filePath, "utf-8");
    let result;

    switch (transformation.type) {
      case "function_call":
        if (
          transformation.old_name == null ||
          transformation.old_name === "" ||
          transformation.new_name == null ||
          transformation.new_name === ""
        ) {
          return {
            success: false,
            error: "old_name and new_name are required for function_call",
            modified: false,
            file_path: filePath,
          };
        }
        result = replaceFunctionCalls(
          originalCode,
          filePath,
          transformation.old_name,
          transformation.new_name
        );
        break;

      case "variable":
        if (
          transformation.old_name == null ||
          transformation.old_name === "" ||
          transformation.new_name == null ||
          transformation.new_name === ""
        ) {
          return {
            success: false,
            error: "old_name and new_name are required for variable",
            modified: false,
            file_path: filePath,
          };
        }
        result = renameVariable(
          originalCode,
          filePath,
          transformation.old_name,
          transformation.new_name
        );
        break;

      case "import":
        if (
          transformation.old_source == null ||
          transformation.old_source === "" ||
          transformation.new_source == null ||
          transformation.new_source === ""
        ) {
          return {
            success: false,
            error: "old_source and new_source are required for import",
            modified: false,
            file_path: filePath,
          };
        }
        result = replaceImportSource(
          originalCode,
          filePath,
          transformation.old_source,
          transformation.new_source
        );
        break;

      case "add_import":
        if (
          transformation.imports == null ||
          transformation.source == null ||
          transformation.source === ""
        ) {
          return {
            success: false,
            error: "imports and source are required for add_import",
            modified: false,
            file_path: filePath,
          };
        }
        result = addImport(originalCode, filePath, transformation.imports, transformation.source);
        break;

      case "remove_unused":
        result = removeUnusedImports(originalCode, filePath);
        break;

      case "batch":
        if (!transformation.operations || transformation.operations.length === 0) {
          return {
            success: false,
            error: "operations array is required for batch",
            modified: false,
            file_path: filePath,
          };
        }
        result = batchTransform(originalCode, filePath, transformation.operations);
        break;

      default:
        return {
          success: false,
          error: `Unknown transformation type: ${(transformation as { type: string }).type}`,
          modified: false,
          file_path: filePath,
        };
    }

    if (!result.success) {
      return {
        success: false,
        ...(result.error != null && result.error !== "" ? { error: result.error } : {}),
        modified: false,
        file_path: filePath,
      };
    }

    // Syntax validation
    const syntaxValid = true;
    if (validateSyntax && result.modified && result.code != null && result.code !== "") {
      const syntaxCheck = await validateWithPrettier(result.code, filePath);
      if (!syntaxCheck.valid) {
        return {
          success: false,
          error: `Syntax validation failed: ${syntaxCheck.error ?? "unknown"}`,
          modified: false,
          syntax_valid: false,
          file_path: filePath,
        };
      }
    }

    // Write file (if not dry-run and modified)
    if (!dryRun && result.modified && result.code != null && result.code !== "") {
      writeFileSync(filePath, result.code, "utf-8");
    }

    return {
      success: true,
      ...(result.code != null && result.code !== "" ? { code: result.code } : {}),
      modified: result.modified,
      syntax_valid: syntaxValid,
      file_path: filePath,
    };
  } catch (error) {
    logToolError("hev_dev_codemod", error as Error, options);
    return {
      success: false,
      error: (error as Error).message,
      modified: false,
      file_path: filePath,
    };
  }
}

// ============================================
// Tool Definition
// ============================================

export const CODEMOD_TOOL = {
  name: "hev_dev_codemod",
  description:
    "AST-based safe code transformations using jscodeshift. transformation: {type, old_name?, new_name?, old_source?, new_source?, imports?, source?, operations?} formatında — type zorunlu. Tipler: function_call (old_name→new_name), variable (old_name→new_name), import (old_source→new_source), add_import (imports+source), remove_unused, batch (operations[]). dry_run=true ile önce test et.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Dosya yolu",
      },
      transformation: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["function_call", "variable", "import", "add_import", "remove_unused", "batch"],
            description:
              "Transformation type: 'function_call' (rename function), 'variable' (rename var), 'import' (change import source), 'add_import' (add new import), 'remove_unused' (clean unused imports), 'batch' (multiple operations)",
          },
          old_name: {
            type: "string",
            description: "Eski isim (function_call, variable için gerekli)",
          },
          new_name: {
            type: "string",
            description: "Yeni isim (function_call, variable için gerekli)",
          },
          old_source: {
            type: "string",
            description: "Eski import path (import için gerekli, örn: './old-path')",
          },
          new_source: {
            type: "string",
            description: "Yeni import path (import için gerekli, örn: './new-path')",
          },
          imports: {
            type: "array",
            items: { type: "string" },
            description:
              "Import edilecek isimler (add_import için gerekli, örn: ['useState', 'useEffect'])",
          },
          source: {
            type: "string",
            description: "Import kaynağı (add_import için gerekli, örn: 'react')",
          },
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["function_call", "variable", "import"],
                },
                old_name: { type: "string" },
                new_name: { type: "string" },
                old_source: { type: "string" },
                new_source: { type: "string" },
              },
            },
            description: "Batch operations (batch için gerekli)",
          },
        },
        required: ["type"],
      },
      dry_run: {
        type: "boolean",
        description: "Sadece önizleme, dosya değişmez",
        default: true,
      },
      validate_syntax: {
        type: "boolean",
        description: "Prettier ile syntax validation",
        default: true,
      },
    },
    required: ["file_path", "transformation"],
  },
  metadata: {
    category: "development",
    subcategory: "refactoring",
    priority: "high",
    complexity: "medium",
    useCases: [
      "Safe function/variable renaming",
      "Import path updates",
      "Add/remove imports",
      "Batch refactoring operations",
    ],
    relatedTools: ["hev_dev_safe_batch_refactor", "hev_fs_find_and_replace"],
    agentGuidance:
      'Use for AST-based refactoring. Safer than regex-based tools. Formatting preserved. Always use dry_run=true first. transformation parametresi {type: "function_call"|"variable"|"import"|"add_import"|"remove_unused"|"batch"} objesi alır — type zorunlu, diğer alanlar type\'a göre değişir. Batch için operations: [{type, old_name, new_name}] kullan.',
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["refactoring", "ast", "jscodeshift", "safe", "codemod"],
  },
};
