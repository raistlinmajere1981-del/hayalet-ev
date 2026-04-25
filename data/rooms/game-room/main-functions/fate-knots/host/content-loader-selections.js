import { attachAsset, normalizeText } from "./content-loader-shared.js";
export function normalizeSelectionEntry(candidate, defaults) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  return {
    id: normalizeText(source.id) || defaults.id,
    label: normalizeText(source.label) || defaults.label,
    assetId: normalizeText(source.assetId) || defaults.assetId,
    summary: normalizeText(source.summary) || defaults.summary,
    perk: normalizeText(source.perk) || defaults.perk,
    stats: source.stats && typeof source.stats === "object" && Array.isArray(source.stats) === false ? source.stats : defaults.stats,
    startingDeck: Array.isArray(source.startingDeck) ? source.startingDeck.map(normalizeText).filter(Boolean) : defaults.startingDeck
  };
}
export function normalizeSelectionsManifest(assetRegistry, raw) {
  const source = raw && typeof raw === "object" && Array.isArray(raw) === false ? raw : {};
  return {
    version: typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    avatars: Array.isArray(source.avatars) ? source.avatars.map(function(entry) {
      const normalized = normalizeSelectionEntry(entry, {
        id: "avatar",
        label: "Unknown Avatar",
        assetId: "",
        summary: "",
        perk: "",
        stats: null,
        startingDeck: []
      });
      return {
        ...normalized,
        ...attachAsset(assetRegistry, normalized.assetId, "avatar")
      };
    }) : [],
    classes: Array.isArray(source.classes) ? source.classes.map(function(entry) {
      const normalized = normalizeSelectionEntry(entry, {
        id: "class",
        label: "Unknown Class",
        assetId: "",
        summary: "",
        perk: "",
        stats: {},
        startingDeck: []
      });
      return {
        ...normalized,
        ...attachAsset(assetRegistry, normalized.assetId, "class")
      };
    }) : [],
    backgrounds: Array.isArray(source.backgrounds) ? source.backgrounds.map(function(entry) {
      const normalized = normalizeSelectionEntry(entry, {
        id: "background",
        label: "Unknown Background",
        assetId: "",
        summary: "",
        perk: "",
        stats: null,
        startingDeck: []
      });
      return {
        ...normalized,
        ...attachAsset(assetRegistry, normalized.assetId, "background")
      };
    }) : []
  };
}
