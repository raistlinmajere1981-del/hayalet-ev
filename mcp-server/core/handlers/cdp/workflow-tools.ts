import { toggleMcpPanelServers } from "../../../tools/cdp-tools.js";
import { createMcpTranslatorSync } from "../../../utils/i18n/index.js";
import type { ToolEntry } from "../../registry.js";

const cdpToolDefinitionTranslator = createMcpTranslatorSync();

function cdpToolT(key: string): string {
  return cdpToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.cdp.${key}`);
}

export function createCdpWorkflowTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_toggle_mcp_panel_servers",
        description: cdpToolT("toggleMcpPanelServers.description"),
        inputSchema: {
          type: "object",
          properties: {
            provider: {
              type: "string",
              enum: ["auto", "opencode"],
              default: "auto",
              description: cdpToolT("toggleMcpPanelServers.provider"),
            },
            servers: {
              type: "array",
              items: { type: "string" },
              description: cdpToolT("toggleMcpPanelServers.servers"),
            },
            settleMs: {
              type: "number",
              description: cdpToolT("toggleMcpPanelServers.settleMs"),
              default: 4000,
            },
            cycles: {
              type: "number",
              description: cdpToolT("toggleMcpPanelServers.cycles"),
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
            cdpToolT("toggleMcpPanelServers.useCases.panelToggleAutomation"),
            cdpToolT("toggleMcpPanelServers.useCases.postRestartVerification"),
          ],
          relatedTools: [
            "hev_send_command_to_electron",
            "hev_check_electron_connection",
            "hev_take_cdp_screenshot",
          ],
          agentGuidance: cdpToolT("toggleMcpPanelServers.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "medium",
          tags: ["cdp", "mcp", "opencode", "automation"],
        },
      },
      handler: async (args) => await toggleMcpPanelServers(args ?? {}),
    },
  ];
}
