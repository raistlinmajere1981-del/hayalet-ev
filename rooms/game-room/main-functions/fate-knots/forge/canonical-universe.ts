import type {
  FateKnotsCharacterDefinition,
  FateKnotsUniversePackage,
} from "../shared/contracts.js";
import {
  normalizeFateKnotsUniversePackage,
  type FateKnotsUniverseValidationIssue,
  type FateKnotsUniverseValidationResult,
} from "./universe-validation.js";

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
      ...(typeof universe.map.startNodeId === "string"
        ? { value: universe.map.startNodeId }
        : {}),
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
    characters: universe.characters.map(
      (character): FateKnotsCharacterDefinition => ({
        ...character,
        startingPosition: { ...character.startingPosition },
        baseStats: { ...character.baseStats },
        tags: character.tags.slice(),
        startingCardIds: character.startingCardIds.slice(),
        startingEquipmentIds: character.startingEquipmentIds.slice(),
        ...(character.combatController
          ? { combatController: { ...character.combatController } }
          : {}),
      })
    ),
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
 * asset integrity and valid optional card-art references.
 */
export function normalizeFateKnotsCanonicalUniversePackage(
  candidate: unknown
): FateKnotsUniverseValidationResult {
  const normalized = normalizeFateKnotsUniversePackage(candidate);
  if (!normalized.valid || !normalized.package) return normalized;

  const issues = [
    ...validateRunStartContract(normalized.package),
    ...validateRendererAssetContract(normalized.package),
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
