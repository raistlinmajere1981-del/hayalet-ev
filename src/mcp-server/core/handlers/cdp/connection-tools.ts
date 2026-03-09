import {
  checkElectronConnection,
  sendCommandToElectron,
  takeCdpScreenshot,
  getElectronWindowInfo,
} from "../../../tools/cdp-tools.js";
import { createMcpTranslatorSync } from "../../../utils/i18n/index.js";
import type { ToolEntry } from "../../registry.js";

const cdpToolDefinitionTranslator = createMcpTranslatorSync();

function cdpToolT(key: string): string {
  return cdpToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.cdp.${key}`);
}

export function createCdpConnectionTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_check_electron_connection",
        description: cdpToolT("checkElectronConnection.description"),
        inputSchema: { type: "object", properties: {} },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "high",
          complexity: "simple",
          useCases: [
            cdpToolT("checkElectronConnection.useCases.connectivityCheck"),
            cdpToolT("checkElectronConnection.useCases.appHealth"),
            cdpToolT("checkElectronConnection.useCases.debugStart"),
          ],
          relatedTools: ["hev_test_electron", "hev_send_command_to_electron"],
          agentGuidance: cdpToolT("checkElectronConnection.agentGuidance"),
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
        description: cdpToolT("sendCommandToElectron.description"),
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: cdpToolT("sendCommandToElectron.command") },
            description: {
              type: "string",
              description: cdpToolT("sendCommandToElectron.commandDescription"),
            },
          },
          required: ["command"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "high",
          complexity: "medium",
          useCases: [
            cdpToolT("sendCommandToElectron.useCases.domManipulation"),
            cdpToolT("sendCommandToElectron.useCases.stateInspection"),
            cdpToolT("sendCommandToElectron.useCases.customJsExecution"),
          ],
          relatedTools: ["hev_inspect_element", "hev_get_page_dom_structure"],
          agentGuidance: cdpToolT("sendCommandToElectron.agentGuidance"),
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
        description: cdpToolT("takeScreenshot.description"),
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["png", "jpeg"],
              description: cdpToolT("takeScreenshot.format"),
              default: "png",
            },
            quality: {
              type: "number",
              description: cdpToolT("takeScreenshot.quality"),
              default: 80,
            },
            savePath: {
              type: "string",
              description: cdpToolT("takeScreenshot.savePath"),
            },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "medium",
          complexity: "simple",
          useCases: [
            cdpToolT("takeScreenshot.useCases.visualDebugging"),
            cdpToolT("takeScreenshot.useCases.uiVerification"),
            cdpToolT("takeScreenshot.useCases.documentation"),
          ],
          relatedTools: ["hev_get_electron_window_info", "hev_inspect_element"],
          agentGuidance: cdpToolT("takeScreenshot.agentGuidance"),
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
        description: cdpToolT("getWindowInfo.description"),
        inputSchema: { type: "object", properties: {} },
        metadata: {
          category: "electron",
          subcategory: "cdp",
          priority: "medium",
          complexity: "simple",
          useCases: [
            cdpToolT("getWindowInfo.useCases.windowStateInspection"),
            cdpToolT("getWindowInfo.useCases.layoutDebugging"),
            cdpToolT("getWindowInfo.useCases.urlVerification"),
          ],
          relatedTools: ["hev_take_cdp_screenshot", "hev_check_electron_connection"],
          agentGuidance: cdpToolT("getWindowInfo.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "window", "info", "layout"],
        },
      },
      handler: async () => await getElectronWindowInfo(),
    },
  ];
}
