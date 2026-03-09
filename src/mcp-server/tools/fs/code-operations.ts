/**
 * Filesystem Tools - Code Operations
 *
 * Code-specific operations: expand chunks, find & replace
 */

import { readFile } from "fs/promises";
import { expandSymbols, expandLineRanges, addLineNumbers } from "../../utils/file-utils.js";
import { getContextPreview, findAndReplace } from "../../utils/file-utils.js";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { logToolError } from "../../utils/mcp-logger.js";
import { createProgress } from "../../utils/progress.js";
import { isCodeFile, compareBeforeAfter } from "../../utils/prettier-validator.js";

interface ReplaceResult {
  file: string;
  replacements: number;
  success: boolean;
  error?: string;
  preview?: string;
  contextPreview?: string;
}

function codeOpsT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.fsCodeTools.${key}`, params);
}

function codeOpsDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.fsCodeTools.definition.${key}`, params);
}

export async function expandCodeChunks(
  filePath: string,
  lineRanges: [number, number][] = [],
  patterns: string[] = []
): Promise<{ content: string; error?: string }> {
  try {
    // Search by symbol patterns first.
    if (patterns.length > 0) {
      const content = await expandSymbols(filePath, patterns);
      return { content };
    }

    // Expand via explicit line ranges.
    if (lineRanges.length > 0) {
      const content = await expandLineRanges(filePath, lineRanges);
      return { content };
    }

    // If no filter is provided, return the whole file.
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
  dryRun?: boolean,
  validateSyntax?: boolean // NEW: Prettier-based syntax validation (default: true)
): Promise<ReplaceResult> {
  const progress = createProgress({ operation: codeOpsT("progress.operation"), quiet: true });
  progress.update(0, codeOpsT("progress.processing", { filePath }));

  // First, do a dry-run to get the new content for validation
  const result = await findAndReplace(filePath, find, replace, {
    ...(ignoreWhitespace !== undefined ? { ignoreWhitespace } : {}),
    dryRun: true, // Always dry-run first for validation
  });

  // NEW: Prettier-based syntax validation (if enabled and code file)
  // NEW: Prettier-based syntax validation (if enabled and code file)
  if (
    validateSyntax !== false &&
    result.success &&
    result.replacements > 0 &&
    isCodeFile(filePath)
  ) {
    try {
      const originalContent = await readFile(filePath, "utf-8");
      // Manually apply the replacement to get new content for validation
      const newContent =
        ignoreWhitespace === true
          ? originalContent.replace(
              new RegExp(
                find
                  .split(/\s+/)
                  .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                  .join("\\s+"),
                "g"
              ),
              replace
            )
          : originalContent.split(find).join(replace);

      const syntaxCheck = await compareBeforeAfter(originalContent, newContent, filePath);

      if (!syntaxCheck.valid) {
        progress.fail(codeOpsT("progress.syntaxDetected"));
        return {
          file: filePath,
          replacements: 0,
          success: false,
          error: codeOpsT("errors.syntaxValidationFailed", {
            details: syntaxCheck.newErrors?.join("\n") ?? codeOpsT("common.unknownSyntaxError"),
          }),
        };
      }
    } catch (err) {
      // If validation fails unexpectedly, log but don't block
      logToolError("findAndReplaceCode:syntaxValidation", err as Error, { filePath });
    }
  }

  // If validation passed and not dry-run, actually write the file
  if (dryRun !== true && result.success) {
    await findAndReplace(filePath, find, replace, {
      ...(ignoreWhitespace !== undefined ? { ignoreWhitespace } : {}),
      dryRun: false, // Now actually write
    });
  }

  // Build a context preview when a change was applied.
  let contextPreview: string | undefined;
  if (result.success && result.replacements > 0) {
    try {
      // Find the first changed line.
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      let firstChangeLineIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line?.includes(replace) === true) {
          firstChangeLineIndex = i;
          break;
        }
      }

      if (firstChangeLineIndex >= 0) {
        // Show context around the first changed line.
        contextPreview = await getContextPreview(
          filePath,
          firstChangeLineIndex,
          firstChangeLineIndex + 1,
          5
        );
      }
    } catch (err) {
      // Continue silently if the context preview cannot be built.
    }
  }

  if (result.success) {
    if (dryRun === true) {
      progress.done(codeOpsT("progress.preview", { count: result.replacements }));
    } else {
      progress.done(codeOpsT("progress.applied", { count: result.replacements }));
    }
  } else {
    progress.fail(result.error ?? codeOpsT("common.unknownError"));
  }

  return {
    file: filePath,
    replacements: result.replacements,
    success: result.success,
    ...(result.error !== undefined && result.error.length > 0 ? { error: result.error } : {}),
    ...(result.preview !== undefined && result.preview.length > 0
      ? { preview: result.preview }
      : {}),
    ...(contextPreview !== undefined && contextPreview.length > 0 ? { contextPreview } : {}),
  };
}

// Tool Definitions
export const EXPAND_CODE_CHUNKS_TOOL = {
  name: "hev_fs_expand_code_chunks",
  description: codeOpsDefT("expand.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: codeOpsDefT("common.filePath") },
      line_ranges: {
        type: "array",
        items: { type: "array", items: { type: "integer" } },
        description: codeOpsDefT("expand.lineRanges"),
        default: [],
      },
      patterns: {
        type: "array",
        items: { type: "string" },
        description: codeOpsDefT("expand.patterns"),
        default: [],
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "code-operations",
    priority: "medium",
    complexity: "simple",
    useCases: [
      codeOpsDefT("expand.useCases.inspectCode"),
      codeOpsDefT("expand.useCases.expandRanges"),
      codeOpsDefT("expand.useCases.expandSymbols"),
    ],
    relatedTools: ["hev_fs_read", "hev_fs_find_and_replace"],
    agentGuidance: codeOpsDefT("expand.agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["filesystem", "code", "expand", "symbols", "ranges"],
  },
};

export const FIND_AND_REPLACE_TOOL = {
  name: "hev_fs_find_and_replace",
  description: codeOpsDefT("replace.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: codeOpsDefT("common.filePath") },
      find: { type: "string", description: codeOpsDefT("replace.find") },
      replace: { type: "string", description: codeOpsDefT("replace.replace") },
      ignore_whitespace: {
        type: "boolean",
        description: codeOpsDefT("replace.ignoreWhitespace"),
        default: false,
      },
      dry_run: {
        type: "boolean",
        description: codeOpsDefT("replace.dryRun"),
        default: false,
      },
      validate_syntax: {
        type: "boolean",
        description: codeOpsDefT("replace.validateSyntax"),
        default: true,
      },
    },
    required: ["file_path", "find", "replace"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "code-operations",
    priority: "high",
    complexity: "medium",
    useCases: [
      codeOpsDefT("replace.useCases.simpleReplacement"),
      codeOpsDefT("replace.useCases.multilineReplacement"),
      codeOpsDefT("replace.useCases.safePreview"),
    ],
    relatedTools: ["hev_dev_edit_lines", "hev_dev_check_syntax"],
    agentGuidance: codeOpsDefT("replace.agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["filesystem", "replace", "refactor", "preview", "syntax"],
  },
};
