/**
 * Grok mesajlarını scrape et
 * 
 * NOT: normalizeText ve hashString fonksiyonları webview injection sınırlaması
 * nedeniyle inline tanımlanmıştır. Tek kaynak (single source of truth):
 * @see ../shared/scraper-helpers.ts
 * 
 * @returns {Array<{ index: number, role: string, text: string, contentHash: string, domIndex: number }>}
 */
interface ScrapedMessage {
  index: number;
  role: string;
  text: string;
  contentHash: string;
  domIndex: number;
}

export function scrapeMessages(): ScrapedMessage[] {
  // Text normalization - hash tutarlılığı için
  function normalizeText(str: string): string {
    if (!str) return "";
    return str
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Hash fonksiyonu (djb2 algoritması) - fonksiyon içinde tanımlı olmalı
  function hashString(str: string): string {
    if (!str) return "0";
    const normalized = normalizeText(str);
    if (!normalized) return "0";
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }

  const preferredSel =
    (window.__hayalet_provider_config?.scrapeSelectors?.preferred) ||
    "[data-message-author-role]";
  const fallbackSel =
    (window.__hayalet_provider_config?.scrapeSelectors?.fallback) ||
    ".message-bubble";
  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const fallback = Array.from(document.querySelectorAll(fallbackSel));
  const base = preferred.length ? preferred : fallback;
  const nodes = base.filter(
    (n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)),
  );
  const mid = window.innerWidth / 2;
  const result: ScrapedMessage[] = [];
  nodes.forEach((node, idx) => {
    const roleNode = node.getAttribute("data-message-author-role")
      ? node
      : node.closest("[data-message-author-role]");
    const roleAttr = roleNode?.getAttribute("data-message-author-role") || "";
    let text = ((node as HTMLElement).innerText || "").trim();
    if (!text) {
      const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
      const alt = imgs
        .map((img) => (img.alt || "").trim())
        .filter(Boolean)
        .join(" ");
      if (alt) text = alt;
      else if (imgs.length) text = "[image]";
    }
    if (!text) return;
    const cls = (node.className || "").toString();
    const hasUserBorder = /border-border/i.test(cls) || /bg-surface/i.test(cls);
    const isFullWidth = /max-w-none/i.test(cls);
    let role = "assistant";
    if (roleAttr === "user") role = "user";
    else if (roleAttr === "assistant") role = "assistant";
    else if (hasUserBorder) role = "user";
    else if (isFullWidth) role = "assistant";
    else {
      const rect = node.getBoundingClientRect();
      role = rect.left > mid ? "user" : "assistant";
    }
    // Hash ekle (incremental sync için)
    const contentHash = hashString(text);
    result.push({ index: idx, role, text, contentHash, domIndex: idx });
  });
  return result;
}
