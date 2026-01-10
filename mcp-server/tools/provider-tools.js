/**
 * ProviderTools - Provider yönetim araçları
 */

import { readdir, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * list_providers handler
 */
export async function listProviders(projectRoot) {
  const providersDir = join(projectRoot, "src/js/modules/webview/providers");
  
  if (!existsSync(providersDir)) {
    return {
      content: [{ type: "text", text: "Provider dizini bulunamadı" }],
    };
  }
  
  const entries = await readdir(providersDir, { withFileTypes: true });
  const providers = [];
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "shared") {
      const configPath = join(providersDir, entry.name, "config.js");
      let info = { name: entry.name, hasConfig: existsSync(configPath) };
      providers.push(info);
    }
  }
  
  return {
    content: [
      {
        type: "text",
        text: `Mevcut AI Provider'lar:\n${providers.map(p => `- ${p.name} ${p.hasConfig ? "✓" : "(config yok)"}`).join("\n")}`,
      },
    ],
  };
}

/**
 * add_provider handler
 */
export async function addProvider(projectRoot, args) {
  const { name: providerName, url } = args;
  const providerDir = join(projectRoot, "src/js/modules/webview/providers", providerName);
  
  if (existsSync(providerDir)) {
    return {
      content: [{ type: "text", text: `❌ Provider zaten mevcut: ${providerName}` }],
      isError: true,
    };
  }
  
  await mkdir(providerDir, { recursive: true });
  
  const configTemplate = `// ${providerName.charAt(0).toUpperCase() + providerName.slice(1)} Provider Config
export const config = {
  id: '${providerName}',
  name: '${providerName.charAt(0).toUpperCase() + providerName.slice(1)}',
  baseUrl: '${url}',
  loginUrl: '${url}',
  selectors: {
    textarea: 'textarea',
    sendButton: 'button[type="submit"]',
    messageContainer: '.message',
  },
};
`;
  
  await writeFile(join(providerDir, "config.js"), configTemplate);
  
  const indexTemplate = `// ${providerName.charAt(0).toUpperCase() + providerName.slice(1)} Provider
import { config } from './config.js';

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
