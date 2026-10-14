import type {
  FateKnotsAssetRef,
  FateKnotsCardKind,
  FateKnotsPresentationEvent,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import type { FateKnotsGameplayPresentationCueSummary } from "./gameplay-state.js";

export interface FateKnotsResolvedCardArtSummary {
  assetId: string;
  path: string;
  mimeType: string | null;
  tags: string[];
}

export interface FateKnotsResolvedCardPresentationSnapshot {
  cardId: string;
  kind: FateKnotsCardKind;
  name: string;
  description: string;
  art: FateKnotsResolvedCardArtSummary | null;
  cues: FateKnotsGameplayPresentationCueSummary[];
}

export type FateKnotsResolvedCardPresentationIssueCode =
  | "not-card-resolved-event"
  | "missing-card-id"
  | "card-not-found"
  | "art-asset-not-found"
  | "cue-not-found";

export interface FateKnotsResolvedCardPresentationIssue {
  code: FateKnotsResolvedCardPresentationIssueCode;
  value?: string;
}

export type FateKnotsResolvedCardPresentationResult =
  | {
      ok: true;
      snapshot: FateKnotsResolvedCardPresentationSnapshot;
      issues: [];
    }
  | {
      ok: false;
      snapshot: null;
      issues: FateKnotsResolvedCardPresentationIssue[];
    };

function summarizeCue(
  cue: FateKnotsUniversePackage["cards"][number]["presentation"][number]
): FateKnotsGameplayPresentationCueSummary {
  return {
    cueId: cue.cueId,
    animationId: cue.animationId ?? null,
    soundEffectId: cue.soundEffectId ?? null,
    applyTo: cue.applyTo,
    timing: cue.timing,
    statusVisualId: cue.statusVisualId ?? null,
  };
}

function summarizeArt(asset: FateKnotsAssetRef): FateKnotsResolvedCardArtSummary {
  return {
    assetId: asset.id,
    path: asset.path,
    mimeType: asset.mimeType ?? null,
    tags: asset.tags?.slice() ?? [],
  };
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Reveals only the presentation identity of a card that the engine has already
 * resolved publicly.
 *
 * This helper is intentionally event-gated. It must not be used to inspect an
 * opposition hand/commit before resolution. The result contains no requirements,
 * mechanical effects, ownership, availability, targets beyond those already on
 * the semantic event, hidden canon or enemy inventory data.
 */
export function buildFateKnotsResolvedCardPresentationSnapshot(
  universe: FateKnotsUniversePackage,
  event: FateKnotsPresentationEvent
): FateKnotsResolvedCardPresentationResult {
  if (event.type !== "card-resolved") {
    return {
      ok: false,
      snapshot: null,
      issues: [{ code: "not-card-resolved-event" }],
    };
  }

  if (typeof event.cardId !== "string" || event.cardId.trim() === "") {
    return {
      ok: false,
      snapshot: null,
      issues: [{ code: "missing-card-id" }],
    };
  }

  const cardId = event.cardId.trim();
  const card = universe.cards.find((candidate) => candidate.id === cardId) ?? null;
  if (!card) {
    return {
      ok: false,
      snapshot: null,
      issues: [{ code: "card-not-found", value: cardId }],
    };
  }

  let art: FateKnotsResolvedCardArtSummary | null = null;
  if (typeof card.artAssetId === "string" && card.artAssetId.trim() !== "") {
    const artAssetId = card.artAssetId.trim();
    const asset = universe.assets.find((candidate) => candidate.id === artAssetId) ?? null;
    if (!asset) {
      return {
        ok: false,
        snapshot: null,
        issues: [{ code: "art-asset-not-found", value: artAssetId }],
      };
    }
    art = summarizeArt(asset);
  }

  const cueIds = unique(event.cueIds ?? []);
  const cueById = new Map(card.presentation.map((cue) => [cue.cueId, cue] as const));
  const cues: FateKnotsGameplayPresentationCueSummary[] = [];
  const issues: FateKnotsResolvedCardPresentationIssue[] = [];

  for (const cueId of cueIds) {
    const cue = cueById.get(cueId);
    if (!cue) {
      issues.push({ code: "cue-not-found", value: cueId });
      continue;
    }
    cues.push(summarizeCue(cue));
  }

  if (issues.length > 0) return { ok: false, snapshot: null, issues };

  return {
    ok: true,
    snapshot: {
      cardId: card.id,
      kind: card.kind,
      name: card.name,
      description: card.description ?? "",
      art,
      cues,
    },
    issues: [],
  };
}
