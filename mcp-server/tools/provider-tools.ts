/**
 * ProviderTools - Provider yönetim araçları
 */

import { readdir, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { ToolResult } from "../types/index.js";

/** Provider info */
interface ProviderInfo {
  name: string;
  hasConfig: boolean;
  hasIndex: boolean;
}

/**
 * list_providers handler
 */
export async function listProviders(projectRoot: string): Promise<ToolResult> {
  const providersDir = join(projectRoot, "src/js/modules/webview/providers");
  
  if (!existsSync(providersDir)) {
    return {
      content: [{ type: "text", text: "Provider dizini bulunamadı" }],
    };
  }
  
  const entries = await readdir(providersDir, { withFileTypes: true });
  const providers: ProviderInfo[] = [];
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "shared") {
      const providerDir = join(providersDir, entry.name);
      providers.push({
        name: entry.name,
        hasConfig: existsSync(join(providerDir, "config.js")) || existsSync(join(providerDir, "config.ts")),
        hasIndex: existsSync(join(providerDir, "index.js")) || existsSync(join(providerDir, "index.ts")),
      });
    }
  }
  
  const output = providers.map(p => {
    const status = p.hasConfig && p.hasIndex ? "✅" : "⚠️";
    return `${status} ${p.name} (config: ${p.hasConfig ? "✓" : "✗"}, index: ${p.hasIndex ? "✓" : "✗"})`;
  }).join("\n");
  
  return {
    content: [
      {
        type: "text",
        text: `Mevcut Provider'lar:\n\n${output}`,
      },
    ],
  };
}

/**
 * add_provider handler
 */
export async function addProvider(
  projectRoot: string, 
  args: { name?: string; url?: string }
): Promise<ToolResult> {
  const { name, url } = args;
  
  if (!name || !url) {
    return {
      content: [{ type: "text", text: "❌ 'name' ve 'url' parametreleri gerekli" }],
      isError: true,
    };
  }
  
  const providerDir = join(projectRoot, "src/js/modules/webview/providers", name);
  
  if (existsSync(providerDir)) {
    return {
      content: [{ type: "text", text: `❌ Provider zaten var: ${name}` }],
      isError: true,
    };
  }
  
  await mkdir(providerDir, { recursive: true });
  
  // config.js template
  const configTemplate = `/**
 * ${name} Provider Config
 */

export const config = {
  id: "${name}",
  name: "${name.charAt(0).toUpperCase() + name.slice(1)}",
  url: "${url}",
  
  // Selector'lar - siteye göre güncellenmeli
  selectors: {
    messageInput: "",
    sendButton: "",
    messageList: "",
    userMessage: "",
    assistantMessage: "",
  },
  
  // Scrape config
  scrapeSelectors: {
    container: "",
    role: "",
    content: "",
  },
};

export default config;
`;
  
  await writeFile(join(providerDir, "config.js"), configTemplate);
  
  // index.js template
  const providerName = name.charAt(0).toUpperCase() + name.slice(1);
  const indexTemplate = `/**
 * ${providerName} Provider
 */

import { config } from "./config.js";

export { config };

export async function sendMessage(text, context) {
  // TODO: Implement message sending
  console.log('${providerName}: sendMessage not implemented');
}

export async function uploadFile(file, context) {
  // TODO: Implement file upload
  console.log('${providerName}: uploadFile not implemented');
}
`;
  
  await writeFile(join(providerDir, "index.js"), indexTemplate);
  
  return {
    content: [
      {
        type: "text",
        text: `✅ Provider eklendi: ${providerDir}\n\nOluşturulan dosyalar:\n- config.js\n- index.js\n\nSonraki adımlar:\n1. config.js'deki selector'ları güncelle\n2. index.js'deki fonksiyonları implement et\n3. provider-registry.js'e kaydet`,
      },
    ],
  };
}
