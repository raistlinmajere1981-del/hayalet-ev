/**
 * Web Search Tools - Part 2: Content Fetch & Scrape
 *
 * Fetches content from a URL and parses HTML
 * Uses the existing web-scraper.ts utility
 *
 * @module web/fetch
 */

import { fetchAndParse } from "../../utils/web-scraper.js";
import type { ScrapedContent } from "../../utils/web-scraper.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../../utils/i18n/index.js";
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

type WebTranslator = (key: string, params?: Record<string, string | number | boolean>) => string;

type UrlValidationResult =
  | { valid: true }
  | {
      valid: false;
      errorKey: string;
      errorParams?: Record<string, string | number | boolean>;
    };

const webFetchDefinitionTranslator = createMcpTranslatorSync();

function webFetchDefT(
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return webFetchDefinitionTranslator(`mcpServer.webTools.definition.${key}`, params);
}

function webFetchT(t: WebTranslator, key: string, params?: Record<string, string | number | boolean>): string {
  return t(`mcpServer.webTools.fetch.${key}`, params);
}

// ============================================
// URL Validation
// ============================================

const ALLOWED_PROTOCOLS = ["http:", "https:"];
const BLOCKED_DOMAINS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

/**
 * Validate URL for security
 */
function validateUrl(url: string): UrlValidationResult {
  try {
    const parsed = new URL(url);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return {
        valid: false,
        errorKey: "errors.unsupportedProtocol",
        errorParams: { protocol: parsed.protocol },
      };
    }

    // Check for blocked domains (basic SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    if (
      BLOCKED_DOMAINS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))
    ) {
      return {
        valid: false,
        errorKey: "errors.localAddressBlocked",
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, errorKey: "errors.invalidUrl" };
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
  const t = await createMcpTranslator();

  // Validate URL
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      content: [
        {
          type: "text",
          text: webFetchT(t, "errors.validationFailed", {
            message: webFetchT(t, validation.errorKey, validation.errorParams),
          }),
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

    return {
      content: [
        {
          type: "text",
          text: formatFetchedContent(scraped, maxLength, t),
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
          text: webFetchT(t, "errors.fetchFailed", { message: err.message }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format scraped content for display
 */
function formatFetchedContent(scraped: ScrapedContent, maxLength: number, t: WebTranslator): string {
  const lines: string[] = [
    webFetchT(t, "content.title", { title: scraped.title }),
    webFetchT(t, "content.url", { url: scraped.url }),
    "",
    "═".repeat(60),
    "",
  ];

  if (scraped.description !== "") {
    lines.push(webFetchT(t, "content.description", { description: scraped.description }));
    lines.push("");
  }

  if (scraped.language != null && scraped.language !== "") {
    lines.push(webFetchT(t, "content.language", { language: scraped.language }));
    lines.push("");
  }

  lines.push("─".repeat(60));
  lines.push("");

  // Use markdown content if available, otherwise plain content
  const displayContent = scraped.markdown !== "" ? scraped.markdown : scraped.content;

  // Truncate if necessary
  const wasTruncated = displayContent.length >= maxLength;
  const finalContent = wasTruncated
    ? displayContent.slice(0, maxLength).trim() + "\n\n" + webFetchT(t, "content.truncated")
    : displayContent;

  lines.push(finalContent);

  if (wasTruncated) {
    lines.push("");
    lines.push(
      webFetchT(t, "content.truncatedHint", {
        wordCount: scraped.wordCount,
        maxLength,
      })
    );
  }

  lines.push("");
  lines.push("═".repeat(60));
  lines.push(webFetchT(t, "content.wordCount", { wordCount: scraped.wordCount }));

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
  const t = await createMcpTranslator();
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
          text: `${searchText}\n\n${webFetchT(t, "combined.noUrlFound")}`,
        },
      ],
    };
  }

  // Fetch content from each URL
  const fetchResults: string[] = [
    searchText,
    "",
    webFetchT(t, "combined.title"),
    "═".repeat(60),
    "",
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (url == null || url === "") continue;

    fetchResults.push("");
    fetchResults.push(webFetchT(t, "combined.resultHeader", { index: i + 1, total: urls.length }));
    fetchResults.push("─".repeat(60));

    // eslint-disable-next-line no-await-in-loop
    const fetchResult = await webFetchUrl({
      url,
      maxLength: maxContentLength,
      includeLinks: false, // Cleaner output for combined results
    });

    if (fetchResult.isError === true) {
      fetchResults.push(
        webFetchT(t, "combined.fetchFailed", {
          message: fetchResult.content[0]?.text ?? webFetchT(t, "combined.unknownError"),
        })
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
  description: webFetchDefT("fetchUrl.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: webFetchDefT("fetchUrl.url"),
      },
      max_length: {
        type: "integer",
        description: webFetchDefT("fetchUrl.maxLength"),
        default: 10000,
      },
      include_links: {
        type: "boolean",
        description: webFetchDefT("fetchUrl.includeLinks"),
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
      webFetchDefT("fetchUrl.useCases.pageAnalysis"),
      webFetchDefT("fetchUrl.useCases.documentation"),
      webFetchDefT("fetchUrl.useCases.errorResearch"),
      webFetchDefT("fetchUrl.useCases.blogSummary"),
    ],
    relatedTools: ["hev_web_search", "hev_web_search_and_fetch"],
    agentGuidance: webFetchDefT("fetchUrl.agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "medium",
    tags: ["web", "fetch", "scrape", "content", "markdown"],
  },
};

export const WEB_SEARCH_AND_FETCH_TOOL_DEFINITION = {
  name: "hev_web_search_and_fetch",
  description: webFetchDefT("searchAndFetch.description"),
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: webFetchDefT("searchAndFetch.query"),
      },
      num_results: {
        type: "integer",
        description: webFetchDefT("searchAndFetch.numResults"),
        default: 5,
        minimum: 1,
        maximum: 10,
      },
      fetch_count: {
        type: "integer",
        description: webFetchDefT("searchAndFetch.fetchCount"),
        default: 1,
        minimum: 1,
        maximum: 3,
      },
      max_content_length: {
        type: "integer",
        description: webFetchDefT("searchAndFetch.maxContentLength"),
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
    useCases: [
      webFetchDefT("searchAndFetch.useCases.deepResearch"),
      webFetchDefT("searchAndFetch.useCases.documentationAnalysis"),
      webFetchDefT("searchAndFetch.useCases.errorResolution"),
    ],
    relatedTools: ["hev_web_search", "hev_web_fetch_url"],
    agentGuidance: webFetchDefT("searchAndFetch.agentGuidance"),
    requiresConfirmation: false,
    riskLevel: "low",
    tags: ["web", "search", "fetch", "combined", "research"],
  },
};
