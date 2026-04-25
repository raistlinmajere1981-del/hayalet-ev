export function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}
export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
export function translate(locale, group, key) {
  const entry = group[key];
  if (!entry) {
    return "";
  }
  const normalizedLocale = normalizeLocale(locale);
  return entry[normalizedLocale] || entry.en || "";
}
export function fillTemplate(template, params = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = Object.prototype.hasOwnProperty.call(params, key) ? params[key] : "";
    return String(value ?? "");
  });
}
