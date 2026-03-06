import { toggleMcpPanelServers } from "../../../tools/cdp-tools.js";
import type { ToolEntry } from "../../registry.js";

export function createCdpWorkflowTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_toggle_mcp_panel_servers",
        description:
          "AI0 webview içindeki OpenCode/RovoDev MCP panelinde belirtilen sunucuları OFF→ON cycle ile toggle eder.",
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
