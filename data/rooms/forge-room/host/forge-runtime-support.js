const FORGE_DEFAULT_PROMPT_LOCALE = "tr";
export function createForgeId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
export function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
export function toRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
}
export function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
export function asStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim() !== "") : [];
}
export function uniqueStrings(values) {
  const seen = /* @__PURE__ */ new Set();
  return values.filter((value) => {
    const normalized = value.trim();
    if (normalized === "" || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}
export function extractJsonValue(rawText) {
  const trimmed = rawText.trim();
  if (trimmed === "") {
    return null;
  }
  const attempts = /* @__PURE__ */ new Set([trimmed]);
  const fenceMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fenceMatches) {
    if (typeof match[1] === "string" && match[1].trim() !== "") {
      attempts.add(match[1].trim());
    }
  }
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    attempts.add(trimmed.slice(objectStart, objectEnd + 1).trim());
  }
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    attempts.add(trimmed.slice(arrayStart, arrayEnd + 1).trim());
  }
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }
  return null;
}
export function toJsonText(value) {
  return JSON.stringify(value, null, 2);
}
export function normalizeTextForComparison(value) {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[`*_>#-]/g, "").trim();
}
export function slugifyFilePart(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
function canonicalizeForgeLocaleTag(value) {
  const trimmed = value.trim().replace(/_/g, "-");
  if (trimmed === "") {
    return FORGE_DEFAULT_PROMPT_LOCALE;
  }
  try {
    return new Intl.Locale(trimmed).toString();
  } catch {
    return trimmed;
  }
}
export function resolveForgePromptLocale(value) {
  if (typeof value !== "string") {
    return FORGE_DEFAULT_PROMPT_LOCALE;
  }
  const normalized = canonicalizeForgeLocaleTag(value);
  return normalized === "" ? FORGE_DEFAULT_PROMPT_LOCALE : normalized;
}
export function buildForgeOutputLanguageRule(locale) {
  const normalizedLocale = resolveForgePromptLocale(locale);
  const languageLabel = normalizedLocale === "tr" ? "Turkish" : normalizedLocale === "en" ? "English" : `the application language for locale "${normalizedLocale}"`;
  return [
    `Use ${languageLabel} for every human-readable JSON string value.`,
    `Match the active application locale (${normalizedLocale}).`,
    "Keep JSON keys, enum values, ids, and file paths unchanged."
  ].join(" ");
}
