/**
 * Gemini mesajlarını scrape et
 * Gemini'de DOM ID mevcut olduğu için önce onu kullanır, yoksa hash
 * @returns {Array<{ index: number, role: string, text: string, contentHash: string, domIndex: number, domId?: string }>}
 */
interface ScrapedMessage {
  index: number;
  role: string;
  text: string;
  contentHash: string;
  domIndex: number;
  domId?: string | null;
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

  const config = (window.__hayalet_provider_config || {}) as { scrapeSelectors?: Record<string, string>; roleSelectors?: Record<string, string> };
  const { scrapeSelectors = {}, roleSelectors = {} } = config;

  const preferredSel = scrapeSelectors.preferred || ".message-content";
  const fallbackSel =
    scrapeSelectors.fallback ||
    ".user-query-bubble-with-background, .markdown-main-panel";
  const messageIdSel = scrapeSelectors.messageId || '[id^="message-content-id-"]';

  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const base = preferred.length
    ? preferred
    : Array.from(document.querySelectorAll(fallbackSel));

  const nodes = base.filter(
    (n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)),
  );

  const result: ScrapedMessage[] = [];
  nodes.forEach((node, idx) => {
    let role = "assistant";

    if (roleSelectors.user && node.matches(roleSelectors.user)) {
      role = "user";
    } else if (
      roleSelectors.assistant &&
      node.matches(roleSelectors.assistant)
    ) {
      role = "assistant";
    } else {
      if (roleSelectors.user && node.querySelector(roleSelectors.user)) {
        role = "user";
      } else if (
        roleSelectors.assistant &&
        node.querySelector(roleSelectors.assistant)
      ) {
        role = "assistant";
      }
    }

    let textContent = "";
    if (roleSelectors.text) {
      const textNodes = Array.from(node.querySelectorAll(roleSelectors.text)) as HTMLElement[];
      textContent = textNodes
        .map((t) => t.innerText)
        .join(" ")
        .trim();
    }

    if (!textContent) {
      textContent = ((node as HTMLElement).innerText || "").trim();
    }

    if (!textContent) {
      const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
      const alt = imgs
        .map((img) => (img.alt || "").trim())
        .filter(Boolean)
        .join(" ");
      if (alt) textContent = alt;
      else if (imgs.length) textContent = "[image]";
    }

    if (!textContent) return;

    // DOM ID'yi çıkarmayı dene (Gemini'de benzersiz ID var)
    let domId = null;
    const idElement = node.matches(messageIdSel) ? node : node.querySelector(messageIdSel);
    if (idElement && idElement.id) {
      domId = idElement.id;
    }

    // Hash ekle (fallback veya duplicate detection için)
    const contentHash = hashString(textContent);
    result.push({ index: idx, role, text: textContent, contentHash, domIndex: idx, domId });
  });

  return result;
}
