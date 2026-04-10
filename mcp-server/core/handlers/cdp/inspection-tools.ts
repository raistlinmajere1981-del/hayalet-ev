import {
  getCdpTargetInfo,
  inspectElement,
  queryElements,
} from "../../../tools/cdp-tools.js";
import { createMcpTranslatorSync } from "../../../utils/i18n/index.js";
import type { ToolEntry } from "../../registry.js";

const cdpToolDefinitionTranslator = createMcpTranslatorSync();

function cdpToolT(key: string): string {
  return cdpToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.cdp.${key}`);
}

export function createCdpInspectionTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_get_cdp_target_info",
        description: cdpToolT("getCdpTargetInfo.description"),
        inputSchema: {
          type: "object",
          properties: {
            targetId: { type: "string", description: cdpToolT("getCdpTargetInfo.targetId") },
          },
          required: ["targetId"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-inspection",
          priority: "medium",
          complexity: "simple",
          useCases: [
            cdpToolT("getCdpTargetInfo.useCases.targetInspection"),
            cdpToolT("getCdpTargetInfo.useCases.domainReference"),
            cdpToolT("getCdpTargetInfo.useCases.targetVerification"),
          ],
          relatedTools: ["hev_list_cdp_targets", "hev_send_cdp_command"],
          agentGuidance: cdpToolT("getCdpTargetInfo.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "target", "inspection", "reference"],
        },
      },
      handler: async (args) => await getCdpTargetInfo(args ?? {}),
    },
    {
      definition: {
        name: "hev_inspect_element",
        description: cdpToolT("inspectElement.description"),
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: cdpToolT("inspectElement.selector") },
          },
          required: ["selector"],
        },
        metadata: {
          category: "electron",
          subcategory: "cdp-inspection",
          priority: "high",
          complexity: "simple",
          useCases: [
            cdpToolT("inspectElement.useCases.elementDebugging"),
            cdpToolT("inspectElement.useCases.layoutInspection"),
            cdpToolT("inspectElement.useCases.visibilityCheck"),
          ],
          relatedTools: ["hev_query_elements", "hev_send_command_to_electron"],
          agentGuidance: cdpToolT("inspectElement.agentGuidance"),
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
        description: cdpToolT("queryElements.description"),
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: cdpToolT("queryElements.selector") },
            limit: {
              type: "number",
              description: cdpToolT("queryElements.limit"),
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
          useCases: [
            cdpToolT("queryElements.useCases.multipleElementsSearch"),
            cdpToolT("queryElements.useCases.elementCounting"),
            cdpToolT("queryElements.useCases.selectorValidation"),
          ],
          relatedTools: ["hev_inspect_element", "hev_send_command_to_electron"],
          agentGuidance: cdpToolT("queryElements.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["cdp", "query", "elements", "search"],
        },
      },
      handler: async (args) => await queryElements(args ?? {}),
    },
  ];
}
