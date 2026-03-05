/**
 * Web Scraper Utility
 * HTML'den temiz metin çıkarma ve içerik işleme
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { WEB_TIMEOUTS } from "@timeouts";

// Kaldırılacak elementler (noise)
const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "video",
  "audio",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  ".ad",
  ".ads",
  ".advertisement",
  ".social",
  ".share",
  ".comment",
  ".comments",
  ".sidebar",
  ".menu",
  ".navigation",
  ".cookie",
  ".popup",
  ".modal",
  "[role='navigation']",
  "[role='banner']",
  "[role='complementary']",
  "[aria-hidden='true']",
];

// İçerik için öncelikli elementler
const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  ".content",
  ".post",
  ".article",
  ".entry",
  "#content",
  "#main",
  ".markdown-body", // GitHub
  ".post-content",
  ".article-content",
  ".entry-content",
];

export interface ScrapedContent {
  title: string;
  description: string;
  content: string;
  markdown: string;
  url: string;
  wordCount: number;
  language?: string;
}

export interface FetchOptions {
  timeout?: number;
  maxLength?: number;
  includeLinks?: boolean;
  userAgent?: string;
}

const DEFAULT_OPTIONS: FetchOptions = {
  timeout: WEB_TIMEOUTS.PAGE_FETCH,
  maxLength: 50000, // ~50KB metin
  includeLinks: true,
  userAgent: "Mozilla/5.0 (compatible; Hayalet-ev/1.0; +https://github.com/)",
};

/**
 * URL'den sayfa içeriğini çek ve temizle
 */
export async function fetchAndParse(
  url: string,
  options: FetchOptions = {}
): Promise<ScrapedContent> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // URL doğrulama
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Sadece HTTP/HTTPS URL'leri desteklenir");
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, opts.timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": opts.userAgent ?? "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`Desteklenmeyen içerik tipi: ${contentType}`);
    }

    const html = await response.text();
    return parseHTML(html, url, opts);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * HTML'i parse et ve temiz içerik çıkar
 */
export function parseHTML(html: string, url: string, options: FetchOptions = {}): ScrapedContent {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const $ = cheerio.load(html);
  // $ used in commented code
  void $; // Prevent unused warning

  // Noise elementleri kaldır
  REMOVE_SELECTORS.forEach((selector) => {
    $(selector).remove();
  });

  // Metadata çıkar
  const title =
    ($("title").text().trim().length > 0 ? $("title").text().trim() : null) ??
    $('meta[property="og:title"]').attr("content") ??
    ($("h1").first().text().trim().length > 0 ? $("h1").first().text().trim() : null) ??
    "Başlık bulunamadı";

  const description =
    $('meta[name="description"]').attr("content") ??
    $('meta[property="og:description"]').attr("content") ??
    "";

  const language =
    $("html").attr("lang") ?? $('meta[http-equiv="content-language"]').attr("content");

  // Ana içeriği bul
  let contentElement = null;
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first();
    if (el.length > 0 && el.text().trim().length > 100) {
      contentElement = el;
      break;
    }
  }

  // Fallback: body kullan
  contentElement ??= $("body");

  // İçeriği temizle ve çıkar
  const content = extractText(contentElement, $, opts.includeLinks ?? false);
  const markdown = extractMarkdown(contentElement, $, opts.includeLinks ?? false);

  // Uzunluk limiti uygula
  const truncatedContent = content.slice(0, opts.maxLength ?? 50000);
  const truncatedMarkdown = markdown.slice(0, opts.maxLength ?? 50000);

  const result: {
    title: string;
    description: string;
    content: string;
    markdown: string;
    url: string;
    wordCount: number;
    language?: string;
  } = {
    title: title.slice(0, 500),
    description: description.slice(0, 1000),
    content: truncatedContent,
    markdown: truncatedMarkdown,
    url,
    wordCount: truncatedContent.split(/\s+/).filter(Boolean).length,
  };
  if (language !== undefined) {
    result.language = language;
  }
  return result;
}

