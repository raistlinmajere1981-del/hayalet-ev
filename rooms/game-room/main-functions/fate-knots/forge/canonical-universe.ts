import type {
  FateKnotsCharacterDefinition,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import {
  normalizeFateKnotsUniversePackage,
  type FateKnotsUniverseValidationIssue,
  type FateKnotsUniverseValidationResult,
} from "./universe-validation.js";

const PRESENTATION_APPLY_TO = new Set([
  "card",
  "self",
  "primaryTarget",
  "secondaryTarget",
  "allAllies",
  "allEnemies",
  "casterAndTarget",
  "battlefield",
  "pageOverlay",
]);

const PRESENTATION_TIMING = new Set([
  "onSelect",
  "onCommit",
  "beforeResolve",
  "onResolve",
  "afterResolve",
  "persistent",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidStartingPosition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    (value["row"] === "front" || value["row"] === "rear") &&
    (value["range"] === "engaged" || value["range"] === "near" || value["range"] === "far")
  );
}

function validateRunStartContract(
  universe: FateKnotsUniversePackage
): FateKnotsUniverseValidationIssue[] {
  const issues: FateKnotsUniverseValidationIssue[] = [];
  const nodeIds = new Set(universe.map.nodes.map((node) => node.id));

  if (
    typeof universe.map.startNodeId !== "string" ||
    universe.map.startNodeId.trim() === "" ||
    !nodeIds.has(universe.map.startNodeId)
  ) {
    issues.push({
      code: "missing-reference",
      path: "map.startNodeId",
      ...(typeof universe.map.startNodeId === "string" ? { value: universe.map.startNodeId } : {}),
    });
  }

  let selectableCount = 0;
  universe.characters.forEach((character, index) => {
    if (typeof character.playerSelectable !== "boolean") {
      issues.push({ code: "invalid-field-type", path: `characters[${index}].playerSelectable` });
    } else if (character.playerSelectable) {
      selectableCount += 1;
    }

    if (!isValidStartingPosition(character.startingPosition)) {
      issues.push({ code: "invalid-field-type", path: `characters[${index}].startingPosition` });
    }
  });

  if (selectableCount === 0) {
    issues.push({ code: "missing-required-field", path: "characters[playerSelectable=true]" });
  }

  return issues;
}

function validateAssetReference(
  assetIds: ReadonlySet<string>,
  value: unknown,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (typeof value !== "string" || value.trim() === "" || !assetIds.has(value.trim())) {
    issues.push({
      code: "missing-reference",
      path,
      ...(typeof value === "string" && value.trim() !== "" ? { value: value.trim() } : {}),
    });
  }
}

function validateRendererAssetContract(
  universe: FateKnotsUniversePackage
): FateKnotsUniverseValidationIssue[] {
  const issues: FateKnotsUniverseValidationIssue[] = [];
  const assetIds = new Set(universe.assets.map((asset) => asset.id));
  const rawTheme = universe.theme as unknown;

  if (!isRecord(rawTheme)) {
    return [{ code: "invalid-field-type", path: "theme" }];
  }

  const cardFrames = rawTheme["cardFrameByKind"];
  if (!isRecord(cardFrames)) {
    issues.push({ code: "invalid-field-type", path: "theme.cardFrameByKind" });
  } else {
    Object.entries(cardFrames).forEach(([kind, assetId]) => {
      validateAssetReference(assetIds, assetId, `theme.cardFrameByKind.${kind}`, issues);
    });
  }

  for (const key of ["bookmarkAssetIds", "transitionAssetIds"] as const) {
    const values = rawTheme[key];
    if (values === undefined) continue;
    if (!Array.isArray(values)) {
      issues.push({ code: "invalid-field-type", path: `theme.${key}` });
      continue;
    }
    values.forEach((assetId, index) =>
      validateAssetReference(assetIds, assetId, `theme.${key}[${index}]`, issues)
    );
  }

  if (universe.map.mapAssetId !== undefined && universe.map.mapAssetId !== null) {
    validateAssetReference(assetIds, universe.map.mapAssetId, "map.mapAssetId", issues);
  }

  return issues;
}

function validatePresentationCue(
  cue: unknown,
  path: string,
  seenCueIds: Set<string>,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (!isRecord(cue)) {
    issues.push({ code: "invalid-field-type", path });
    return;
  }

  const cueId = cue["cueId"];
  if (typeof cueId !== "string" || cueId.trim() === "") {
    issues.push({ code: "invalid-field-type", path: `${path}.cueId` });
  } else if (seenCueIds.has(cueId.trim())) {
    issues.push({ code: "duplicate-id", path: `${path}.cueId`, value: cueId.trim() });
  } else {
    seenCueIds.add(cueId.trim());
  }

  const applyTo = cue["applyTo"];
  if (typeof applyTo !== "string" || !PRESENTATION_APPLY_TO.has(applyTo)) {
    issues.push({
      code: "invalid-field-type",
      path: `${path}.applyTo`,
      ...(typeof applyTo === "string" ? { value: applyTo } : {}),
    });
  }

  const timing = cue["timing"];
  if (typeof timing !== "string" || !PRESENTATION_TIMING.has(timing)) {
    issues.push({
      code: "invalid-field-type",
      path: `${path}.timing`,
      ...(typeof timing === "string" ? { value: timing } : {}),
    });
  }

  for (const key of ["animationId", "soundEffectId", "statusVisualId"] as const) {
    const value = cue[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || value.trim() === "") {
      issues.push({ code: "invalid-field-type", path: `${path}.${key}` });
    }
  }
}

function validateRendererPresentationContract(
  universe: FateKnotsUniversePackage
): FateKnotsUniverseValidationIssue[] {
  const issues: FateKnotsUniverseValidationIssue[] = [];

  universe.cards.forEach((card, cardIndex) => {
    const rawCard = card as unknown;
    if (!isRecord(rawCard)) return;
    const presentation = rawCard["presentation"];
    if (!Array.isArray(presentation)) {
      issues.push({ code: "invalid-field-type", path: `cards[${cardIndex}].presentation` });
      return;
    }
    const seenCueIds = new Set<string>();
    presentation.forEach((cue, cueIndex) =>
      validatePresentationCue(
        cue,
        `cards[${cardIndex}].presentation[${cueIndex}]`,
        seenCueIds,
        issues
      )
    );
  });

  universe.statuses.forEach((status, statusIndex) => {
    const rawStatus = status as unknown;
    if (!isRecord(rawStatus)) return;
    const presentation = rawStatus["presentation"];
    if (presentation === undefined) return;
    if (!Array.isArray(presentation)) {
      issues.push({ code: "invalid-field-type", path: `statuses[${statusIndex}].presentation` });
      return;
    }
    const seenCueIds = new Set<string>();
    presentation.forEach((cue, cueIndex) =>
      validatePresentationCue(
        cue,
        `statuses[${statusIndex}].presentation[${cueIndex}]`,
        seenCueIds,
        issues
      )
    );
  });

  return issues;
}

function validateCardArtContract(
  universe: FateKnotsUniversePackage
): FateKnotsUniverseValidationIssue[] {
  const issues: FateKnotsUniverseValidationIssue[] = [];
  const assetIds = new Set(universe.assets.map((asset) => asset.id));

  universe.cards.forEach((card, index) => {
    const rawCard = card as unknown;
    if (!isRecord(rawCard)) {
      issues.push({ code: "invalid-field-type", path: `cards[${index}]` });
      return;
    }

    const rawArtAssetId = rawCard["artAssetId"];
    if (rawArtAssetId === undefined || rawArtAssetId === null) return;
    if (typeof rawArtAssetId !== "string") {
      issues.push({ code: "invalid-field-type", path: `cards[${index}].artAssetId` });
      return;
    }

    const artAssetId = rawArtAssetId.trim();
    if (artAssetId === "" || !assetIds.has(artAssetId)) {
      issues.push({
        code: "missing-reference",
        path: `cards[${index}].artAssetId`,
        ...(artAssetId !== "" ? { value: artAssetId } : {}),
      });
    }
  });

  return issues;
}

function cloneRunStartContract(universe: FateKnotsUniversePackage): FateKnotsUniversePackage {
  return {
    ...universe,
    map: {
      ...universe.map,
      nodes: universe.map.nodes.map((node) => ({
        ...node,
        ...(node.mapPosition ? { mapPosition: { ...node.mapPosition } } : {}),
      })),
      edges: universe.map.edges.map((edge) => ({
        ...edge,
        ...(edge.travelCardIds ? { travelCardIds: edge.travelCardIds.slice() } : {}),
        ...(edge.tags ? { tags: edge.tags.slice() } : {}),
      })),
    },
    characters: universe.characters.map((character): FateKnotsCharacterDefinition => ({
      ...character,
      startingPosition: { ...character.startingPosition },
      baseStats: { ...character.baseStats },
      tags: character.tags.slice(),
      startingCardIds: character.startingCardIds.slice(),
      startingEquipmentIds: character.startingEquipmentIds.slice(),
      ...(character.combatController
        ? { combatController: { ...character.combatController } }
        : {}),
    })),
    cards: universe.cards.map((card) => ({
      ...card,
      ...(typeof card.artAssetId === "string"
        ? { artAssetId: card.artAssetId.trim() }
        : card.artAssetId === null
          ? { artAssetId: null }
          : {}),
    })),
  };
}

/**
 * Final World Forge acceptance gate for a runnable/renderable V1 universe.
 *
 * The structural validator remains responsible for the broad Universe Package.
 * This layer adds deterministic data required to create/render a run without
 * renderer/Codex defaults: a canonical start node, explicit player-selectable
 * character templates, initial lightweight positions, renderer-facing theme/map
 * asset integrity, validated presentation cue shapes and valid optional card-art
 * references.
 */
export function normalizeFateKnotsCanonicalUniversePackage(
  candidate: unknown
): FateKnotsUniverseValidationResult {
  const normalized = normalizeFateKnotsUniversePackage(candidate);
  if (!normalized.valid || !normalized.package) return normalized;

  const issues = [
    ...validateRunStartContract(normalized.package),
    ...validateRendererAssetContract(normalized.package),
    ...validateRendererPresentationContract(normalized.package),
    ...validateCardArtContract(normalized.package),
  ];
  if (issues.length > 0) {
    return { valid: false, package: null, issues };
  }

  return {
    valid: true,
    package: cloneRunStartContract(normalized.package),
    issues: [],
  };
}
