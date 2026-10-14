import type { FateKnotsAssetRef, FateKnotsUniversePackage } from "./contracts.js";

export const FATE_KNOTS_CARD_ART_TAG_PREFIX = "card-art:";

export type FateKnotsCardArtIssueCode =
  "card-art-card-not-found" | "duplicate-card-art-binding" | "invalid-card-art-kind";

export interface FateKnotsCardArtIssue {
  code: FateKnotsCardArtIssueCode;
  assetId: string;
  cardId?: string;
}

function cardIdFromAsset(asset: FateKnotsAssetRef): string | null {
  const tags = asset.tags ?? [];
  const bindings = tags
    .filter((tag) => tag.startsWith(FATE_KNOTS_CARD_ART_TAG_PREFIX))
    .map((tag) => tag.slice(FATE_KNOTS_CARD_ART_TAG_PREFIX.length).trim())
    .filter(Boolean);
  return bindings.length === 1 ? (bindings[0] ?? null) : null;
}

export function getFateKnotsCardArtAsset(
  universe: FateKnotsUniversePackage,
  cardId: string
): FateKnotsAssetRef | null {
  const matches = universe.assets.filter((asset) => cardIdFromAsset(asset) === cardId);
  const match = matches.length === 1 ? matches[0] : undefined;
  if (!match) return null;
  const result: FateKnotsAssetRef = { ...match };
  if (match.tags) result.tags = match.tags.slice();
  return result;
}

export function validateFateKnotsCardArtBindings(
  universe: FateKnotsUniversePackage
): FateKnotsCardArtIssue[] {
  const issues: FateKnotsCardArtIssue[] = [];
  const cardIds = new Set(universe.cards.map((card) => card.id));
  const ownerByCardId = new Map<string, string>();

  for (const asset of universe.assets) {
    const tags = asset.tags ?? [];
    const bindings = tags
      .filter((tag) => tag.startsWith(FATE_KNOTS_CARD_ART_TAG_PREFIX))
      .map((tag) => tag.slice(FATE_KNOTS_CARD_ART_TAG_PREFIX.length).trim())
      .filter(Boolean);
    if (bindings.length === 0) continue;

    if (asset.kind !== "other") {
      issues.push({ code: "invalid-card-art-kind", assetId: asset.id });
    }
    if (bindings.length !== 1) {
      issues.push({ code: "duplicate-card-art-binding", assetId: asset.id });
      continue;
    }

    const cardId = bindings[0] as string;
    if (!cardIds.has(cardId)) {
      issues.push({ code: "card-art-card-not-found", assetId: asset.id, cardId });
      continue;
    }
    if (ownerByCardId.has(cardId)) {
      issues.push({ code: "duplicate-card-art-binding", assetId: asset.id, cardId });
      continue;
    }
    ownerByCardId.set(cardId, asset.id);
  }

  return issues;
}
