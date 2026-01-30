/**
 * Provider Tools for MCP Server
 * 
 * AI provider selector'larını doğrulama ve inspect araçları:
 * - validate_provider_selectors: Provider config'ini canlı test et
 * - inspect_provider_element: Webview'da element inspect et
 * - list_provider_selectors: Provider selector'larını listele
 */

import {
  listProviders,
  parseProviderConfig,
  flattenSelectors,
  groupSelectorsByCategory,
  type ProviderConfig,
  type FlatSelector,
} from "../utils/provider-config.js";
import {
  discoverWebviews,
  findProviderWebview,
  validateProviderSelectors,
  inspectProviderElement as inspectElement,
  type WebviewTarget,
  type ProviderValidationResult,
} from "../utils/selector-validator.js";
import { createProgress } from "../utils/progress.js";
import { logToolError } from "../utils/mcp-logger.js";

// ============================================
// Tool Implementations
// ============================================

/**
 * Mevcut provider'ları ve webview'ları listele
 */
export async function listProviderWebviews(
  projectRoot: string
): Promise<{
  providers: Array<{ id: string; name: string; hasConfig: boolean }>;
  webviews: WebviewTarget[];
  connected: Array<{ provider: string; url: string; title: string }>;
}> {
  const providers = listProviders(projectRoot);
  const configs = providers
    .map(p => parseProviderConfig(projectRoot, p.id))
    .filter((c): c is ProviderConfig => c !== null);
  
  let webviews: WebviewTarget[] = [];
  try {
    webviews = await discoverWebviews(configs);
  } catch {
    // CDP bağlantısı yok
  }
  
  const connected = webviews
    .filter(w => w.provider)
    .map(w => ({ provider: w.provider!, url: w.url, title: w.title }));
  
  return {
    providers: providers.map(p => ({ id: p.id, name: p.name, hasConfig: p.exists })),
    webviews,
    connected,
  };
}

/**
 * Provider selector'larını listele (config'den)
 */
export function listProviderSelectors(
  projectRoot: string,
  provider: string
): {
  provider: string;
  found: boolean;
  config?: {
    baseUrl: string;
    lastVerified?: string;
  };
  selectors: FlatSelector[];
  grouped: Record<string, FlatSelector[]>;
  summary: {
    total: number;
    byCategory: Record<string, number>;
  };
} {
  const config = parseProviderConfig(projectRoot, provider);
  
  if (!config) {
    return {
      provider,
      found: false,
      selectors: [],
      grouped: {},
      summary: { total: 0, byCategory: {} },
    };
  }
  
  const selectors = flattenSelectors(config);
  const grouped = groupSelectorsByCategory(selectors);
  
  const byCategory: Record<string, number> = {};
  for (const [category, sels] of Object.entries(grouped)) {
    byCategory[category] = sels.length;
  }
  
  return {
    provider,
    found: true,
    config: {
      baseUrl: config.baseUrl,
      lastVerified: config.lastVerified,
    },
    selectors,
    grouped,
    summary: {
      total: selectors.length,
      byCategory,
    },
  };
}

/**
 * Provider selector'larını canlı webview'da doğrula
 */
export async function validateSelectors(
  projectRoot: string,
  provider: string,
  categories?: string[]
): Promise<ProviderValidationResult> {
  const progress = createProgress({ operation: `${provider} selector doğrulama` });
  
  try {
    progress.update(0, "Config okunuyor...");
    
    // Config'i parse et
    const config = parseProviderConfig(projectRoot, provider);
    if (!config) {
      progress.fail("Config bulunamadı");
      return {
        provider,
        url: "",
        timestamp: new Date().toISOString(),
        connected: false,
        error: `Provider config bulunamadı: ${provider}`,
        results: [],
        summary: { total: 0, valid: 0, invalid: 0, successRate: "0%" },
      };
    }
    
    progress.update(1, "Webview aranıyor...");
    
    // Tüm provider config'lerini al (webview discovery için)
    const providers = listProviders(projectRoot);
    const allConfigs = providers
      .map(p => parseProviderConfig(projectRoot, p.id))
      .filter((c): c is ProviderConfig => c !== null);
    
    // Webview'ı bul
    const webview = await findProviderWebview(provider, allConfigs);
    if (!webview) {
      progress.fail("Webview bulunamadı");
      return {
        provider,
        url: "",
        timestamp: new Date().toISOString(),
        connected: false,
        error: `${provider} webview'ı bulunamadı. Uygulama açık ve ${provider} sayfası yüklü mü?`,
        results: [],
        summary: { total: 0, valid: 0, invalid: 0, successRate: "0%" },
      };
    }
    
    progress.update(2, "Selector'lar test ediliyor...");
    
    // Selector'ları al ve doğrula
    const selectors = flattenSelectors(config);
    const result = await validateProviderSelectors(webview, selectors, categories);
    
    progress.done(`${result.summary.valid}/${result.summary.total} geçerli`);
    return result;
    
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_validate_provider_selectors", error as Error, { provider, categories });
    return {
      provider,
      url: "",
      timestamp: new Date().toISOString(),
      connected: false,
      error: (error as Error).message,
      results: [],
      summary: { total: 0, valid: 0, invalid: 0, successRate: "0%" },
    };
  }
}

