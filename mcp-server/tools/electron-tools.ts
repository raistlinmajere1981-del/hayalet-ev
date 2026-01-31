/**
 * ElectronTools - Electron test ve plugin araçları
 */

import { exec } from "child_process";
import { promisify } from "util";
import { logToolError } from "../utils/mcp-logger.js";
import { ELECTRON_TIMEOUTS } from "../utils/timeouts.js";
import type { ToolResult } from "../types/index.js";
import { DEV_TOOL_METADATA } from "./dev/index.js";
import { FILESYSTEM_TOOL_METADATA } from "./filesystem-tools.js";
import { SAFE_CHUNK_TOOL_METADATA } from "./safe-chunk-tools.js";
import { PROVIDER_TOOL_METADATA } from "./provider-tools.js";
import { WEB_TOOL_METADATA } from "./web-tools.js";
import { WORKFLOW_TOOL_METADATA } from "./workflow-tools.js";
import { GIT_TOOL_METADATA } from "./git-tools.js";
import { CONTEXT_TOOL_METADATA } from "./context-tools.js";
import { getAllToolDefinitions } from "../core/tools-list.js";

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
          ...FILESYSTEM_TOOL_METADATA,
          // Safe chunk tools are also filesystem
          tools: [...FILESYSTEM_TOOL_METADATA.tools, ...SAFE_CHUNK_TOOL_METADATA.tools]
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
        DEV_TOOL_METADATA,
        CONTEXT_TOOL_METADATA,
        GIT_TOOL_METADATA,
        WEB_TOOL_METADATA,
        WORKFLOW_TOOL_METADATA,
        PROVIDER_TOOL_METADATA,
        {
          category: "Provider & Debug",
          emoji: "🔍",
          tools: [
            ...PROVIDER_TOOL_METADATA.tools,
            "hev_read_electron_logs",
            "hev_list_log_sessions",
            "hev_get_error_hints",
            "hev_get_session_summary",
            "hev_collect_error_context",
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
  const allTools = getAllToolDefinitions();
  
  return {
    healthy: true,
    version: "1.10.0",
    uptime: startTime,
    toolCount: allTools.length,
    message: "✅ Hayalet-ev MCP aktif ve çalışıyor. Built-in override sistemi aktif.",
  };
}
