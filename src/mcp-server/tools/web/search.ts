/**
 * Web Search Tools - Part 1: Core Search Operations
 *
 * Provider-backed web search with SearXNG first and DuckDuckGo fallback.
 *
 * @module web/search
 */

import { search, SafeSearchType } from "duck-duck-scrape";
import { logToolError } from "../../utils/mcp-logger.js";
import type { ToolResult } from "@shared/index-mcp.js";

// ============================================
// Types & Interfaces
// ============================================

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  source?: string;
}

type SearchProvider = "searxng" | "duckduckgo";

export interface WebSearchOptions {
  query: string;
  numResults?: number;
  safeSearch?: boolean;
  region?: string;
  timeRange?: "day" | "week" | "month" | "year";
  provider?: SearchProvider;
  searxngBaseUrl?: string;
}

interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearxngResponse {
  results?: SearxngResult[];
}

// ============================================
// Provider Defaults
// ============================================

const DEFAULT_PROVIDER: SearchProvider = "searxng";
const DEFAULT_SEARXNG_BASE_URL = "https://search.wdpserver.com";
const FALLBACK_SEARXNG_BASE_URLS = [
  "https://search.wdpserver.com",
  "https://search.inetol.net",
  "https://searxng.site",
  "https://searx.tiekoetter.com",
];

function resolveProvider(input?: string): SearchProvider {
  const raw = (input ?? process.env["WEB_SEARCH_PROVIDER"] ?? DEFAULT_PROVIDER)
    .toLowerCase()
    .trim();

  if (raw === "ddg" || raw === "duckduckgo") {
    return "duckduckgo";
  }

  return "searxng";
}

function resolveSearxngBaseUrl(input?: string): string {
  const raw = (input ?? process.env["SEARXNG_BASE_URL"] ?? DEFAULT_SEARXNG_BASE_URL).trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function buildSearxngCandidates(input?: string): string[] {
  const primary = resolveSearxngBaseUrl(input);
  const all = [primary, ...FALLBACK_SEARXNG_BASE_URLS];
  return [...new Set(all.map((url) => (url.endsWith("/") ? url.slice(0, -1) : url)))];
}

function mapRegionToSearxngLanguage(region: string): string {
  const lower = region.toLowerCase();

  if (lower.startsWith("tr")) return "tr";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("es")) return "es";

  return "en";
}

// ============================================
// DuckDuckGo Rate Limiting
// ============================================

const RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000,
  retryAfterMs: 2000,
};

const requestLog: number[] = [];
let lastRequestTime = 0;

