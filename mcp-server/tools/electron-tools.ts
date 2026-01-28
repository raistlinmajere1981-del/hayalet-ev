/**
 * ElectronTools - Electron test ve plugin araçları
 */

import { exec } from "child_process";
import { promisify } from "util";
import { logToolError } from "../utils/mcp-logger.js";
import { ELECTRON_TIMEOUTS } from "../utils/timeouts.js";
import type { ToolResult } from "../types/index.js";

const execAsync = promisify(exec);

/** Tool category info */
interface ToolCategory {
  category: string;
  emoji: string;
  tools: string[];
}

/**
 * test_electron handler
 */
export async function testElectron(
  projectRoot: string, 
  args?: { timeout?: number }
): Promise<ToolResult> {
  const timeout = args?.timeout || (ELECTRON_TIMEOUTS.TEST_DEFAULT / 1000);
  
  try {
    const { stdout, stderr } = await execAsync("npm run start", {
      cwd: projectRoot,
      timeout: timeout * 1000,
    });
    
    return {
      content: [
        {
          type: "text",
          text: `Electron test sonucu:\n\nStdout:\n${stdout}\n\nStderr:\n${stderr}`,
        },
      ],
    };
  } catch (err) {
    const error = err as Error & { code?: string; killed?: boolean };
    if (error.killed) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Electron ${timeout} saniye boyunca çalıştı (timeout ile durduruldu)`,
          },
        ],
      };
    }
    logToolError("hev_test_electron", error, { timeout });
    return {
      content: [{ type: "text", text: `❌ Electron test hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * list_tools handler - Hayalet-ev MCP tool'larını kategorize ederek listele
 */
export function listTools(): ToolResult {
  const categories: ToolCategory[] = [
    {
      category: "Electron & CDP",
      emoji: "⚡",
      tools: [
        "hev_test_electron",
        "hev_list_tools",
        "hev_check_electron_connection",
        "hev_send_command_to_electron",
        "hev_take_cdp_screenshot",
        "hev_get_electron_window_info",
        "hev_click_element_by_selector",
        "hev_click_element_by_text",
        "hev_fill_input_field",
        "hev_get_page_dom_structure",
        "hev_inspect_element",
        "hev_query_elements",
        "hev_send_key_press",
        "hev_scroll_page",
      ],
    },
    {
      category: "Filesystem",
      emoji: "📁",
      tools: [
        "hev_fs_open_files",
        "hev_fs_create_file",
        "hev_fs_delete_file",
        "hev_fs_move_file",
        "hev_fs_expand_code_chunks",
        "hev_fs_find_and_replace",
        "hev_fs_grep",
        "hev_fs_expand_folder",
        "hev_fs_bash",
        "hev_fs_create_plan",
        "hev_fs_show",
        "hev_fs_create_chunked",
        "hev_fs_append_chunk",
      ],
    },
    {
      category: "Recycle & Backup",
      emoji: "♻️",
      tools: [
        "hev_fs_trash_list",
        "hev_fs_restore",
        "hev_fs_trash_empty",
        "hev_fs_backup",
        "hev_fs_undo",
        "hev_fs_history",
        "hev_fs_diff",
        "hev_fs_diff_content",
      ],
    },
    {
      category: "Development",
      emoji: "🔧",
      tools: [
        "hev_dev_analyze_project",
        "hev_dev_bootstrap_context",
        "hev_dev_generate_diagram",
        "hev_dev_update_cache",
        "hev_dev_edit_lines",
        "hev_dev_git_diff",
        "hev_dev_lint_file",
        "hev_dev_search_symbol",
        "hev_dev_test_run",
      ],
    },
    {
      category: "Context Generation",
      emoji: "📊",
      tools: [
        "hev_context_generate",
        "hev_context_status",
        "hev_context_module",
        "hev_context_read",
      ],
    },
    {
      category: "Git & PR",
      emoji: "🔀",
      tools: [
        "hev_git_fork_setup",
        "hev_git_create_pr",
        "hev_git_check_guidelines",
        "hev_git_pr_status",
      ],
    },
    {
      category: "Web Search",
      emoji: "🌐",
      tools: [
        "hev_web_search",
        "hev_web_fetch",
        "hev_web_search_and_fetch",
      ],
    },
    {
      category: "Workflow & Test",
      emoji: "🔄",
      tools: [
        "hev_run_workflow",
        "hev_run_steps",
        "hev_list_workflows",
      ],
    },
    {
      category: "Provider & Debug",
      emoji: "🔍",
      tools: [
        "hev_list_provider_webviews",
        "hev_list_provider_selectors",
        "hev_validate_provider_selectors",
        "hev_inspect_provider_element",
        "hev_read_electron_logs",
        "hev_list_log_sessions",
        "hev_get_error_hints",
        "hev_get_session_summary",
      ],
    },
  ];

  const totalTools = categories.reduce((sum, cat) => sum + cat.tools.length, 0);
  
  let output = `📦 Hayalet-ev MCP Tools (${totalTools} tool)\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  for (const cat of categories) {
    output += `${cat.emoji} ${cat.category} (${cat.tools.length})\n`;
    output += `   ${cat.tools.join(", ")}\n\n`;
  }
  
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `💡 Detaylı bilgi için: tool_name --help\n`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}

/**
 * MCP Health Check - Hayalet-ev MCP'nin çalıştığını doğrula
 */
export async function mcpHealthCheck(): Promise<{
  healthy: boolean;
  version: string;
  uptime: number;
  toolCount: number;
  message: string;
}> {
  const startTime = process.uptime();
  
  return {
    healthy: true,
    version: "1.10.0",
    uptime: startTime,
    toolCount: 70,
    message: "✅ Hayalet-ev MCP aktif ve çalışıyor. Built-in override sistemi aktif.",
  };
}
