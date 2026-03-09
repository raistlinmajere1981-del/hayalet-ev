import {
  clickElementBySelector,
  clickElementByText,
  fillInputField,
  sendKeyPress,
  scrollPage,
} from "../../../tools/cdp-tools.js";
import { createMcpTranslatorSync } from "../../../utils/i18n/index.js";
import type { ToolEntry } from "../../registry.js";

const cdpToolDefinitionTranslator = createMcpTranslatorSync();

function cdpToolT(key: string): string {
  return cdpToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.cdp.${key}`);
}

export function createCdpInteractionTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_click_element_by_selector",
        description: cdpToolT("clickBySelector.description"),
        inputSchema: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: cdpToolT("clickBySelector.selector"),
            },
          },
          required: ["selector"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-interaction",
          priority: "high",
          complexity: "simple",
          useCases: [
            cdpToolT("clickBySelector.useCases.uiAutomation"),
            cdpToolT("clickBySelector.useCases.buttonClicks"),
            cdpToolT("clickBySelector.useCases.elementInteraction"),
          ],
          relatedTools: ["hev_click_element_by_text", "hev_inspect_element", "hev_query_elements"],
          agentGuidance: cdpToolT("clickBySelector.agentGuidance"),
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
        description: cdpToolT("clickByText.description"),
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: cdpToolT("clickByText.text") },
            tagName: {
              type: "string",
              description: cdpToolT("clickByText.tagName"),
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
          useCases: [
            cdpToolT("clickByText.useCases.textBasedInteraction"),
            cdpToolT("clickByText.useCases.buttonClicksByLabel"),
            cdpToolT("clickByText.useCases.linkClicks"),
          ],
          relatedTools: ["hev_click_element_by_selector", "hev_query_elements"],
          agentGuidance: cdpToolT("clickByText.agentGuidance"),
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
        description: cdpToolT("fillInput.description"),
        inputSchema: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: cdpToolT("fillInput.selector"),
            },
            value: { type: "string", description: cdpToolT("fillInput.value") },
            clear: {
              type: "boolean",
              description: cdpToolT("fillInput.clear"),
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
          useCases: [
            cdpToolT("fillInput.useCases.formFilling"),
            cdpToolT("fillInput.useCases.inputAutomation"),
            cdpToolT("fillInput.useCases.textEntry"),
          ],
          relatedTools: ["hev_send_key_press", "hev_click_element_by_selector"],
          agentGuidance: cdpToolT("fillInput.agentGuidance"),
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
        description: cdpToolT("sendKeyPress.description"),
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: cdpToolT("sendKeyPress.key"),
            },
            ctrl: { type: "boolean", description: cdpToolT("sendKeyPress.ctrl"), default: false },
            alt: { type: "boolean", description: cdpToolT("sendKeyPress.alt"), default: false },
            shift: {
              type: "boolean",
              description: cdpToolT("sendKeyPress.shift"),
              default: false,
            },
            meta: { type: "boolean", description: cdpToolT("sendKeyPress.meta"), default: false },
          },
          required: ["key"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-interaction",
          priority: "medium",
          complexity: "simple",
          useCases: [
            cdpToolT("sendKeyPress.useCases.keyboardAutomation"),
            cdpToolT("sendKeyPress.useCases.formSubmission"),
            cdpToolT("sendKeyPress.useCases.navigationKeys"),
          ],
          relatedTools: ["hev_fill_input_field", "hev_click_element_by_selector"],
          agentGuidance: cdpToolT("sendKeyPress.agentGuidance"),
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
        description: cdpToolT("scrollPage.description"),
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number", description: cdpToolT("scrollPage.x"), default: 0 },
            y: { type: "number", description: cdpToolT("scrollPage.y"), default: 0 },
            behavior: {
              type: "string",
              enum: ["smooth", "instant"],
              description: cdpToolT("scrollPage.behavior"),
              default: "smooth",
            },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-navigation",
          priority: "low",
          complexity: "simple",
          useCases: [
            cdpToolT("scrollPage.useCases.pageScrolling"),
            cdpToolT("scrollPage.useCases.elementVisibility"),
            cdpToolT("scrollPage.useCases.longPageNavigation"),
          ],
          relatedTools: ["hev_take_cdp_screenshot", "hev_inspect_element"],
          agentGuidance: cdpToolT("scrollPage.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "scroll", "navigation", "page"],
        },
      },
      handler: async (args) => await scrollPage(args ?? {}),
    },
  ];
}
