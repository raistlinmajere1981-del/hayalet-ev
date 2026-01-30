/**
 * Web Tools - MCP Web Search & Fetch
 * 
 * SearXNG meta-search engine entegrasyonu ile web araması,
 * sayfa içeriği çekme ve özetleme araçları.
 */

import { fetchAndParse, truncateText } from "../utils/web-scraper.js";
import { logToolError } from "../utils/mcp-logger.js";
import { WEB_TIMEOUTS } from "../utils/timeouts.js";
import type { ToolResult } from "../types/index.js";

// SearXNG yapılandırması (host network mode için 8080 portu)
const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8080";

// ============================================
// Types
// ============================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  category?: string;
  publishedDate?: string;
  score?: number; // Kalite skoru
}

// ============================================
// Spam/Düşük Kalite Domain Blacklist
// ============================================

const SPAM_DOMAINS = new Set([
  "pinterest.com",
  "pinterest.co",
  "quora.com", // Genelde düşük kalite
  "w3schools.com", // MDN tercih edilmeli
  "geeksforgeeks.org", // Genelde kötü örnekler
  "tutorialspoint.com",
  "javatpoint.com",
]);

const HIGH_QUALITY_DOMAINS = new Set([
  "github.com",
  "stackoverflow.com",
  "developer.mozilla.org",
  "docs.microsoft.com",
  "docs.python.org",
  "nodejs.org",
  "typescriptlang.org",
  "reactjs.org",
  "vuejs.org",
  "wikipedia.org",
  "arxiv.org",
  "medium.com",
  "dev.to",
]);

// ============================================
// Helper: Duplicate ve Kalite Filtreleme
// ============================================

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // www. prefix'ini kaldır, trailing slash kaldır
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function calculateScore(result: { url: string; engine: string; snippet?: string }): number {
  let score = 1.0;
  const domain = getDomain(result.url);
  
  // Yüksek kaliteli domain bonus
  if (HIGH_QUALITY_DOMAINS.has(domain)) {
    score += 0.5;
  }
  
  // Spam domain penaltı
  if (SPAM_DOMAINS.has(domain)) {
    score -= 0.8;
  }
  
  // Engine bazlı bonus
  if (["stackoverflow", "github", "wikipedia"].includes(result.engine)) {
    score += 0.3;
  }
  
  // Snippet uzunluğu (daha uzun = daha bilgilendirici)
  if (result.snippet && result.snippet.length > 150) {
    score += 0.2;
  }
  
  return Math.max(0.1, score);
}

