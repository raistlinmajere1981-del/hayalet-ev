import {
  clickElementBySelector,
  clickElementByText,
  fillInputField,
  sendKeyPress,
  scrollPage,
} from "../../../tools/cdp-tools.js";
import type { ToolEntry } from "../../registry.js";

export function createCdpInteractionTools(): ToolEntry[] {
  return [
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
  ];
}
