/**
 * ElectronTools - Electron test ve plugin araçları
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { logToolError } from "../utils/mcp-logger.js";
import { ELECTRON_TIMEOUTS } from "../utils/timeouts.js";
import type { ToolResult } from "../types/index.js";

const execAsync = promisify(exec);

/** Plugin info */
interface PluginInfo {
  name: string;
  version: string;
  description: string;
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
    logToolError("test_electron", error, { timeout });
    return {
      content: [{ type: "text", text: `❌ Electron test hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * list_plugins handler
 */
export async function listPlugins(projectRoot: string): Promise<ToolResult> {
  const pluginsDir = join(projectRoot, "plugins");
  const plugins: PluginInfo[] = [];
  
  if (!existsSync(pluginsDir)) {
    return {
      content: [{ type: "text", text: "Plugin dizini bulunamadı" }],
    };
  }
  
  const dirs = await readdir(pluginsDir, { withFileTypes: true });
  
  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const manifestPath = join(pluginsDir, dir.name, ".claude-plugin", "plugin.json");
      try {
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as {
            name?: string;
            version?: string;
            description?: string;
          };
          plugins.push({
            name: manifest.name || dir.name,
            version: manifest.version || "unknown",
            description: manifest.description || "No description",
          });
        } else {
          plugins.push({
            name: dir.name,
            version: "unknown",
            description: "No manifest",
          });
        }
      } catch {
        plugins.push({
          name: dir.name,
          version: "unknown",
          description: "Parse error",
        });
      }
    }
  }
  
  return {
    content: [
      {
        type: "text",
        text: `Hayalet-ev Plugin'leri:\n${plugins.map(p => `- ${p.name} (${p.version}): ${p.description}`).join("\n")}`,
      },
    ],
  };
}