/**
 * Element'ten temiz metin çıkar
 */
function extractText(
  element: cheerio.Cheerio<AnyNode>,
  $: cheerio.CheerioAPI,
  _includeLinks: boolean
): string {
  const lines: string[] = [];

  // Her bloğu işle
  element.find("p, h1, h2, h3, h4, h5, h6, li, td, th, pre, blockquote, div").each((_, el) => {
    const $el = $(el);
    const tagName = el.type === "tag" ? el.tagName.toLowerCase() : "";

    // Nested elementleri atla
    if ($el.find("p, div").length > 0 && !["pre", "blockquote"].includes(tagName)) {
      return;
    }

    let text = $el.text().trim();

    // Boş veya çok kısa içeriği atla
    if (text.length < 3) return;

    // Heading'ler için format
    if (tagName.startsWith("h")) {
      text = `\n## ${text}\n`;
    }

    // Liste elemanları
    if (tagName === "li") {
      text = `• ${text}`;
    }

    // Code blokları
    if (tagName === "pre") {
      text = `\n\`\`\`\n${text}\n\`\`\`\n`;
    }

    // Alıntılar
    if (tagName === "blockquote") {
      text = `> ${text}`;
    }

    lines.push(text);
  });

  // Tekrarlanan boş satırları temizle
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Element'ten Markdown çıkar
 */
function extractMarkdown(
  element: cheerio.Cheerio<AnyNode>,
  $: cheerio.CheerioAPI,
  includeLinks: boolean
): string {
  const lines: string[] = [];

  element
    .find("p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, a, code, strong, em")
    .each((_, el) => {
      const $el = $(el);
      const tagName = el.type === "tag" ? el.tagName.toLowerCase() : "";

      // İç içe elementleri atla (sadece üst seviye işle)
      if ($el.parents("p, li, h1, h2, h3, h4, h5, h6").length > 0) {
        return;
      }

      let text = "";

      switch (tagName) {
        case "h1":
          text = `# ${$el.text().trim()}\n`;
          break;
        case "h2":
          text = `## ${$el.text().trim()}\n`;
          break;
        case "h3":
          text = `### ${$el.text().trim()}\n`;
          break;
        case "h4":
          text = `#### ${$el.text().trim()}\n`;
          break;
        case "h5":
        case "h6":
          text = `##### ${$el.text().trim()}\n`;
          break;
        case "p":
          text = `${processInlineElements($el, $, includeLinks)}\n`;
          break;
        case "li":
          text = `- ${processInlineElements($el, $, includeLinks)}`;
          break;
        case "pre": {
          const code = $el.find("code").text().length > 0 ? $el.find("code").text() : $el.text();
          const lang =
            $el
              .find("code")
              .attr("class")
              ?.match(/language-(\w+)/)?.[1] ?? "";
          text = `\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n`;
          break;
        }
        case "blockquote":
          text = `> ${$el.text().trim()}\n`;
          break;
        default:
          break;
      }

      if (text.trim() !== "") {
        lines.push(text);
      }
    });

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Inline elementleri işle (bold, italic, link, code)
 */
function processInlineElements(
  $el: cheerio.Cheerio<AnyNode>,
  _$: cheerio.CheerioAPI,
  includeLinks: boolean
): string {
  let html = $el.html() ?? "";

  // Strong/Bold
  html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Em/Italic
  html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Inline code
  html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Links
  if (includeLinks) {
    html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  } else {
    html = html.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");
  }

  // Kalan HTML tag'lerini kaldır
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * Metni belirli uzunlukta özetle (basit truncate)
 */
export function truncateText(text: string, maxLength: number, suffix = "..."): string {
  if (text.length <= maxLength) return text;

  // Kelime sınırında kes
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + suffix;
  }

  return truncated + suffix;
}

/**
 * URL'in erişilebilir olup olmadığını kontrol et
 */
export async function checkUrlAccessible(
  url: string,
  timeout = WEB_TIMEOUTS.URL_CHECK
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
