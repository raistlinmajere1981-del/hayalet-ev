import { asLabRecord } from "../models/lab-types.js";
function getCatalogValue(catalog, key) {
  const parts = key.split(".").filter(Boolean);
  let current = catalog;
  for (const part of parts) {
    const record = asLabRecord(current);
    if (Object.prototype.hasOwnProperty.call(record, part) !== true) {
      return null;
    }
    current = record[part];
  }
  return typeof current === "string" ? current : null;
}
function applyParams(template, params) {
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(function(copy, [key, value]) {
    return copy.replaceAll(`{${key}}`, String(value));
  }, template);
}
export const LAB_FALLBACK_I18N = {
  locale: "en",
  t(_key, fallback, params) {
    return applyParams(fallback, params);
  }
};
export function createLabI18n(context) {
  const translations = asLabRecord(context["translations"]);
  const locale = typeof context["locale"] === "string" ? context["locale"] : "en";
  return {
    locale,
    t(key, fallback, params) {
      return applyParams(getCatalogValue(translations, key) ?? fallback, params);
    }
  };
}
