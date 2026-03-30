import { attachAsset, normalizeText } from "./content-loader-shared.js";
import type { FateKnotsAssetRegistry } from "./asset-registry.js";

interface FateKnotsSelectionRecord extends Record<string, unknown> {
  id?: unknown;
  label?: unknown;
  assetId?: unknown;
  summary?: unknown;
  perk?: unknown;
  stats?: unknown;
  startingDeck?: unknown;
  version?: unknown;
  avatars?: unknown;
  classes?: unknown;
  backgrounds?: unknown;
}

export function normalizeSelectionEntry(
  candidate: unknown,
  defaults: FateKnotsSelectionRecord
) {
  const source: FateKnotsSelectionRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsSelectionRecord)
      : {};
  return {
    id: normalizeText(source.id) || defaults.id,
    label: normalizeText(source.label) || defaults.label,
    assetId: normalizeText(source.assetId) || defaults.assetId,
    summary: normalizeText(source.summary) || defaults.summary,
    perk: normalizeText(source.perk) || defaults.perk,
    stats:
      source.stats && typeof source.stats === "object" && Array.isArray(source.stats) === false
        ? source.stats
        : defaults.stats,
    startingDeck: Array.isArray(source.startingDeck)
      ? source.startingDeck.map(normalizeText).filter(Boolean)
      : defaults.startingDeck,
  };
}

export function normalizeSelectionsManifest(assetRegistry: FateKnotsAssetRegistry, raw: unknown) {
  const source: FateKnotsSelectionRecord =
    raw && typeof raw === "object" && Array.isArray(raw) === false
      ? (raw as FateKnotsSelectionRecord)
      : {};
  return {
    version:
      typeof source.version === "number" && Number.isInteger(source.version) ? source.version : 1,
    avatars: Array.isArray(source.avatars)
      ? source.avatars.map(function (entry: unknown) {
          const normalized = normalizeSelectionEntry(entry, {
            id: "avatar",
            label: "Unknown Avatar",
            assetId: "",
            summary: "",
            perk: "",
            stats: null,
            startingDeck: [],
          });
          return {
            ...normalized,
            ...attachAsset(assetRegistry, normalized.assetId, "avatar"),
          };
        })
      : [],
    classes: Array.isArray(source.classes)
      ? source.classes.map(function (entry: unknown) {
          const normalized = normalizeSelectionEntry(entry, {
            id: "class",
            label: "Unknown Class",
            assetId: "",
            summary: "",
            perk: "",
            stats: {},
            startingDeck: [],
          });
          return {
            ...normalized,
            ...attachAsset(assetRegistry, normalized.assetId, "class"),
          };
        })
      : [],
    backgrounds: Array.isArray(source.backgrounds)
      ? source.backgrounds.map(function (entry: unknown) {
          const normalized = normalizeSelectionEntry(entry, {
            id: "background",
            label: "Unknown Background",
            assetId: "",
            summary: "",
            perk: "",
            stats: null,
            startingDeck: [],
          });
          return {
            ...normalized,
            ...attachAsset(assetRegistry, normalized.assetId, "background"),
          };
        })
      : [],
  };
}
