/**
 * Web Search Tools - Part 2: Content Fetch & Scrape
 *
 * URL'den içerik çekme ve HTML parse etme
 * Mevcut web-scraper.ts utility'sini kullanır
 *
 * @module web/fetch
 */

import { fetchAndParse } from "../../utils/web-scraper.js";
import type { ScrapedContent } from "../../utils/web-scraper.js";
import { logToolError } from "../../utils/mcp-logger.js";
import type { ToolResult } from "@shared/index-mcp.js";

// ============================================
// Types & Interfaces
// ============================================

export interface WebFetchOptions {
  url: string;
  maxLength?: number;
  includeLinks?: boolean;
}

export interface WebFetchResult {
  title: string;
  url: string;
  description: string;
  content: string;
  markdown: string;
  wordCount: number;
  language?: string;
}

// ============================================
// URL Validation
// ============================================

const ALLOWED_PROTOCOLS = ["http:", "https:"];
const BLOCKED_DOMAINS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

/**
 * Validate URL for security
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Desteklenmeyen protokol: ${parsed.protocol}. Sadece HTTP/HTTPS desteklenir.`,
      };
    }

    // Check for blocked domains (basic SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    if (
      BLOCKED_DOMAINS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))
    ) {
      return {
        valid: false,
        error: "Yerel ağ adreslerine erişim engellendi (güvenlik).",
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Geçersiz URL formatı." };
  }
}

// ============================================
// Content Fetch Implementation
// ============================================

/**
 * Fetch and parse content from a URL
 */
