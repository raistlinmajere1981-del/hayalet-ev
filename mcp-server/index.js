#!/usr/bin/env node

/**
 * Hayalet-ev MCP Server
 * 
 * Bu server Rovodev CLI'ye hayalet-ev projesine özel araçlar sağlar:
 * - list_providers: Mevcut AI provider'ları listele
 * - add_provider: Yeni provider ekle
 * - test_electron: Electron'u test modunda çalıştır
 * - list_plugins: Mevcut plugin'leri listele
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// MCP Server oluştur
const server = new Server(
  {
    name: "hayalet-ev-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool listesini sun
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_providers",
        description: "Hayalet-ev'deki mevcut AI provider'ları listele",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "add_provider",
        description: "Hayalet-ev'e yeni AI provider ekle",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Provider adı (örn: perplexity, ollama)",
            },
            url: {
              type: "string",
              description: "Provider URL'i",
            },
          },
          required: ["name", "url"],
        },
      },
      {
        name: "test_electron",
        description: "Hayalet-ev Electron uygulamasını test et",
        inputSchema: {
          type: "object",
          properties: {
            timeout: {
              type: "number",
              description: "Test süresi (saniye), varsayılan 5",
              default: 5,
            },
          },
        },
      },
      {
        name: "list_plugins",
        description: "Hayalet-ev plugin'lerini listele",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "read_electron_logs",
        description: "Electron console ve error loglarını oku (runtime hatalarını görmek için)",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["console", "error", "all"],
              description: "Log tipi: console (tüm loglar), error (sadece hatalar), all (her ikisi)",
              default: "all",
            },
            tail: {
              type: "number",
              description: "Son N satırı göster (varsayılan: 50)",
              default: 50,
            },
          },
        },
      },
    ],
  };
});

// Tool çağrılarını işle
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_providers": {
        const providersDir = join(PROJECT_ROOT, 'src/js/modules/webview');
        const files = await readdir(providersDir);
        const providers = files
          .filter(f => f.endsWith('-view.js'))
          .map(f => f.replace('-view.js', ''));
        
        return {
          content: [
            {
              type: "text",
              text: `Mevcut AI Provider'lar:\n${providers.map(p => `- ${p}`).join('\n')}`,
            },
          ],
        };
      }

      case "add_provider": {
        const { name: providerName, url } = args;
        const filename = `${providerName}-view.js`;
        const filepath = join(PROJECT_ROOT, 'src/js/modules/webview', filename);
        
        const template = `// ${providerName.charAt(0).toUpperCase() + providerName.slice(1)} AI Provider
export const ${providerName.charAt(0).toUpperCase() + providerName.slice(1)}View = {
    name: '${providerName}',
    url: '${url}',
    preload: null,
    
    init() {
        console.log('${providerName} view initialized');
    },
    
    onLoad() {
        console.log('${providerName} webview loaded');
    }
};
`;
        
        await writeFile(filepath, template);
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Provider eklendi: ${filepath}\n\nSonraki adımlar:\n1. electron/webview-manager.js'ye kaydet\n2. UI'da buton ekle\n3. npm run dev ile test et`,
            },
          ],
        };
      }

      case "test_electron": {
        const timeout = args.timeout || 5;
        
        try {
          const { stdout, stderr } = await execAsync('npm run dev', {
            cwd: PROJECT_ROOT,
            timeout: timeout * 1000,
          });
          
          return {
            content: [
              {
                type: "text",
                text: `Electron test başlatıldı.\n\nÇıktı:\n${stdout}\n${stderr ? `Hatalar:\n${stderr}` : ''}`,
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

      case "list_plugins": {
        const pluginsDir = join(PROJECT_ROOT, 'plugins');
        const dirs = await readdir(pluginsDir, { withFileTypes: true });
        const plugins = [];
        
        for (const dir of dirs) {
          if (dir.isDirectory()) {
            try {
              const manifestPath = join(pluginsDir, dir.name, 'manifest.json');
              const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
              plugins.push({
                name: dir.name,
                version: manifest.version,
                description: manifest.description,
              });
            } catch {
              plugins.push({
                name: dir.name,
                version: 'unknown',
                description: 'No manifest',
              });
            }
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Hayalet-ev Plugin'leri:\n${plugins.map(p => `- ${p.name} (${p.version}): ${p.description}`).join('\n')}`,
            },
          ],
        };
      }

      case "read_electron_logs": {
        const { type = "all", tail = 50 } = args;
        const { homedir } = await import('os');
        const userDataPath = join(homedir(), '.config', 'hayalet-ev');
        const consoleLogPath = join(userDataPath, 'logs', 'console.log');
        const errorLogPath = join(userDataPath, 'logs', 'error.log');
        
        const tailLines = (content, n) => {
          const lines = content.split('\n').filter(l => l.trim());
          return lines.slice(-n).join('\n');
        };
        
        let output = '';
        
        try {
          if (type === "console" || type === "all") {
            try {
              const consoleLog = await readFile(consoleLogPath, 'utf-8');
              const tailed = tailLines(consoleLog, tail);
              output += `📋 Console Logs (son ${tail} satır):\n${'='.repeat(60)}\n${tailed}\n\n`;
            } catch (err) {
              output += `📋 Console Logs: Dosya bulunamadı (${consoleLogPath})\n\n`;
            }
          }
          
          if (type === "error" || type === "all") {
            try {
              const errorLog = await readFile(errorLogPath, 'utf-8');
              const tailed = tailLines(errorLog, tail);
              output += `❌ Error Logs (son ${tail} satır):\n${'='.repeat(60)}\n${tailed}\n`;
            } catch (err) {
              output += `❌ Error Logs: Dosya bulunamadı (${errorLogPath})\n`;
            }
          }
          
          if (!output) {
            output = '✅ Henüz log yok. Electron uygulaması çalıştırıldıktan sonra loglar burada görünecek.';
          }
          
          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Log okuma hatası: ${error.message}\n\nLog dosyaları:\n- Console: ${consoleLogPath}\n- Error: ${errorLogPath}`,
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Bilinmeyen tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Hata: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Server'ı başlat
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hayalet-ev MCP Server başlatıldı");
}

main().catch((error) => {
  console.error("Server hatası:", error);
  process.exit(1);
});
