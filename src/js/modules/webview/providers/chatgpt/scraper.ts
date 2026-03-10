export function scrapeMessages(): Array<{
  index: number;
  role: string;
  text: string;
  contentHash: string;
  domIndex: number;
  domId?: string | null;
}> {
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
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash << 5) + hash + normalized.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }

  const config =
    window.__app_provider_config ??
    ({
      scrapeSelectors: {
        preferred: "[data-message-author-role]",
        fallback: ".message-bubble, .markdown.prose",
      },
    } as const);
  const preferredSel = config.scrapeSelectors.preferred;
  const fallbackSel = config.scrapeSelectors.fallback;
  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const fallback = Array.from(document.querySelectorAll(fallbackSel));
  const base = preferred.length !== 0 ? preferred : fallback;
  const nodes = base.filter((n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)));
  const mid = window.innerWidth / 2;
  const result: {
    index: number;
    role: string;
    text: string;
    contentHash: string;
    domIndex: number;
    domId?: string | null;
  }[] = [];
  nodes.forEach((node, idx) => {
    const authorRole = node.getAttribute("data-message-author-role");
    const roleNode =
      authorRole !== null && authorRole !== "" ? node : node.closest("[data-message-author-role]");
    const roleAttr = roleNode?.getAttribute("data-message-author-role") ?? "";
    let text = (node as HTMLElement).innerText.trim();
    if (text === "") {
      const textContent = (node as HTMLElement).textContent.trim();
      if (textContent !== "") {
        text = textContent;
      }
    }
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
    const role = ((): string => {
      if (roleAttr === "user") return "user";
      if (roleAttr === "assistant") return "assistant";

      const rect = node.getBoundingClientRect();
      return rect.left > mid ? "user" : "assistant";
    })();
    const contentHash = hashString(text);

    const wrapper =
      node.closest('[data-testid="conversation-turn"]') ??
      node.closest("[data-message-id]") ??
      node;
    const domIdCandidate =
      wrapper.getAttribute("data-message-id") ??
      wrapper.getAttribute("data-turn-id") ??
      wrapper.getAttribute("id") ??
      node.getAttribute("data-message-id") ??
      node.getAttribute("data-turn-id") ??
      node.getAttribute("id") ??
      "";
    const domId = domIdCandidate.trim() === "" ? null : domIdCandidate.trim();

    result.push({ index: idx, role, text, contentHash, domIndex: idx, domId });
  });
  return result;
}
