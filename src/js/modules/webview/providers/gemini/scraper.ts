/**
 * Scrape Gemini messages.
 * Gemini prefers the DOM ID when available, otherwise it falls back to the hash.
 *
 * Note: normalizeText and hashString are defined inline because of
 * webview injection constraints. Single source of truth:
 * @see ../shared/scraper-helpers.ts
 *
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

  const config = (window.__hayalet_provider_config ?? {}) as {
    scrapeSelectors?: Record<string, string>;
    roleSelectors?: Record<string, string>;
  };
  const { scrapeSelectors = {}, roleSelectors = {} } = config;

  const preferredSel = scrapeSelectors["preferred"] ?? ".message-content";
  const fallbackSel =
    scrapeSelectors["fallback"] ?? ".user-query-bubble-with-background, .markdown-main-panel";
  const messageIdSel = scrapeSelectors["messageId"] ?? '[id^="message-content-id-"]';

  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const base =
    preferred.length !== 0 ? preferred : Array.from(document.querySelectorAll(fallbackSel));

  const nodes = base.filter((n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)));

  const result: ScrapedMessage[] = [];
  nodes.forEach((node, idx) => {
    let role = "assistant";
    const userSelector = roleSelectors["user"];
    const assistantSelector = roleSelectors["assistant"];

    if (userSelector !== undefined && userSelector !== "" && node.matches(userSelector)) {
      role = "user";
    } else if (
      assistantSelector !== undefined &&
      assistantSelector !== "" &&
      node.matches(assistantSelector)
    ) {
      role = "assistant";
    } else {
      if (userSelector !== undefined && userSelector !== "" && node.querySelector(userSelector)) {
        role = "user";
      } else if (
        assistantSelector !== undefined &&
        assistantSelector !== "" &&
        node.querySelector(assistantSelector)
      ) {
        role = "assistant";
      }
    }

    let textContent = "";
    const textSelector = roleSelectors["text"];
    if (textSelector !== undefined && textSelector !== "") {
      const textNodes = Array.from(node.querySelectorAll(textSelector));
      textContent = textNodes
        .map((t) => (t as HTMLElement).innerText)
        .join(" ")
        .trim();
    }

    if (textContent === "") {
      textContent = (node as HTMLElement).innerText.trim();
    }

    if (textContent === "") {
      const imgs = Array.from(node.querySelectorAll("img"));
      const alt = imgs
        .map((img) => img.alt.trim())
        .filter(Boolean)
        .join(" ");
      if (alt !== "") textContent = alt;
      else if (imgs.length !== 0) textContent = "[image]";
    }

    if (textContent === "") return;

    let domId = null;
    const idElement = node.matches(messageIdSel) ? node : node.querySelector(messageIdSel);
    if (idElement?.id !== undefined && idElement.id !== "") {
      domId = idElement.id;
    }

    // Add a hash for fallback lookup or duplicate detection.
    const contentHash = hashString(textContent);
    result.push({ index: idx, role, text: textContent, contentHash, domIndex: idx, domId });
  });

  return result;
}
