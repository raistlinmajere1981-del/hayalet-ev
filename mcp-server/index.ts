#!/usr/bin/env node

/**
 * Hayalet-ev MCP Server (Orchestrator)
 * 
 * Alt modüller:
 * - tools/provider-tools.js: Provider yönetim araçları
 * - tools/electron-tools.js: Electron test ve plugin araçları
 * - tools/log-tools.js: Log okuma ve sorgulama araçları
 * - tools/debug-tools.js: Hata analizi ve debugging araçları
 * - utils/log-utils.js: Log yardımcı fonksiyonları
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { listProviders, addProvider } from "./tools/provider-tools.js";
import { testElectron, listPlugins } from "./tools/electron-tools.js";
import { readElectronLogs, listLogSessions, getSessionSummary } from "./tools/log-tools.js";
import { getErrorHints } from "./tools/debug-tools.js";
import {
  checkElectronConnection,
  sendCommandToElectron,
  takeCdpScreenshot,
  getElectronWindowInfo,
  clickElementBySelector,
  clickElementByText,
  fillInputField,
  getPageDomStructure,
  inspectElement,
  queryElements,
  sendKeyPress,
  scrollPage,
} from "./tools/cdp-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const LOG_DIR = join(PROJECT_ROOT, "logs");

const server = new Server(
  {
    name: "hayalet-ev-mcp",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOL_DEFINITIONS = [
  // === Mevcut Tool'lar ===
  {
    name: "list_providers",
    description: "Hayalet-ev'deki mevcut AI provider'ları listele",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_provider",
    description: "Hayalet-ev'e yeni AI provider ekle",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Provider adı (örn: perplexity, ollama)" },
        url: { type: "string", description: "Provider URL'i" },
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
        timeout: { type: "number", description: "Test süresi (saniye), varsayılan 5", default: 5 },
      },
    },
  },
  {
    name: "list_plugins",
    description: "Hayalet-ev plugin'lerini listele",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "read_electron_logs",
    description: "Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["console", "error", "all", "structured"], description: "Log tipi", default: "all" },
        tail: { type: "number", description: "Son N satırı göster (varsayılan: 50)", default: 50 },
        source: { type: "string", description: "Kaynak filtresi: MAIN, RENDERER, WEBVIEW-AI1, WEBVIEW-AI2, WEBVIEW-* (glob destekli)" },
        level: { type: "string", enum: ["LOG", "WARN", "ERROR", "DEBUG", "INFO"], description: "Log seviyesi filtresi" },
        contains: { type: "string", description: "İçerik arama (case-insensitive)" },
        correlationId: { type: "string", description: "İşlem takibi için correlation ID" },
        sessionId: { type: "string", description: "Belirli bir session'ın loglarını oku (varsayılan: en son session)" },
      },
    },
  },
  {
    name: "list_log_sessions",
    description: "Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Gösterilecek maksimum session sayısı (varsayılan: 10)", default: 10 },
      },
    },
  },
  {
    name: "get_error_hints",
    description: "Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.",
    inputSchema: {
      type: "object",
      properties: {
        errorMessage: { type: "string", description: "Analiz edilecek hata mesajı" },
        provider: { type: "string", description: "İlgili provider (chatgpt, gemini, grok) - dosya yolları için kullanılır" },
      },
      required: ["errorMessage"],
    },
  },
  {
    name: "get_session_summary",
    description: "Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID (varsayılan: en son session)" },
      },
    },
  },

  // === CDP (Chrome DevTools Protocol) Tool'ları ===
  {
    name: "check_electron_connection",
    description: "Electron uygulamasına CDP bağlantısını kontrol et. Uygulama çalışıyor mu ve debug portu açık mı?",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "send_command_to_electron",
    description: "Electron uygulamasında JavaScript kodu çalıştır. Herhangi bir JS expression çalıştırabilir.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Çalıştırılacak JavaScript kodu" },
        description: { type: "string", description: "Komutun ne yaptığına dair açıklama (opsiyonel)" },
      },
      required: ["command"],
    },
  },
  {
    name: "take_cdp_screenshot",
    description: "Electron penceresinin ekran görüntüsünü al (CDP üzerinden, tam sayfa).",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "jpeg"], description: "Görüntü formatı", default: "png" },
        quality: { type: "number", description: "JPEG kalitesi (1-100)", default: 80 },
        savePath: { type: "string", description: "Dosya kaydetme yolu (opsiyonel)" },
      },
    },
  },
  {
    name: "get_electron_window_info",
    description: "Electron penceresinin boyut, pozisyon ve URL bilgilerini al.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "click_element_by_selector",
    description: "CSS selector ile bir elemente tıkla.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector (örn: #myButton, .btn-primary, button[type='submit'])" },
      },
      required: ["selector"],
    },
  },
  {
    name: "click_element_by_text",
    description: "Metin içeriğine göre bir elemente tıkla.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Aranacak metin içeriği" },
        tagName: { type: "string", description: "Tag filtresi (button, a, div vb.)", default: "*" },
      },
      required: ["text"],
    },
  },
  {
    name: "fill_input_field",
    description: "Bir input alanına değer yaz.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Input elementinin CSS selector'ı" },
        value: { type: "string", description: "Yazılacak değer" },
        clear: { type: "boolean", description: "Önce mevcut değeri temizle", default: true },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "get_page_dom_structure",
    description: "Sayfanın DOM yapısını al. Debug ve element bulma için kullanışlı.",
    inputSchema: {
      type: "object",
      properties: {
        maxDepth: { type: "number", description: "Maksimum DOM derinliği", default: 3 },
      },
    },
  },
  {
    name: "inspect_element",
    description: "Bir elementin detaylı bilgilerini al (boyut, pozisyon, görünürlük, içerik).",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
      },
      required: ["selector"],
    },
  },
  {
    name: "query_elements",
    description: "Bir selector ile eşleşen tüm elementleri bul ve listele.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
        limit: { type: "number", description: "Maksimum sonuç sayısı", default: 20 },
      },
      required: ["selector"],
    },
  },
  {
    name: "send_key_press",
    description: "Klavye tuşu gönder (Enter, Escape, Tab vb.).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Tuş adı (Enter, Escape, Tab, ArrowDown vb.)" },
        ctrl: { type: "boolean", description: "Ctrl tuşu basılı", default: false },
        alt: { type: "boolean", description: "Alt tuşu basılı", default: false },
        shift: { type: "boolean", description: "Shift tuşu basılı", default: false },
        meta: { type: "boolean", description: "Meta/Cmd tuşu basılı", default: false },
      },
      required: ["key"],
    },
  },
  {
    name: "scroll_page",
    description: "Sayfada belirli bir konuma scroll yap.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Yatay scroll pozisyonu", default: 0 },
        y: { type: "number", description: "Dikey scroll pozisyonu", default: 0 },
        behavior: { type: "string", enum: ["smooth", "instant"], description: "Scroll animasyonu", default: "smooth" },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_providers":
        return await listProviders(PROJECT_ROOT);

      case "add_provider":
        return await addProvider(PROJECT_ROOT, args);

      case "test_electron":
        return await testElectron(PROJECT_ROOT, args);

      case "list_plugins":
        return await listPlugins(PROJECT_ROOT);

      case "read_electron_logs":
        return await readElectronLogs(LOG_DIR, args);

      case "list_log_sessions":
        return await listLogSessions(LOG_DIR, args);

      case "get_error_hints":
        return await getErrorHints(args || {});

      case "get_session_summary":
        return await getSessionSummary(LOG_DIR, args);

      // === CDP Tool'ları ===
      case "check_electron_connection":
        return await checkElectronConnection();

      case "send_command_to_electron":
        return await sendCommandToElectron(args);

      case "take_cdp_screenshot":
        return await takeCdpScreenshot(args);

      case "get_electron_window_info":
        return await getElectronWindowInfo();

      case "click_element_by_selector":
        return await clickElementBySelector(args);

      case "click_element_by_text":
        return await clickElementByText(args);

      case "fill_input_field":
        return await fillInputField(args);

      case "get_page_dom_structure":
        return await getPageDomStructure(args);

      case "inspect_element":
        return await inspectElement(args);

      case "query_elements":
        return await queryElements(args);

      case "send_key_press":
        return await sendKeyPress(args);

      case "scroll_page":
        return await scrollPage(args);

      default:
        throw new Error(`Bilinmeyen tool: ${name}`);
    }
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hayalet-ev MCP Server v1.3.0 başlatıldı (CDP desteği ile)");
}

main().catch((err) => {
  const error = err as Error;
  console.error("Server hatası:", error);
  process.exit(1);
});
