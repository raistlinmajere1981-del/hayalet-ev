/**
 * Chrome DevTools Protocol (CDP) Handlers
 * Electron window control, DOM manipulation, screenshots
 *
 * Co-located: definition + handler in ToolEntry format
 */

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
  toggleMcpPanelServers,
} from "../../tools/cdp-tools.js";
import type { ToolEntry } from "../registry.js";

export function createCdpTools(): ToolEntry[] {
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
    {
      definition: {
        name: "hev_click_element_by_selector",
        description: "CSS selector ile bir elemente tıkla.",
        inputSchema: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector (örn: #myButton, .btn-primary, button[type='submit'])",
            },
          },
          required: ["selector"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-interaction",
          priority: "high",
          complexity: "simple",
          useCases: ["UI automation", "Button clicks", "Element interaction"],
          relatedTools: ["hev_click_element_by_text", "hev_inspect_element", "hev_query_elements"],
          agentGuidance:
            "CSS selector ile element tıkla. Önce hev_inspect_element ile elementin var olduğunu doğrula.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "click", "interaction", "automation"],
        },
      },
      handler: async (args) => await clickElementBySelector(args ?? {}),
    },
    {
      definition: {
        name: "hev_click_element_by_text",
        description: "Metin içeriğine göre bir elemente tıkla.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Aranacak metin içeriği" },
            tagName: {
              type: "string",
              description: "Tag filtresi (button, a, div vb.)",
              default: "*",
            },
          },
          required: ["text"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-interaction",
          priority: "high",
          complexity: "simple",
          useCases: ["Text-based interaction", "Button clicks by label", "Link clicks"],
          relatedTools: ["hev_click_element_by_selector", "hev_query_elements"],
          agentGuidance: "Metin ile element bul ve tıkla. Selector bilmiyorsan bu tool kullanışlı.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "click", "text", "automation"],
        },
      },
      handler: async (args) => await clickElementByText(args ?? {}),
    },
    {
      definition: {
        name: "hev_fill_input_field",
        description: "Bir input alanına değer yaz.",
        inputSchema: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "Input elementinin CSS selector'ı",
            },
            value: { type: "string", description: "Yazılacak değer" },
            clear: {
              type: "boolean",
              description: "Önce mevcut değeri temizle",
              default: true,
            },
          },
          required: ["selector", "value"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-interaction",
          priority: "high",
          complexity: "simple",
          useCases: ["Form filling", "Input automation", "Text entry"],
          relatedTools: ["hev_send_key_press", "hev_click_element_by_selector"],
          agentGuidance: "Input field'a değer yaz. clear=true ile önce mevcut içeriği temizler.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "input", "form", "automation"],
        },
      },
      handler: async (args) => await fillInputField(args ?? {}),
    },
    {
      definition: {
        name: "hev_get_page_dom_structure",
        description: "Sayfanın DOM yapısını al. Debug ve element bulma için kullanışlı.",
        inputSchema: {
          type: "object",
          properties: {
            maxDepth: {
              type: "number",
              description: "Maksimum DOM derinliği",
              default: 3,
            },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-inspection",
          priority: "high",
          complexity: "medium",
          useCases: ["DOM exploration", "Element discovery", "Structure debugging"],
          relatedTools: ["hev_inspect_element", "hev_query_elements"],
          agentGuidance:
            "Sayfanın DOM yapısını görüntüle. Element selector'ı bulmak için kullan. maxDepth ile derinliği kontrol et.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "dom", "inspection", "debugging"],
        },
      },
      handler: async (args) => await getPageDomStructure(args ?? {}),
    },
    {
      definition: {
        name: "hev_inspect_element",
        description: "Bir elementin detaylı bilgilerini al (boyut, pozisyon, görünürlük, içerik).",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector" },
          },
          required: ["selector"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-inspection",
          priority: "high",
          complexity: "simple",
          useCases: ["Element debugging", "Layout inspection", "Visibility check"],
          relatedTools: [
            "hev_query_elements",
            "hev_get_page_dom_structure",
            "hev_click_element_by_selector",
          ],
          agentGuidance:
            "Element'in detaylı bilgilerini al. Tıklamadan önce görünür mü kontrol et.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "inspect", "element", "debugging"],
        },
      },
      handler: async (args) => await inspectElement(args ?? {}),
    },
    {
      definition: {
        name: "hev_query_elements",
        description: "Bir selector ile eşleşen tüm elementleri bul ve listele.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector" },
            limit: {
              type: "number",
              description: "Maksimum sonuç sayısı",
              default: 20,
            },
          },
          required: ["selector"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-inspection",
          priority: "medium",
          complexity: "simple",
          useCases: ["Multiple elements search", "Element counting", "Selector validation"],
          relatedTools: ["hev_inspect_element", "hev_get_page_dom_structure"],
          agentGuidance:
            "Selector ile eşleşen tüm elementleri bul. Birden fazla element varsa hangi indexte olduğunu öğren.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "query", "elements", "search"],
        },
      },
      handler: async (args) => await queryElements(args ?? {}),
    },
    {
      definition: {
        name: "hev_send_key_press",
        description: "Klavye tuşu gönder (Enter, Escape, Tab vb.).",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Tuş adı (Enter, Escape, Tab, ArrowDown vb.)",
            },
            ctrl: { type: "boolean", description: "Ctrl tuşu basılı", default: false },
            alt: { type: "boolean", description: "Alt tuşu basılı", default: false },
            shift: { type: "boolean", description: "Shift tuşu basılı", default: false },
            meta: { type: "boolean", description: "Meta/Cmd tuşu basılı", default: false },
          },
          required: ["key"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-interaction",
          priority: "medium",
          complexity: "simple",
          useCases: ["Keyboard automation", "Form submission", "Navigation keys"],
          relatedTools: ["hev_fill_input_field", "hev_click_element_by_selector"],
          agentGuidance:
            "Klavye tuşu gönder. Enter ile form submit, Tab ile navigation, Escape ile cancel işlemleri.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "keyboard", "key", "automation"],
        },
      },
      handler: async (args) => await sendKeyPress(args ?? {}),
    },
    {
      definition: {
        name: "hev_scroll_page",
        description: "Sayfada belirli bir konuma scroll yap.",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number", description: "Yatay scroll pozisyonu", default: 0 },
            y: { type: "number", description: "Dikey scroll pozisyonu", default: 0 },
            behavior: {
              type: "string",
              enum: ["smooth", "instant"],
              description: "Scroll animasyonu",
              default: "smooth",
            },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-navigation",
          priority: "low",
          complexity: "simple",
          useCases: ["Page scrolling", "Element visibility", "Long page navigation"],
          relatedTools: ["hev_take_cdp_screenshot", "hev_inspect_element"],
          agentGuidance:
            "Sayfayı scroll et. Element görünür hale getirmek veya tam sayfa screenshot almak için kullan.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "scroll", "navigation", "page"],
        },
      },
      handler: async (args) => await scrollPage(args ?? {}),
    },
    {
      definition: {
        name: "hev_toggle_mcp_panel_servers",
        description:
          "AI0 webview içindeki OpenCode MCP panelinde belirtilen sunucuları OFF→ON cycle ile toggle eder.",
        inputSchema: {
          type: "object",
          properties: {
            provider: {
              type: "string",
              enum: ["auto", "opencode"],
              default: "auto",
              description: "Panel tipi (auto ile otomatik algılanır)",
            },
            servers: {
              type: "array",
              items: { type: "string" },
              description:
                "Toggle edilecek MCP sunucu isimleri (örn: context7, websearch, hayalet-ev)",
            },
            settleMs: {
              type: "number",
              description: "Her toggle sonrası bekleme süresi (ms)",
              default: 4000,
            },
            cycles: {
              type: "number",
              description: "OFF→ON cycle sayısı (1-5)",
              default: 1,
            },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-workflow",
          priority: "high",
          complexity: "medium",
          useCases: [
            "OpenCode MCP panel toggle automation",
            "Post-restart MCP switch verification",
          ],
          relatedTools: [
            "hev_send_command_to_electron",
            "hev_check_electron_connection",
            "hev_get_electron_window_info",
          ],
          agentGuidance:
            "Asistan (AI0) bağlıyken MCP panelini açar, switch'leri OFF→ON yapar ve final state döndürür.",
          requiresConfirmation: false,
          riskLevel: "medium",
          tags: ["cdp", "mcp", "opencode", "automation"],
        },
      },
      handler: async (args) => await toggleMcpPanelServers(args ?? {}),
    },
  ];
}