/**
 * Provider webview'ında element inspect et
 */
export async function inspectProviderElementTool(
  projectRoot: string,
  provider: string,
  selector: string,
  options?: {
    includeStyles?: boolean;
    includeParent?: boolean;
    includeChildren?: boolean;
  }
): Promise<{
  provider: string;
  selector: string;
  found: boolean;
  count: number;
  error?: string;
  elements?: Array<Record<string, unknown>>;
}> {
  const progress = createProgress({ operation: `${provider} element inspect`, quiet: true });
  
  try {
    // Config'leri al
    const providers = listProviders(projectRoot);
    const allConfigs = providers
      .map(p => parseProviderConfig(projectRoot, p.id))
      .filter((c): c is ProviderConfig => c !== null);
    
    // Webview'ı bul
    const webview = await findProviderWebview(provider, allConfigs);
    if (!webview) {
      progress.fail("Webview bulunamadı");
      return {
        provider,
        selector,
        found: false,
        count: 0,
        error: `${provider} webview'ı bulunamadı`,
      };
    }
    
    // Element inspect et
    const result = await inspectElement(webview, selector, options);
    
    if (result.result.found) {
      progress.done(`${result.result.count} element bulundu`);
    } else {
      progress.fail("Element bulunamadı");
    }
    
    return {
      provider,
      selector,
      found: result.result.found,
      count: result.result.count,
      error: result.result.error,
      elements: result.result.elements as unknown as Array<Record<string, unknown>>,
    };
    
  } catch (error) {
    progress.fail((error as Error).message);
    logToolError("hev_inspect_provider_element", error as Error, { provider, selector });
    return {
      provider,
      selector,
      found: false,
      count: 0,
      error: (error as Error).message,
    };
  }
}

// ============================================
// Tool Definitions
// ============================================

export const PROVIDER_TOOL_DEFINITIONS = [
  {
    name: "hev_list_provider_webviews",
    description: "Mevcut provider'ları ve bağlı webview'ları listele. CDP bağlantısı gerektirir.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "hev_list_provider_selectors",
    description: "Provider config dosyasındaki selector'ları listele (canlı test olmadan)",
    inputSchema: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          enum: ["chatgpt", "gemini", "grok", "opencode"],
          description: "Provider ID",
        },
      },
      required: ["provider"],
    },
  },
  {
    name: "hev_validate_provider_selectors",
    description: "Provider'ın tüm selector'larını canlı webview'da test et. Electron uygulaması ve ilgili AI sayfası açık olmalı.",
    inputSchema: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          enum: ["chatgpt", "gemini", "grok", "opencode"],
          description: "Provider ID",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Test edilecek kategoriler (boş = hepsi). Örn: ['selectors', 'scrapeSelectors']",
        },
      },
      required: ["provider"],
    },
  },
  {
    name: "hev_inspect_provider_element",
    description: "Provider webview'ında belirli bir selector ile element inspect et",
    inputSchema: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          enum: ["chatgpt", "gemini", "grok", "opencode"],
          description: "Provider ID",
        },
        selector: {
          type: "string",
          description: "CSS selector veya config key (örn: 'selectors.sendButton')",
        },
        include_styles: {
          type: "boolean",
          description: "Computed style'ları dahil et",
          default: false,
        },
        include_parent: {
          type: "boolean",
          description: "Parent element bilgisini dahil et",
          default: false,
        },
        include_children: {
          type: "boolean",
          description: "Child element'leri dahil et",
          default: false,
        },
      },
      required: ["provider", "selector"],
    },
  },
];

// Auto-generated metadata for listTools()
export const PROVIDER_TOOL_METADATA = {
  category: "Provider Tools",
  emoji: "🎯",
  tools: PROVIDER_TOOL_DEFINITIONS.map(t => t.name)
};
