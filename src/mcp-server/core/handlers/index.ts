/**
 * Handler Registry - Bootstrap
 *
 * All tool modules are imported here and registered into the unified registry.
 * Each module returns ToolEntry[] (co-located definition + handler).
 *
 * Adding a new tool module:
 * 1. Create handler file with createXxxTools() → ToolEntry[]
 * 2. Import and add to registerAllTools() below
 * 3. Done — no other files to update
 */

import { registerTools, getToolCount, getRegistryStats } from "../registry.js";
import type { ToolContext } from "../registry.js";

import { createElectronTools } from "./electron-handlers.js";
import { createMcpAnalysisTools } from "./mcp-analysis-handlers.js";
import { createCdpTools } from "./cdp-handlers.js";
import { createFilesystemTools } from "./filesystem-handlers.js";
import { createDevTools } from "./dev-handlers.js";
import { createGitTools } from "./git-handlers.js";
import { createContextTools } from "./context-handlers.js";
import { createMemoryTools } from "./memory-handlers.js";
import { createUiTools } from "./ui-handlers.js";
import { createWebTools } from "./web-handlers.js";

/**
 * Register all tool modules into the unified registry.
 * Called once during server bootstrap.
 */
export function registerAllTools(context: ToolContext): void {
  // Each module self-registers with the central registry
  registerTools(createElectronTools(context), "electron");
  registerTools(createMcpAnalysisTools(), "mcp-analysis");
  registerTools(createCdpTools(), "cdp");
  registerTools(createFilesystemTools(context), "filesystem");
  registerTools(createDevTools(context), "dev");
  registerTools(createGitTools(), "git");
  registerTools(createContextTools(context), "context");
  registerTools(createMemoryTools(context), "memory");
  registerTools(createUiTools(), "ui");
  registerTools(createWebTools(), "web");

  // Log registration summary to stderr (MCP protocol)
  const stats = getRegistryStats();
  const categories = Object.entries(stats)
    .filter(([k]) => k !== "total")
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");

  process.stderr.write(`[Registry] ${getToolCount()} tools registered (${categories})\n`);
}

/**
 * Get handler statistics (backward compatible).
 */
export function getHandlerStats(): Record<string, number> {
  return getRegistryStats();
}
