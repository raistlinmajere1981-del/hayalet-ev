export function scrapeMessages() {
  const config = window.__hayalet_provider_config || {};
  const { scrapeSelectors = {}, roleSelectors = {} } = config;

  const preferredSel = scrapeSelectors.preferred || ".message-content";
  const fallbackSel =
    scrapeSelectors.fallback ||
    ".user-query-bubble-with-background, .markdown-main-panel";

  const preferred = Array.from(document.querySelectorAll(preferredSel));
  const base = preferred.length
    ? preferred
    : Array.from(document.querySelectorAll(fallbackSel));

  const nodes = base.filter(
    (n, i, arr) => !arr.some((o, j) => i !== j && o.contains(n)),
  );

  const result = [];
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
      const textNodes = Array.from(node.querySelectorAll(roleSelectors.text));
      textContent = textNodes
        .map((t) => t.innerText)
        .join(" ")
        .trim();
    }

    if (!textContent) {
      textContent = (node.innerText || "").trim();
    }

    if (!textContent) {
      const imgs = Array.from(node.querySelectorAll("img"));
      const alt = imgs
        .map((img) => (img.alt || "").trim())
        .filter(Boolean)
        .join(" ");
      if (alt) textContent = alt;
      else if (imgs.length) textContent = "[image]";
    }

    if (!textContent) return;

    result.push({ index: idx, role, text: textContent });
  });

  return result;
}
