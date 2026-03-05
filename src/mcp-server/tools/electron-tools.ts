/**
 * ElectronTools - Electron test ve plugin araçları
 */

import { exec } from "child_process";
import { promisify } from "util";
import { logToolError } from "../utils/mcp-logger.js";
import { ELECTRON_TIMEOUTS } from "@timeouts";
import type { ToolResult } from "@shared/index-mcp.js";
import { getToolCount, getRegistryStats } from "../core/registry.js";

const execAsync = promisify(exec);

/**
 * test_electron handler
 */
export async function testElectron(
  projectRoot: string,
  args?: { timeout?: number }
): Promise<ToolResult> {
  const timeout = args?.timeout ?? ELECTRON_TIMEOUTS.TEST_DEFAULT / 1000;

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
    if (error.killed === true) {
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
 * Uses runtime registry stats instead of hardcoded categories
 */
export function listTools(): ToolResult {
  const stats = getRegistryStats();
  const totalTools = getToolCount();

  // Category emoji mapping
  const emojiMap: Record<string, string> = {
    core: "🏠",
    electron: "⚡",
    debug: "🔍",
    filesystem: "📁",
    development: "🔧",
    context: "📊",
    git: "🌿",
    workflow: "🔄",
    web: "🌐",
    ui: "🎨",
    uncategorized: "📦",
  };

  let output = `📦 Hayalet-ev MCP Tools (${totalTools} tools)\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const [category, count] of Object.entries(stats)) {
    if (category === "total") continue;
    const emoji = emojiMap[category] ?? "📦";
    output += `${emoji} ${category} (${count})\n`;
  }

  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `💡 Use hev_suggest_tool for intent-based tool discovery\n`;

  return {
    content: [{ type: "text", text: output }],
  };
}

/**
 * MCP Health Check - Hayalet-ev MCP'nin çalıştığını doğrula
 */
export function mcpHealthCheck(): {
  healthy: boolean;
  version: string;
  uptime: number;
  toolCount: number;
  message: string;
} {
  const startTime = process.uptime();
  const toolCount = getToolCount();

  return {
    healthy: true,
    version: "3.0.0",
    uptime: startTime,
    toolCount,
    message: "✅ Hayalet-ev MCP aktif ve çalışıyor.",
  };
}