function filterAndRankResults(results: SearchResult[]): SearchResult[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  
  return results
    // Spam filtrele
    .filter((r) => {
      const domain = getDomain(r.url);
      return !SPAM_DOMAINS.has(domain);
    })
    // Duplicate URL filtrele
    .filter((r) => {
      const normalized = normalizeUrl(r.url);
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return true;
    })
    // Duplicate başlık filtrele (benzer içerik)
    .filter((r) => {
      const titleKey = r.title.toLowerCase().slice(0, 50);
      if (seenTitles.has(titleKey)) return false;
      seenTitles.add(titleKey);
      return true;
    })
    // Skor hesapla ve sırala
    .map((r) => ({ ...r, score: calculateScore(r) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  engines: string[];
  error?: string;
}

export interface FetchResponse {
  url: string;
  title: string;
  content: string;
  markdown: string;
  wordCount: number;
  error?: string;
}

// ============================================
// Tool 1: Web Search
// ============================================

/**
 * SearXNG ile web araması yap
 */
export async function webSearch(options: {
  query: string;
  categories?: string;
  engines?: string;
  language?: string;
  limit?: number;
  timeRange?: string;
}): Promise<SearchResponse> {
  const {
    query,
    categories = "general",
    engines,
    language = "tr-TR",
    limit = 10,
    timeRange,
  } = options;

  const startTime = Date.now();

  try {
    // SearXNG API URL oluştur
    const params = new URLSearchParams({
      q: query,
      format: "json",
      categories,
      language,
    });

    if (engines) params.append("engines", engines);
    if (timeRange) params.append("time_range", timeRange);

    const url = `${SEARXNG_URL}/search?${params}`;

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEB_TIMEOUTS.SEARCH_API);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SearXNG API hatası: ${response.status}`);
    }

    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        engines?: string[];
        engine?: string;
        category?: string;
        publishedDate?: string;
      }>;
      number_of_results?: number;
      engines?: string[];
    };
    const searchTime = Date.now() - startTime;

    // Sonuçları formatla
    const rawResults: SearchResult[] = (data.results || [])
      .map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
        engine: r.engines?.[0] || r.engine || "unknown",
        category: r.category,
        publishedDate: r.publishedDate,
      }));

    // Filtreleme ve sıralama uygula
    const filteredResults = filterAndRankResults(rawResults).slice(0, limit);

    return {
      query,
      results: filteredResults,
      totalResults: data.number_of_results || rawResults.length,
      searchTime,
      engines: data.engines || [],
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_web_search", err, { query, categories });

    // SearXNG bağlantı hatası için anlamlı mesaj
    if (err.name === "AbortError") {
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        engines: [],
        error: "Arama zaman aşımına uğradı. SearXNG çalışıyor mu?",
      };
    }

    return {
      query,
      results: [],
      totalResults: 0,
      searchTime: Date.now() - startTime,
      engines: [],
      error: err.message,
    };
  }
}

// ============================================
// Tool 2: Web Fetch
// ============================================

/**
 * URL'den sayfa içeriğini çek ve temizle
 */
export async function webFetch(options: {
  url: string;
  maxLength?: number;
  includeLinks?: boolean;
  format?: "text" | "markdown";
}): Promise<FetchResponse> {
  const {
    url,
    maxLength = 30000,
    includeLinks = true,
    format = "markdown",
  } = options;

  try {
    const result = await fetchAndParse(url, {
      maxLength,
      includeLinks,
    });

    return {
      url: result.url,
      title: result.title,
      content: format === "markdown" ? result.markdown : result.content,
      markdown: result.markdown,
      wordCount: result.wordCount,
    };
  } catch (error) {
    const err = error as Error;
    logToolError("hev_web_fetch", err, { url });

    return {
      url,
      title: "",
      content: "",
      markdown: "",
      wordCount: 0,
      error: err.message,
    };
  }
}

// ============================================
// Tool 3: Search & Fetch (Combined)
// ============================================

/**
 * Arama yap ve ilk N sonucun içeriğini çek
 */
export async function webSearchAndFetch(options: {
  query: string;
  fetchCount?: number;
  maxContentLength?: number;
  categories?: string;
}): Promise<{
  query: string;
  results: Array<SearchResult & { content?: string; fetchError?: string }>;
  searchTime: number;
  error?: string;
}> {
  const {
    query,
    fetchCount = 3,
    maxContentLength = 10000,
    categories = "general",
  } = options;

  // Önce arama yap
  const searchResult = await webSearch({ query, categories, limit: fetchCount + 2 });

  if (searchResult.error) {
    return {
      query,
      results: [],
      searchTime: searchResult.searchTime,
      error: searchResult.error,
    };
  }

  // İlk N sonucun içeriğini çek (paralel)
  const fetchPromises = searchResult.results.slice(0, fetchCount).map(async (result) => {
    try {
      const fetched = await webFetch({
        url: result.url,
        maxLength: maxContentLength,
        format: "markdown",
      });

      return {
        ...result,
        content: fetched.error ? undefined : truncateText(fetched.content, maxContentLength),
        fetchError: fetched.error,
      };
    } catch (err) {
      return {
        ...result,
        fetchError: (err as Error).message,
      };
    }
  });

  const resultsWithContent = await Promise.all(fetchPromises);

  return {
    query,
    results: resultsWithContent,
    searchTime: searchResult.searchTime,
  };
}

// ============================================
// MCP Tool Handlers
// ============================================

/**
 * web_search handler
 */
export async function handleWebSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const result = await webSearch({
    query: args.query as string,
    categories: args.categories as string,
    engines: args.engines as string,
    language: args.language as string,
    limit: args.limit as number,
    timeRange: args.time_range as string,
  });

  if (result.error) {
    return {
      content: [{ type: "text", text: `❌ Arama hatası: ${result.error}` }],
      isError: true,
    };
  }

  // Sonuçları formatla
  let output = `## Arama: "${result.query}"\n\n`;
  output += `📊 ${result.totalResults} sonuç bulundu (${result.searchTime}ms)\n\n`;

  if (result.results.length === 0) {
    output += "Sonuç bulunamadı.";
  } else {
    result.results.forEach((r, i) => {
      output += `### ${i + 1}. ${r.title}\n`;
      output += `🔗 ${r.url}\n`;
      output += `📝 ${r.snippet}\n`;
      output += `🔍 ${r.engine}${r.publishedDate ? ` • ${r.publishedDate}` : ""}\n\n`;
    });
  }

  return { content: [{ type: "text", text: output }] };
}

/**
 * web_fetch handler
 */
export async function handleWebFetch(args: Record<string, unknown>): Promise<ToolResult> {
  const result = await webFetch({
    url: args.url as string,
    maxLength: args.max_length as number,
    includeLinks: args.include_links as boolean,
    format: args.format as "text" | "markdown",
  });

  if (result.error) {
    return {
      content: [{ type: "text", text: `❌ Fetch hatası: ${result.error}\nURL: ${result.url}` }],
      isError: true,
    };
  }

  let output = `## ${result.title}\n\n`;
  output += `🔗 ${result.url}\n`;
  output += `📊 ${result.wordCount} kelime\n\n---\n\n`;
  output += result.content;

  return { content: [{ type: "text", text: output }] };
}

/**
 * web_search_and_fetch handler
 */
export async function handleWebSearchAndFetch(args: Record<string, unknown>): Promise<ToolResult> {
  const result = await webSearchAndFetch({
    query: args.query as string,
    fetchCount: args.fetch_count as number,
    maxContentLength: args.max_content_length as number,
    categories: args.categories as string,
  });

  if (result.error) {
    return {
      content: [{ type: "text", text: `❌ Arama hatası: ${result.error}` }],
      isError: true,
    };
  }

  let output = `## Arama ve İçerik: "${result.query}"\n\n`;
  output += `⏱️ ${result.searchTime}ms\n\n`;

  if (result.results.length === 0) {
    output += "Sonuç bulunamadı.";
  } else {
    result.results.forEach((r, i) => {
      output += `---\n\n### ${i + 1}. ${r.title}\n`;
      output += `🔗 ${r.url}\n`;
      output += `🔍 ${r.engine}\n\n`;

      if (r.fetchError) {
        output += `⚠️ İçerik alınamadı: ${r.fetchError}\n\n`;
        output += `📝 Snippet: ${r.snippet}\n\n`;
      } else if (r.content) {
        output += r.content + "\n\n";
      }
    });
  }

  return { content: [{ type: "text", text: output }] };
}

// ============================================
// Tool Definitions
// ============================================

export const webToolDefinitions = [
  {
    name: "hev_web_search",
    description: "SearXNG ile web araması yap. Google, Bing, DuckDuckGo ve diğer arama motorlarından sonuç getirir.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Arama sorgusu",
        },
        categories: {
          type: "string",
          description: "Arama kategorisi: general, images, videos, news, it, science",
          default: "general",
        },
        engines: {
          type: "string",
          description: "Kullanılacak arama motorları (virgülle ayrılmış): google, bing, duckduckgo, wikipedia, github, stackoverflow",
        },
        language: {
          type: "string",
          description: "Arama dili",
          default: "tr-TR",
        },
        limit: {
          type: "number",
          description: "Maksimum sonuç sayısı",
          default: 10,
        },
        time_range: {
          type: "string",
          description: "Zaman aralığı: day, week, month, year",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "hev_web_fetch",
    description: "Bir web sayfasının içeriğini çek ve temiz metin/markdown olarak döndür. Reklam, menü gibi gereksiz içerikler otomatik temizlenir.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "Çekilecek sayfa URL'i",
        },
        max_length: {
          type: "number",
          description: "Maksimum içerik uzunluğu (karakter)",
          default: 30000,
        },
        include_links: {
          type: "boolean",
          description: "Linkleri dahil et",
          default: true,
        },
        format: {
          type: "string",
          description: "Çıktı formatı: text veya markdown",
          default: "markdown",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "hev_web_search_and_fetch",
    description: "Web araması yap ve ilk N sonucun tam içeriğini çek. Detaylı araştırma için ideal.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Arama sorgusu",
        },
        fetch_count: {
          type: "number",
          description: "İçeriği çekilecek sonuç sayısı",
          default: 3,
        },
        max_content_length: {
          type: "number",
          description: "Her sayfa için maksimum içerik uzunluğu",
          default: 10000,
        },
        categories: {
          type: "string",
          description: "Arama kategorisi",
          default: "general",
        },
      },
      required: ["query"],
    },
  },
];

// Auto-generated metadata for listTools()
export const WEB_TOOL_METADATA = {
  category: "Web Search",
  emoji: "🌐",
  tools: webToolDefinitions.map(t => t.name)
};