export async function webFetchUrl(options: WebFetchOptions): Promise<ToolResult> {
  const { url, maxLength = 10000, includeLinks = true } = options;

  // Validate URL
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      content: [
        {
          type: "text",
          text: `❌ URL doğrulama hatası: ${validation.error ?? "unknown"}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const scraped = await fetchAndParse(url, {
      maxLength,
      includeLinks,
      timeout: 15000, // 15 second timeout
    });

    const result = formatFetchedContent(scraped, maxLength);

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_web_fetch_url", err, { url, maxLength });

    return {
      content: [
        {
          type: "text",
          text: `❌ İçerik çekme hatası: ${err.message}\n\n💡 İpuçları:\n- URL'nin erişilebilir olduğundan emin olun\n- Bazı siteler bot erişimini engeller\n- URL'yi tarayıcıda test edin`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format scraped content for display
 */
function formatFetchedContent(scraped: ScrapedContent, maxLength: number): string {
  const lines: string[] = [`📄 ${scraped.title}`, `🌐 ${scraped.url}`, "", "═".repeat(60), ""];

  if (scraped.description !== "") {
    lines.push(`📝 ${scraped.description}`);
    lines.push("");
  }

  if (scraped.language != null && scraped.language !== "") {
    lines.push(`🌍 Dil: ${scraped.language}`);
    lines.push("");
  }

  lines.push("─".repeat(60));
  lines.push("");

  // Use markdown content if available, otherwise plain content
  const displayContent = scraped.markdown !== "" ? scraped.markdown : scraped.content;

  // Truncate if necessary
  const wasTruncated = displayContent.length >= maxLength;
  const finalContent = wasTruncated
    ? displayContent.slice(0, maxLength).trim() + "\n\n... [içerik kısaltıldı]"
    : displayContent;

  lines.push(finalContent);

  if (wasTruncated) {
    lines.push("");
    lines.push(`💡 ${scraped.wordCount} kelimelik içerikten ilk ${maxLength} karakter gösterildi.`);
  }

  lines.push("");
  lines.push("═".repeat(60));
  lines.push(`📊 Kelime sayısı: ${scraped.wordCount}`);

  return lines.join("\n");
}

// ============================================
// Combined Search + Fetch
// ============================================

/**
 * Search and fetch content from top results
 */
export async function webSearchAndFetch(args: {
  query: string;
  num_results?: number;
  fetch_count?: number;
  max_content_length?: number;
}): Promise<ToolResult> {
  const {
    query,
    num_results: numResults = 5,
    fetch_count: fetchCount = 1,
    max_content_length: maxContentLength = 10000,
  } = args;

  // Import search function dynamically to avoid circular dependency
  const { webSearch } = await import("./search.js");

  // Perform search
  const searchResult = await webSearch({
    query,
    numResults,
  });

  if (searchResult.isError === true) {
    return searchResult;
  }

  // Parse search results to get URLs
  const searchText = searchResult.content[0]?.text ?? "";
  const urls = extractUrlsFromSearchResults(searchText).slice(0, fetchCount);

  if (urls.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `${searchText}\n\n⚠️ İçerik çekilecek URL bulunamadı.`,
        },
      ],
    };
  }

  // Fetch content from each URL
  const fetchResults: string[] = [searchText, "", "📥 Çekilen İçerikler:", "═".repeat(60), ""];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (url == null || url === "") continue;

    fetchResults.push(`\n🔍 Sonuç ${i + 1}/${urls.length}`);
    fetchResults.push("─".repeat(60));

    // eslint-disable-next-line no-await-in-loop
    const fetchResult = await webFetchUrl({
      url,
      maxLength: maxContentLength,
      includeLinks: false, // Cleaner output for combined results
    });

    if (fetchResult.isError === true) {
      fetchResults.push(
        `⚠️ İçerik çekilemedi: ${fetchResult.content[0]?.text ?? "Bilinmeyen hata"}`
      );
    } else {
      fetchResults.push(fetchResult.content[0]?.text ?? "");
    }

    // Add delay between fetches to be polite
    if (i < urls.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    content: [
      {
        type: "text",
        text: fetchResults.join("\n"),
      },
    ],
  };
}

/**
 * Extract URLs from search result text
 */
function extractUrlsFromSearchResults(text: string): string[] {
  const urls: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // Look for lines starting with "   🌐 " which is our URL format
    const match = line.match(/^\s+🌐\s+(https?:\/\/\S+)$/);
    if (match?.[1] != null && match[1] !== "") {
      urls.push(match[1]);
    }
  }

  return urls;
}

// ============================================
// Tool Definitions
// ============================================

export const WEB_FETCH_URL_TOOL = {
  name: "hev_web_fetch_url",
  description:
    "URL'den web sayfası içeriğini çek ve parse et. HTML'den temiz metin çıkarır, markdown formatına dönüştürür. Mevcut cheerio tabanlı scraper kullanır.",
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "İçeriği çekilecek URL (http:// veya https://)",
      },
      max_length: {
        type: "integer",
        description: "Maksimum içerik uzunluğu (karakter, varsayılan: 10000)",
        default: 10000,
      },
      include_links: {
        type: "boolean",
        description: "Markdown linklerini koru (varsayılan: true)",
        default: true,
      },
    },
    required: ["url"],
  },
  metadata: {
    category: "web",
    subcategory: "fetch",
    priority: "high",
    complexity: "medium",
    useCases: [
      "Web sayfası içeriği analizi",
      "Dokümantasyon çekme",
      "Hata mesajı araştırma",
      "Blog yazısı özetleme",
    ],
    relatedTools: ["hev_web_search", "hev_web_search_and_fetch"],
    agentGuidance:
      "Web sayfasının tam içeriğini çekmek için kullan. Önce hev_web_search ile URL bul, sonra bu tool ile içeriği çek. Çok büyük sayfalar için max_length kullan.",
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["web", "fetch", "scrape", "content", "markdown"],
  },
};

export const WEB_SEARCH_AND_FETCH_TOOL_DEFINITION = {
  name: "hev_web_search_and_fetch",
  description:
    "Web araması yap ve ilk N sonucun içeriğini otomatik çek. Arama + content fetch birleşik işlem.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Arama sorgusu",
      },
      num_results: {
        type: "integer",
        description: "Arama sonuç sayısı (varsayılan: 5)",
        default: 5,
        minimum: 1,
        maximum: 10,
      },
      fetch_count: {
        type: "integer",
        description: "İçeriği çekilecek sonuç sayısı (1-3, varsayılan: 1)",
        default: 1,
        minimum: 1,
        maximum: 3,
      },
      max_content_length: {
        type: "integer",
        description: "Her içerik için maksimum karakter (varsayılan: 10000)",
        default: 10000,
      },
    },
    required: ["query"],
  },
  metadata: {
    category: "web",
    subcategory: "search",
    priority: "high",
    complexity: "complex",
    useCases: ["Derinlemesine araştırma", "Dokümantasyon analizi", "Hata çözümü araştırma"],
    relatedTools: ["hev_web_search", "hev_web_fetch_url"],
    agentGuidance:
      "Arama sonuçlarını otomatik analiz etmek için kullan. İlk birkaç sonucun içeriğini çekerek kapsamlı bilgi alırsın. Rate limit'i dikkate al.",
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["web", "search", "fetch", "combined", "research"],
  },
};
