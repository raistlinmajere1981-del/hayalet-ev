import { getPageDomStructure, inspectElement, queryElements } from "../../../tools/cdp-tools.js";
import type { ToolEntry } from "../../registry.js";

export function createCdpInspectionTools(): ToolEntry[] {
  return [
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
  ];
}
