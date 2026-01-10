/**
 * ElectronTools - Electron test ve plugin araçları
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);

/**
 * test_electron handler
 */
export async function testElectron(projectRoot, args) {
  const timeout = args?.timeout || 5;
  
  try {
    const { stdout, stderr } = await execAsync("npm run start", {
      cwd: projectRoot,
      timeout: timeout * 1000,
    });
    
    return {
      content: [
        {
          type: "text",
          text: `Electron test başlatıldı.\n\nÇıktı:\n${stdout}\n${stderr ? `Hatalar:\n${stderr}` : ""}`,
        },
      ],
    };
  } catch (error) {
    if (error.killed) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Electron ${timeout} saniye çalıştı ve kapatıldı.`,
          },
        ],
      };
    }
    throw error;
  }
}

/**
 * list_plugins handler
 */
export async function listPlugins(projectRoot) {
  const pluginsDir = join(projectRoot, "plugins");
  const dirs = await readdir(pluginsDir, { withFileTypes: true });
  const plugins = [];
  
  for (const dir of dirs) {
    if (dir.isDirectory()) {
      try {
        // Yeni yapı: .claude-plugin/plugin.json
        const manifestPath = join(pluginsDir, dir.name, ".claude-plugin", "plugin.json");
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
          plugins.push({
            name: dir.name,
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
