/**
 * ChatGPT mesajlarını scrape et
 * @returns {Array<{ index: number, role: string, text: string, contentHash: string, domIndex: number }>}
 */
export function scrapeMessages() {
  // Hash fonksiyonu (djb2 algoritması) - fonksiyon içinde tanımlı olmalı
  // çünkü toString() ile webview'a inject edildiğinde dış fonksiyonlar görünmez
  function hashString(str: string) {
    if (!str) return "0";
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }

  const preferredSel =
    (window.__hayalet_provider_config &&
      window.__hayalet_provider_config.scrapeSelectors?.preferred) ||
    "[data-message-author-role]";
  const fallbackSel =
    (window.__hayalet_provider_config &&
      window.__hayalet_provider_config.scrapeSelectors?.fallback) ||
    ".message-bubble, .markdown.prose";
  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const fallback = Array.from(document.querySelectorAll(fallbackSel));
  const base = preferred.length ? preferred : fallback;
  const nodes = base.filter((n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)));
  const mid = window.innerWidth / 2;
  const result: { index: number; role: string; text: string; contentHash: string; domIndex: number }[] = [];
  nodes.forEach((node, idx) => {
    const roleNode = node.getAttribute("data-message-author-role")
      ? node
      : node.closest("[data-message-author-role]");
    const roleAttr = roleNode?.getAttribute("data-message-author-role") || "";
    let text = ((node as HTMLElement).innerText || node.textContent || "").trim();
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
    let role = "assistant";
    if (roleAttr === "user") role = "user";
    else if (roleAttr === "assistant") role = "assistant";
    else {
      const rect = node.getBoundingClientRect();
      role = rect.left > mid ? "user" : "assistant";
    }
    // Hash ekle (incremental sync için)
    const contentHash = hashString(text);

    const lastMsg = result[result.length - 1];
    if (lastMsg && lastMsg.role === role && lastMsg.contentHash === contentHash) {
      return;
    }

    result.push({ index: idx, role, text, contentHash, domIndex: idx });
  });
  return result;
}