function checkRateLimit(): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  const windowStart = now - RATE_LIMIT.windowMs;
  while (requestLog.length > 0 && requestLog[0] !== undefined && requestLog[0] < windowStart) {
    requestLog.shift();
  }

  if (requestLog.length >= RATE_LIMIT.maxRequests) {
    const oldestRequest = requestLog[0];
    if (oldestRequest !== undefined) {
      const retryAfter = oldestRequest + RATE_LIMIT.windowMs - now;
      return { allowed: false, retryAfter };
    }
  }

  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT.retryAfterMs) {
    const retryAfter = RATE_LIMIT.retryAfterMs - timeSinceLastRequest;
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

function recordRequest(): void {
  const now = Date.now();
  requestLog.push(now);
  lastRequestTime = now;
}

// ============================================
// Provider Implementations
// ============================================

async function searchWithDuckDuckGo(options: WebSearchOptions): Promise<ToolResult> {
  const { query, numResults = 10, safeSearch = true, region = "tr-tr" } = options;

  const rateLimitCheck = checkRateLimit();
  if (!rateLimitCheck.allowed) {
    const waitSeconds = Math.ceil((rateLimitCheck.retryAfter ?? 0) / 1000);
    return {
      content: [
        {
          type: "text",
          text: `⏳ Rate limit aşıldı. Lütfen ${waitSeconds} saniye sonra tekrar deneyin.`,
        },
      ],
      isError: true,
    };
  }

  recordRequest();

  const searchResult = await search(query, {
    safeSearch: safeSearch ? SafeSearchType.STRICT : SafeSearchType.OFF,
    region,
  });

  const formattedResults: WebSearchResult[] = searchResult.results
    .slice(0, numResults)
    .map((result) => ({
      title: result.title.length > 0 ? result.title : "Başlık yok",
      url: result.url.length > 0 ? result.url : "",
      description: result.description.length > 0 ? result.description : "",
      source: new URL(result.url.length > 0 ? result.url : "http://localhost").hostname,
    }));

  if (formattedResults.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `🔍 "${query}" için sonuç bulunamadı.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: formatSearchResults("duckduckgo", query, formattedResults, numResults),
      },
    ],
  };
}

async function searchWithSearxng(options: WebSearchOptions): Promise<ToolResult> {
  const { query, numResults = 10, safeSearch = true, region = "tr-tr" } = options;
  const language = mapRegionToSearxngLanguage(region);
  const candidates = buildSearxngCandidates(options.searxngBaseUrl);

  let lastError = "SearXNG endpoint hatası";

  for (const baseUrl of candidates) {
    try {
      const url = new URL(`${baseUrl}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("language", language);
      url.searchParams.set("safesearch", safeSearch ? "1" : "0");

      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        lastError = `${baseUrl} -> HTTP ${response.status}`;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const payload = (await response.json()) as SearxngResponse;
      const formattedResults: WebSearchResult[] = (payload.results ?? [])
        .slice(0, numResults)
        .map((result) => ({
          title: (result.title ?? "").length > 0 ? (result.title ?? "") : "Başlık yok",
          url: result.url ?? "",
          description: result.content ?? "",
          source: new URL((result.url ?? "").length > 0 ? (result.url ?? "") : "http://localhost")
            .hostname,
        }));

      if (formattedResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `🔍 "${query}" için sonuç bulunamadı.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: formatSearchResults("searxng", query, formattedResults, numResults),
          },
        ],
      };
    } catch (error) {
      lastError = `${baseUrl} -> ${(error as Error).message}`;
    }
  }

  throw new Error(lastError);
}

// ============================================
// Search Entry Point
// ============================================

export async function webSearch(options: WebSearchOptions): Promise<ToolResult> {
  const provider = resolveProvider(options.provider);

  try {
    if (provider === "duckduckgo") {
      return await searchWithDuckDuckGo(options);
    }

    return await searchWithSearxng(options);
  } catch (error) {
    const err = error as Error;
    logToolError("hev_web_search", err, {
      query: options.query,
      numResults: options.numResults,
      provider,
    });

    if (provider === "searxng") {
      return {
        content: [
          {
            type: "text",
            text: `❌ SearXNG arama hatası: ${err.message}\n\n💡 İpuçları:\n- Farklı bir public SearXNG instance deneyin\n- SEARXNG_BASE_URL env değişkenini ayarlayın\n- Geçici olarak provider: "duckduckgo" ile fallback kullanın`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `❌ Arama hatası: ${err.message}\n\n💡 İpuçları:\n- Farklı bir arama terimi deneyin\n- Rate limit için birkaç saniye bekleyin\n- İnternet bağlantınızı kontrol edin`,
        },
      ],
      isError: true,
    };
  }
}

function formatSearchResults(
  provider: SearchProvider,
  query: string,
  results: WebSearchResult[],
  requestedCount: number
): string {
  const lines: string[] = [
    `🔍 Web Arama Sonuçları: "${query}"`,
    `🧭 Sağlayıcı: ${provider}`,
    `📊 ${results.length} sonuç bulundu${results.length < requestedCount ? " (tümü)" : ""}`,
    "",
    "═".repeat(60),
    "",
  ];

  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   🌐 ${result.url}`);
    lines.push(`   📝 ${truncateText(result.description, 200)}`);
    lines.push("");
  });

  lines.push("═".repeat(60));
  lines.push("");
  lines.push("💡 Sonuçlardan birinin içeriğini çekmek için:");
  lines.push(`   hev_web_fetch_url(url: "${results[0]?.url ?? "URL"}")`);

  return lines.join("\n");
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

// ============================================
// Tool Definitions
// ============================================

export const WEB_SEARCH_TOOL = {
  name: "hev_web_search",
  description:
    "Web araması yap. Varsayılan sağlayıcı SearXNG'dir (Docker zorunlu değil). İstenirse DuckDuckGo fallback kullanılabilir.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Arama sorgusu",
      },
      num_results: {
        type: "integer",
        description: "Maksimum sonuç sayısı (1-20, varsayılan: 10)",
        default: 10,
        minimum: 1,
        maximum: 20,
      },
      safe_search: {
        type: "boolean",
        description: "Güvenli arama modu (varsayılan: true)",
        default: true,
      },
      region: {
        type: "string",
        description: "Bölge kodu (varsayılan: tr-tr)",
        default: "tr-tr",
      },
      provider: {
        type: "string",
        description: "Arama sağlayıcısı: searxng | duckduckgo (varsayılan: searxng)",
      },
      searxng_base_url: {
        type: "string",
        description:
          "SearXNG base URL (örn: https://searx.be). Boşsa SEARXNG_BASE_URL veya varsayılan kullanılır.",
      },
    },
    required: ["query"],
  },
  metadata: {
    category: "web",
    subcategory: "search",
    priority: "high",
    complexity: "medium",
    useCases: [
      "Güncel bilgi arama",
      "API dokümantasyonu bulma",
      "Hata çözümleri araştırma",
      "Paket/library bilgisi",
    ],
    relatedTools: ["hev_web_fetch_url", "hev_web_search_and_fetch"],
    agentGuidance:
      "Docker olmadan SearXNG public instance ile kullanılabilir. Kararlılık için SEARXNG_BASE_URL ile kendi instance adresini ver. Gerekirse provider='duckduckgo' fallback kullan.",
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["web", "search", "searxng", "free", "no-docker"],
  },
};
