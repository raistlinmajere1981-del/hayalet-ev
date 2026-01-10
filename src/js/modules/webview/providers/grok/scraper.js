export function scrapeMessages() {
  const preferredSel =
    (window.__hayalet_provider_config &&
      window.__hayalet_provider_config.scrapeSelectors?.preferred) ||
    "[data-message-author-role]";
  const fallbackSel =
    (window.__hayalet_provider_config &&
      window.__hayalet_provider_config.scrapeSelectors?.fallback) ||
    ".message-bubble";
  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const fallback = Array.from(document.querySelectorAll(fallbackSel));
  const base = preferred.length ? preferred : fallback;
  const nodes = base.filter(
    (n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)),
  );
  const mid = window.innerWidth / 2;
  const result = [];
  nodes.forEach((node, idx) => {
    const roleNode = node.getAttribute("data-message-author-role")
      ? node
      : node.closest("[data-message-author-role]");
    const roleAttr = roleNode?.getAttribute("data-message-author-role") || "";
    let text = (node.innerText || "").trim();
    if (!text) {
      const imgs = Array.from(node.querySelectorAll("img"));
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
    result.push({ index: idx, role, text });
  });
  return result;
}
