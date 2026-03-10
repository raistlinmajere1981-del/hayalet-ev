/**
 * Intent-based tool recommendation and workflow guidance.
 */

import type { ToolResult } from "@shared/index-mcp.js";
import type { TranslationParams } from "../../types/i18n.js";
import { createMcpTranslatorSync } from "../utils/i18n/index.js";

type McpTranslator = (key: string, params?: TranslationParams) => string;

interface RecommendedTool {
  name: string;
  priority: number;
  reasonKey: string;
}

interface IntentPattern {
  patterns: RegExp[];
  category: string;
  tools: RecommendedTool[];
  workflows: string[];
}

const toolDiscoveryDefinitionTranslator = createMcpTranslatorSync();

function getToolDiscoveryTranslator(): McpTranslator {
  return createMcpTranslatorSync();
}

function toolDiscoveryT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.toolDiscovery.${key}`, params);
}

function toolDiscoveryDefinitionT(key: string, params?: TranslationParams): string {
  return toolDiscoveryDefinitionTranslator(`mcpServer.toolDiscovery.definition.${key}`, params);
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    patterns: [
      /typescript.*error/i,
      /ts.*fix/i,
      /type.*issue/i,
    ],
    category: "typescript",
    tools: [
      {
        name: "hev_dev_typescript_dashboard",
        priority: 1,
        reasonKey: "typescriptErrorAnalysis",
      },
      { name: "hev_dev_safe_batch_refactor", priority: 2, reasonKey: "batchRefactorManyErrors" },
      {
        name: "hev_dev_fix_typescript_batch",
        priority: 3,
        reasonKey: "autoFixUndefinedChecks",
      },
      { name: "hev_dev_typescript_type_helper", priority: 4, reasonKey: "complexTypeConflicts" },
    ],
    workflows: ["typescript-fix-large", "typescript-fix-small"],
  },
  {
    patterns: [
      /edit.*file/i,
      /change.*code/i,
      /modify/i,
      /update.*file/i,
    ],
    category: "fileEditing",
    tools: [
      { name: "hev_fs_show", priority: 1, reasonKey: "alwaysReadFileFirst" },
      { name: "hev_dev_edit_lines", priority: 2, reasonKey: "primarySafeEditor" },
      { name: "hev_dev_check_syntax", priority: 3, reasonKey: "mandatoryValidation" },
      { name: "hev_fs_find_and_replace", priority: 4, reasonKey: "simpleStringReplacement" },
    ],
    workflows: ["file-edit-safe"],
  },
  {
    patterns: [
      /refactor/i,
      /batch.*change/i,
      /multiple.*file/i,
    ],
    category: "refactoring",
    tools: [
      {
        name: "hev_dev_safe_batch_refactor",
        priority: 1,
        reasonKey: "batchRefactorRollback",
      },
      { name: "hev_dev_analyze_project", priority: 2, reasonKey: "impactAnalysisFirst" },
      { name: "hev_fs_bash", priority: 3, reasonKey: "gitAndTestingOps" },
    ],
    workflows: ["batch-refactor"],
  },
  {
    patterns: [
      /debug/i,
      /error.*electron/i,
      /app.*crash/i,
      /not.*work/i,
    ],
    category: "debugging",
    tools: [
      { name: "hev_read_electron_logs", priority: 1, reasonKey: "checkLogsFirst" },
      { name: "hev_get_error_hints", priority: 2, reasonKey: "debugHints" },
      { name: "hev_check_electron_connection", priority: 3, reasonKey: "verifyCdpConnection" },
      { name: "hev_collect_error_context", priority: 4, reasonKey: "collectFullContext" },
    ],
    workflows: ["debug-electron"],
  },
  {
    patterns: [/eslint/i, /lint.*error/i, /code.*quality/i],
    category: "eslint",
    tools: [
      { name: "hev_dev_eslint_dashboard", priority: 1, reasonKey: "analyzeLintDistribution" },
      { name: "hev_dev_lint_file", priority: 3, reasonKey: "lintSingleFile" },
    ],
    workflows: ["eslint-fix-large"],
  },
  {
    patterns: [/git/i, /pull.*request/i, /pr/i, /commit/i],
    category: "git",
    tools: [
      { name: "hev_dev_git_diff", priority: 1, reasonKey: "reviewChangesFirst" },
      { name: "hev_git_create_pr", priority: 2, reasonKey: "createPrWithCommit" },
      { name: "hev_git_check_guidelines", priority: 3, reasonKey: "checkContributionRules" },
    ],
    workflows: ["create-pr"],
  },
  {
    patterns: [
      /memory/i,
      /remember/i,
      /context.*store/i,
      /knowledge.*base/i,
    ],
    category: "memory",
    tools: [
      { name: "hev_memory_search", priority: 1, reasonKey: "searchSharedMemoryFirst" },
      { name: "hev_memory_write", priority: 2, reasonKey: "storeDurableMemory" },
      { name: "hev_memory_update", priority: 3, reasonKey: "reviseMemorySafely" },
      { name: "hev_memory_stats", priority: 4, reasonKey: "checkMemoryHealth" },
      { name: "hev_memory_prune", priority: 5, reasonKey: "cleanMemoryBloat" },
      {
        name: "hev_memory_bootstrap_policy",
        priority: 6,
        reasonKey: "refreshPolicyMemory",
      },
    ],
    workflows: [],
  },
  {
    patterns: [
      /read.*file/i,
      /show.*file/i,
      /inspect/i,
      /view/i,
    ],
    category: "fileReading",
    tools: [
      { name: "hev_fs_show", priority: 1, reasonKey: "readWithLineNumbers" },
      { name: "hev_fs_grep", priority: 2, reasonKey: "searchInFiles" },
      { name: "hev_dev_search_symbol", priority: 3, reasonKey: "findSymbols" },
    ],
    workflows: [],
  },
  {
    patterns: [/test/i, /run.*test/i, /unittest/i],
    category: "testing",
    tools: [
      { name: "hev_dev_test_run", priority: 1, reasonKey: "runTestSuite" },
      { name: "hev_fs_bash", priority: 2, reasonKey: "customTestCommands" },
      { name: "hev_read_electron_logs", priority: 3, reasonKey: "checkTestLogs" },
    ],
    workflows: [],
  },
  {
    patterns: [
      /large.*file/i,
      /big.*file/i,
      /chunk/i,
      /50kb/i,
    ],
    category: "largeFile",
    tools: [
      {
        name: "hev_fs_start_chunked_session",
        priority: 1,
        reasonKey: "startChunkedWrite",
      },
      { name: "hev_fs_write_chunk", priority: 2, reasonKey: "writeChunksSequentially" },
      { name: "hev_fs_finalize_chunked", priority: 3, reasonKey: "finalizeChunkFlow" },
      { name: "hev_fs_chunk_session_status", priority: 4, reasonKey: "checkChunkProgress" },
    ],
    workflows: ["chunk-write"],
  },
  {
    patterns: [
      /safe.*edit/i,
      /validated.*edit/i,
      /bracket.*check/i,
      /scope.*safe/i,
    ],
    category: "safeEditing",
    tools: [
      { name: "hev_fs_show", priority: 1, reasonKey: "alwaysReadFileFirst" },
      { name: "hev_dev_edit_lines", priority: 2, reasonKey: "safeLineEditor" },
      { name: "hev_dev_check_syntax", priority: 3, reasonKey: "verifySyntaxAfterEdit" },
      { name: "hev_fs_backup", priority: 4, reasonKey: "backupBeforeRiskyEdit" },
    ],
    workflows: ["file-edit-safe"],
  },
  {
    patterns: [/new.*tool/i, /add.*tool/i, /register.*tool/i],
    category: "toolManagement",
    tools: [
      {
        name: "hev_dev_register_tool",
        priority: 1,
        reasonKey: "autoRegisterTool",
      },
      { name: "hev_suggest_tool", priority: 2, reasonKey: "toolDiscoveryGuidance" },
      { name: "hev_list_tools", priority: 3, reasonKey: "listAvailableTools" },
    ],
    workflows: [],
  },
];

export function handleSuggestTool(args: Record<string, unknown>): ToolResult {
  const t = getToolDiscoveryTranslator();
  const intent = (args["intent"] as string | undefined) ?? "";

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const context = isRecord(args["context"]) ? args["context"] : undefined;

  if (intent === "") {
    return {
      content: [
        {
          type: "text",
          text: toolDiscoveryT(t, "errors.emptyIntent"),
        },
      ],
      isError: true,
    };
  }

  const matchedPattern = INTENT_PATTERNS.find((pattern) =>
    pattern.patterns.some((compiledPattern) => compiledPattern.test(intent))
  );

  if (!matchedPattern) {
    return {
      content: [
        {
          type: "text",
          text: [
            toolDiscoveryT(t, "fallback.title", { intent }),
            "",
            toolDiscoveryT(t, "fallback.genericTitle"),
            `1. ${toolDiscoveryT(t, "fallback.fileOperations")}`,
            `2. ${toolDiscoveryT(t, "fallback.devTools")}`,
            `3. ${toolDiscoveryT(t, "fallback.debugging")}`,
            `4. ${toolDiscoveryT(t, "fallback.git")}`,
            "",
            toolDiscoveryT(t, "fallback.listToolsHint"),
          ].join("\n"),
        },
      ],
    };
  }

  const categoryLabel = toolDiscoveryT(t, `categories.${matchedPattern.category}`);
  let response = `${toolDiscoveryT(t, "response.title", { category: categoryLabel })}\n\n`;

  matchedPattern.tools.forEach((tool) => {
    response += `${tool.priority}. **${tool.name}**\n`;
    response += `   ${toolDiscoveryT(t, "response.reasonLine", {
      reason: toolDiscoveryT(t, `reasons.${tool.reasonKey}`),
    })}\n\n`;
  });

  if (context) {
    response += `\n${toolDiscoveryT(t, "contextAdjustment.title")}\n\n`;

    const errorCount = context["errorCount"];
    if (typeof errorCount === "number") {
      if (errorCount > 100) {
        response += `${toolDiscoveryT(t, "contextAdjustment.highErrorCount", { errorCount })}\n`;
      } else if (errorCount < 20) {
        response += `${toolDiscoveryT(t, "contextAdjustment.lowErrorCount", { errorCount })}\n`;
      }
    }

    const fileType = context["fileType"];
    if (typeof fileType === "string" && fileType !== "") {
      response += `${toolDiscoveryT(t, "contextAdjustment.fileType", { fileType })}\n`;
    }
  }

  return {
    content: [{ type: "text", text: response }],
  };
}

export const TOOL_DISCOVERY_DEFINITIONS = [
  {
    name: "hev_suggest_tool",
    description: toolDiscoveryDefinitionT("description"),
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: toolDiscoveryDefinitionT("intent"),
        },
        context: {
          type: "object",
          description: toolDiscoveryDefinitionT("context"),
          properties: {
            fileType: { type: "string", description: toolDiscoveryDefinitionT("fileType") },
            errorCount: { type: "number", description: toolDiscoveryDefinitionT("errorCount") },
            operation: {
              type: "string",
              enum: ["read", "write", "debug", "test", "refactor"],
              description: toolDiscoveryDefinitionT("operation"),
            },
          },
        },
      },
      required: ["intent"],
    },
    metadata: {
      category: "core",
      subcategory: "discovery",
      priority: "critical",
      complexity: "simple",
      useCases: [
        toolDiscoveryDefinitionT("useCases.decideTool"),
        toolDiscoveryDefinitionT("useCases.findPath"),
      ],
      relatedTools: ["hev_list_tools"],
      agentGuidance: toolDiscoveryDefinitionT("agentGuidance"),
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["discovery", "recommendation", "intent"],
    },
  },
];
