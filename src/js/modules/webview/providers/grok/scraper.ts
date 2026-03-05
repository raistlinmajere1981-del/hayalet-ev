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
  function normalizeText(str: string): string {
    if (str === "") return "";
    return str
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function hashString(str: string): string {
    if (str === "") return "0";
    const normalized = normalizeText(str);
    if (normalized === "") return "0";
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash << 5) + hash + normalized.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }

  const config =
    window.__hayalet_provider_config ??
    ({
      scrapeSelectors: {
        preferred: "[data-message-author-role]",
        fallback: ".message-bubble",
      },
    } as const);
  const preferredSel = config.scrapeSelectors.preferred;
  const fallbackSel = config.scrapeSelectors.fallback;
  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const fallback = Array.from(document.querySelectorAll(fallbackSel));
  const base = preferred.length !== 0 ? preferred : fallback;
  const nodes = base.filter((n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)));
  const mid = window.innerWidth / 2;
  const result: ScrapedMessage[] = [];
  nodes.forEach((node, idx) => {
    const authorRole = node.getAttribute("data-message-author-role");
    const roleNode =
      authorRole !== null && authorRole !== "" ? node : node.closest("[data-message-author-role]");
    const roleAttr = roleNode?.getAttribute("data-message-author-role") ?? "";
    let text = (node as HTMLElement).innerText.trim();
    if (text === "") {
      const imgs = Array.from(node.querySelectorAll("img"));
      const alt = imgs
        .map((img) => img.alt.trim())
        .filter(Boolean)
        .join(" ");
      if (alt !== "") text = alt;
      else if (imgs.length !== 0) text = "[image]";
    }
    if (text === "") return;
    const cls = node.className.toString();
    const hasUserBorder = /border-border/i.test(cls) || /bg-surface/i.test(cls);
    const isFullWidth = /max-w-none/i.test(cls);
    const role = ((): string => {
      if (roleAttr === "user") return "user";
      if (roleAttr === "assistant") return "assistant";
      if (hasUserBorder) return "user";
      if (isFullWidth) return "assistant";

      const rect = node.getBoundingClientRect();
      return rect.left > mid ? "user" : "assistant";
    })();
    const contentHash = hashString(text);
    result.push({ index: idx, role, text, contentHash, domIndex: idx });
  });
  return result;
}
