/**
 * Tool Discovery
 *
 * Intent-based tool recommendation and workflow guidance.
 * Helps agents choose the right tool for the task.
 *
 * @version 1.0.0
 * @created 2026-01-31
 */

import type { ToolResult } from "@shared/index-mcp.js";

/**
 * Intent patterns mapped to recommended tools
 */
const INTENT_PATTERNS = [
  {
    patterns: [
      /typescript.*error/i,
      /ts.*fix/i,
      /type.*issue/i,
      /typescript.*hata/i,
      /ts.*düzelt/i,
      /type.*sorun/i,
    ],
    category: "typescript",
    tools: [
      {
        name: "hev_dev_typescript_dashboard",
        priority: 1,
        reason: "Start with error analysis & distribution",
      },
      { name: "hev_dev_safe_batch_refactor", priority: 2, reason: "For 50+ similar errors" },
      {
        name: "hev_dev_fix_typescript_batch",
        priority: 3,
        reason: "Auto-fix undefined checks (TS2722/TS2532)",
      },
      { name: "hev_dev_typescript_type_helper", priority: 4, reason: "For complex type conflicts" },
    ],
    workflows: ["typescript-fix-large", "typescript-fix-small"],
  },
  {
    patterns: [
      /edit.*file/i,
      /change.*code/i,
      /modify/i,
      /update.*file/i,
      /dosya.*düzenle/i,
      /kod.*değiştir/i,
      /güncelle/i,
    ],
    category: "file-editing",
    tools: [
      { name: "hev_fs_show", priority: 1, reason: "ALWAYS read file first" },
      { name: "hev_dev_edit_lines", priority: 2, reason: "Primary editing tool (safe_mode)" },
      { name: "hev_dev_check_syntax", priority: 3, reason: "MANDATORY validation after edit" },
      { name: "hev_fs_find_and_replace", priority: 4, reason: "For simple string replacements" },
    ],
    workflows: ["file-edit-safe"],
  },
  {
    patterns: [
      /refactor/i,
      /batch.*change/i,
      /multiple.*file/i,
      /toplu.*değişiklik/i,
      /yeniden.*yapılandır/i,
    ],
    category: "refactoring",
    tools: [
      {
        name: "hev_dev_safe_batch_refactor",
        priority: 1,
        reason: "Batch refactoring with auto-rollback",
      },
      { name: "hev_dev_analyze_project", priority: 2, reason: "Impact analysis first" },
      { name: "hev_fs_bash", priority: 3, reason: "For git operations & testing" },
    ],
    workflows: ["batch-refactor"],
  },
  {
    patterns: [
      /debug/i,
      /error.*electron/i,
      /app.*crash/i,
      /not.*work/i,
      /hata.*ayıkla/i,
      /çalışmıyor/i,
      /sorun/i,
    ],
    category: "debugging",
    tools: [
      { name: "hev_read_electron_logs", priority: 1, reason: "Check logs first" },
      { name: "hev_get_error_hints", priority: 2, reason: "Get AI debugging hints" },
      { name: "hev_check_electron_connection", priority: 3, reason: "Verify CDP connection" },
      { name: "hev_collect_error_context", priority: 4, reason: "Collect full context" },
    ],
    workflows: ["debug-electron"],
  },
  {
    patterns: [/eslint/i, /lint.*error/i, /code.*quality/i, /lint.*hata/i, /kod.*kalite/i],
    category: "eslint",
    tools: [
      { name: "hev_dev_eslint_dashboard", priority: 1, reason: "Analyze error distribution" },
      { name: "hev_dev_lint_file", priority: 3, reason: "Lint single file" },
    ],
    workflows: ["eslint-fix-large"],
  },
  {
    patterns: [/git/i, /pull.*request/i, /pr/i, /commit/i],
    category: "git",
    tools: [
      { name: "hev_dev_git_diff", priority: 1, reason: "Review changes first" },
      { name: "hev_git_create_pr", priority: 2, reason: "Create PR with commit" },
      { name: "hev_git_check_guidelines", priority: 3, reason: "Check contribution rules" },
    ],
    workflows: ["create-pr"],
  },
  {
    patterns: [
      /memory/i,
      /hafiza/i,
      /hatırla/i,
      /remember/i,
      /context.*store/i,
      /knowledge.*base/i,
    ],
    category: "memory",
    tools: [
      { name: "hev_memory_search", priority: 1, reason: "Search existing shared memory first" },
      { name: "hev_memory_write", priority: 2, reason: "Store durable memory entries" },
      { name: "hev_memory_update", priority: 3, reason: "Revise existing memory entries safely" },
      { name: "hev_memory_stats", priority: 4, reason: "Check memory size and health" },
      { name: "hev_memory_prune", priority: 5, reason: "Clean up non-pinned memory bloat" },
      {
        name: "hev_memory_bootstrap_policy",
        priority: 6,
        reason: "Refresh pinned AGENTS/.rovo policy memories",
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
      /dosya.*oku/i,
      /dosya.*göster/i,
      /incele/i,
    ],
    category: "file-reading",
    tools: [
      { name: "hev_fs_show", priority: 1, reason: "Read with line numbers" },
      { name: "hev_fs_grep", priority: 2, reason: "Search in files" },
      { name: "hev_dev_search_symbol", priority: 3, reason: "Find functions/classes" },
    ],
    workflows: [],
  },
  {
    patterns: [/test/i, /run.*test/i, /unittest/i],
    category: "testing",
    tools: [
      { name: "hev_dev_test_run", priority: 1, reason: "Run test suite" },
      { name: "hev_fs_bash", priority: 2, reason: "Custom test commands" },
      { name: "hev_read_electron_logs", priority: 3, reason: "Check test logs" },
    ],
    workflows: [],
  },
  {
    patterns: [
      /large.*file/i,
      /big.*file/i,
      /chunk/i,
      /50kb/i,
      /büyük.*dosya/i,
      /büyük.*içerik/i,
      /chunk.*yaz/i,
    ],
    category: "large-file",
    tools: [
      {
        name: "hev_fs_start_chunked_session",
        priority: 1,
        reason: "Start safe chunk writing (for 50KB+ files)",
      },
      { name: "hev_fs_write_chunk", priority: 2, reason: "Write chunks sequentially" },
      { name: "hev_fs_finalize_chunked", priority: 3, reason: "Finalize and merge all chunks" },
      { name: "hev_fs_chunk_session_status", priority: 4, reason: "Check progress" },
    ],
    workflows: ["chunk-write"],
  },
  {
    patterns: [
      /safe.*edit/i,
      /güvenli.*düzenle/i,
      /validated.*edit/i,
      /bracket.*check/i,
      /scope.*safe/i,
    ],
    category: "safe-editing",
    tools: [
      { name: "hev_fs_show", priority: 1, reason: "ALWAYS read first to get line numbers" },
      {
        name: "hev_dev_edit_lines",
        priority: 2,
        reason: "Safe line editor with bracket & scope validation",
      },
      { name: "hev_dev_check_syntax", priority: 3, reason: "Verify syntax after edit" },
      { name: "hev_fs_backup", priority: 4, reason: "Create backup before risky edits" },
    ],
    workflows: ["file-edit-safe"],
  },
  {
    patterns: [/new.*tool/i, /add.*tool/i, /register.*tool/i, /yeni.*tool/i, /tool.*ekle/i],
    category: "tool-management",
    tools: [
      {
        name: "hev_dev_register_tool",
        priority: 1,
        reason: "Auto-register new tool to handlers/registry/index",
      },
      { name: "hev_suggest_tool", priority: 2, reason: "For tool discovery guidance" },
      { name: "hev_list_tools", priority: 3, reason: "List all available tools" },
    ],
    workflows: [],
  },
];

/**
 * Suggest tools based on user intent
 */
export function handleSuggestTool(args: Record<string, unknown>): ToolResult {
  const intent = (args["intent"] as string | undefined) ?? "";

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const context = isRecord(args["context"]) ? args["context"] : undefined;

  if (intent === "") {
    return {
      content: [
        {
          type: "text",
          text: '❌ Intent boş olamaz. Örnek: "TypeScript hatalarını düzelt"',
        },
      ],
      isError: true,
    };
  }

  // Match intent against patterns
  const matchedPattern = INTENT_PATTERNS.find((pattern) =>
    pattern.patterns.some((p) => p.test(intent))
  );

  if (!matchedPattern) {
    // Generic fallback
    return {
      content: [
        {
          type: "text",
          text:
            `🤔 Intent "${intent}" için spesifik öneri bulunamadı.\n\n` +
            `**Generic öneriler:**\n` +
            `1. Dosya işlemleri → \`hev_fs_*\` kategorisi\n` +
            `2. TypeScript/ESLint → \`hev_dev_*\` kategorisi\n` +
            `3. Debug → \`hev_read_electron_logs\`, \`hev_get_error_hints\`\n` +
            `4. Git → \`hev_git_*\` kategorisi\n\n` +
            `\`hev_list_tools()\` ile tüm toolları görebilirsin.`,
        },
      ],
    };
  }

  // Build recommendation
  let response = `🎯 **Önerilen Toollar:** ${matchedPattern.category}\n\n`;

  matchedPattern.tools.forEach((tool) => {
    response += `${tool.priority}. **${tool.name}**\n`;
    response += `   💡 ${tool.reason}\n\n`;
  });

  // Context-based adjustments
  if (context) {
    response += `\n📊 **Context-Based Adjustment:**\n\n`;

    const errorCount = context["errorCount"];
    if (typeof errorCount === "number") {
      if (errorCount > 100) {
        response += `- ⚠️ ${errorCount} errors detected → Use batch tools\n`;
      } else if (errorCount < 20) {
        response += `- ✅ Only ${errorCount} errors → Manual fix recommended\n`;
      }
    }

    const fileType = context["fileType"];
    if (typeof fileType === "string" && fileType !== "") {
      response += `- File type: ${fileType}\n`;
    }
  }

  return {
    content: [{ type: "text", text: response }],
  };
}

/**
 * Tool definitions for discovery tools
 */
export const TOOL_DISCOVERY_DEFINITIONS = [
  {
    name: "hev_suggest_tool",
    description:
      "AI agent'a tool önerisi yap (intent-based discovery). Ne yapmak istediğini söyle, sana en uygun toolları önerir.",
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description:
            "Ne yapmak istiyorsun? (örn: 'TypeScript hatalarını toplu düzelt', 'Dosya düzenle', 'Electron debug')",
        },
        context: {
          type: "object",
          description: "Opsiyonel context bilgisi",
          properties: {
            fileType: { type: "string", description: "Dosya tipi (.ts, .js, etc.)" },
            errorCount: { type: "number", description: "Hata sayısı" },
            operation: {
              type: "string",
              enum: ["read", "write", "debug", "test", "refactor"],
              description: "Ana operasyon tipi",
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
      useCases: ["Tool karar verme", "97 tool arasında yol bulma"],
      relatedTools: ["hev_list_tools"],
      agentGuidance: "97 tool arasında kayboluyorsan bu tool'u kullan. Intent-based smart search.",
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["discovery", "recommendation", "intent"],
    },
  },
];
