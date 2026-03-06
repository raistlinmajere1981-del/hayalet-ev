import {
  checkElectronConnection,
  sendCommandToElectron,
  takeCdpScreenshot,
  getElectronWindowInfo,
} from "../../../tools/cdp-tools.js";
import type { ToolEntry } from "../../registry.js";

export function createCdpConnectionTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_check_electron_connection",
        description:
          "Electron uygulamasına CDP bağlantısını kontrol et. Uygulama çalışıyor mu ve debug portu açık mı?",
        inputSchema: { type: "object", properties: {} },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "high",
          complexity: "simple",
          useCases: ["CDP connectivity check", "Electron app health", "Debugging başlangıcı"],
          relatedTools: ["hev_test_electron", "hev_send_command_to_electron"],
          agentGuidance: "CDP operasyonlarından önce bağlantıyı kontrol et. Debug port açık mı?",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "connectivity", "electron", "health"],
        },
      },
      handler: async () => await checkElectronConnection(),
    },
    {
      definition: {
        name: "hev_send_command_to_electron",
        description:
          "Electron uygulamasında JavaScript kodu çalıştır. Herhangi bir JS expression çalıştırabilir.",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Çalıştırılacak JavaScript kodu" },
            description: {
              type: "string",
              description: "Komutun ne yaptığına dair açıklama (opsiyonel)",
            },
          },
          required: ["command"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "high",
          complexity: "medium",
          useCases: ["DOM manipulation", "State inspection", "Custom JS execution"],
          relatedTools: ["hev_inspect_element", "hev_get_page_dom_structure"],
          agentGuidance:
            "Powerful tool: herhangi bir JS çalıştır. State değişikliği, data inspection için kullan.",
          requiresConfirmation: false,
          riskLevel: "medium",
          tags: ["cdp", "javascript", "execution", "advanced"],
        },
      },
      handler: async (args) => await sendCommandToElectron(args ?? {}),
    },
    {
      definition: {
        name: "hev_take_cdp_screenshot",
        description: "Electron penceresinin ekran görüntüsünü al (CDP üzerinden, tam sayfa).",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["png", "jpeg"],
              description: "Görüntü formatı",
              default: "png",
            },
            quality: { type: "number", description: "JPEG kalitesi (1-100)", default: 80 },
            savePath: { type: "string", description: "Dosya kaydetme yolu (opsiyonel)" },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "medium",
          complexity: "simple",
          useCases: ["Visual debugging", "UI verification", "Documentation"],
          relatedTools: ["hev_get_electron_window_info", "hev_inspect_element"],
          agentGuidance: "UI state'i görsel olarak kaydet. Full page screenshot destekler.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "screenshot", "visual", "debugging"],
        },
      },
      handler: async (args) => await takeCdpScreenshot(args ?? {}),
    },
    {
      definition: {
        name: "hev_get_electron_window_info",
        description: "Electron penceresinin boyut, pozisyon ve URL bilgilerini al.",
        inputSchema: { type: "object", properties: {} },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "medium",
          complexity: "simple",
          useCases: ["Window state inspection", "Layout debugging", "URL verification"],
          relatedTools: ["hev_take_cdp_screenshot", "hev_check_electron_connection"],
          agentGuidance:
            "Pencere durumunu öğren: boyut, pozisyon, URL. Layout sorunları için kullan.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "window", "info", "layout"],
        },
      },
      handler: async () => await getElectronWindowInfo(),
    },
  ];
}
