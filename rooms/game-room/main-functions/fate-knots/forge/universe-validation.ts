import {
  FATE_KNOTS_CARD_KINDS,
  FATE_KNOTS_RESOLUTION_PRIORITY_TIERS,
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsCardDefinition,
  type FateKnotsCardEffect,
  type FateKnotsEquipmentDefinition,
  type FateKnotsMechanicalEffectTarget,
  type FateKnotsUniversePackage,
} from "../shared/contracts.js";

export type FateKnotsUniverseValidationIssueCode =
  | "invalid-root"
  | "unsupported-schema-version"
  | "missing-required-field"
  | "invalid-field-type"
  | "empty-id"
  | "duplicate-id"
  | "missing-reference"
  | "invalid-card-kind"
  | "invalid-resolution-priority"
  | "invalid-effect-kind"
  | "invalid-effect-target"
  | "invalid-effect-value"
  | "invalid-effect-duration"
  | "invalid-effect-shape"
  | "invalid-equipment-controller"
  | "invalid-equipment-card-link"
  | "starting-equipment-card-missing"
  | "invalid-map-edge"
  | "invalid-finale-reference";

export interface FateKnotsUniverseValidationIssue {
  code: FateKnotsUniverseValidationIssueCode;
  path: string;
  value?: string;
}

export interface FateKnotsUniverseValidationResult {
  valid: boolean;
  package: FateKnotsUniversePackage | null;
  issues: FateKnotsUniverseValidationIssue[];
}

const EFFECT_KINDS = new Set([
  "damage",
  "heal",
  "shield",
  "apply-status",
  "remove-status",
  "move",
  "modify-stat",
  "modify-resource",
  "grant-card",
  "revoke-card",
  "consume",
  "reveal",
  "retreat",
]);

const EFFECT_TARGETS = new Set<FateKnotsMechanicalEffectTarget>([
  "self",
  "primaryTarget",
  "secondaryTarget",
  "allAllies",
  "allEnemies",
  "ownTeam",
  "run",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function pushTypeIssue(
  issues: FateKnotsUniverseValidationIssue[],
  path: string,
  present: boolean
): void {
  issues.push({ code: present ? "invalid-field-type" : "missing-required-field", path });
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): string | null {
  const value = record[key];
  if (!isNonEmptyString(value)) {
    pushTypeIssue(issues, `${path}.${key}`, value !== undefined);
    return null;
  }
  return value;
}

function requireArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): unknown[] | null {
  const value = record[key];
  if (!Array.isArray(value)) {
    pushTypeIssue(issues, `${path}.${key}`, value !== undefined);
    return null;
  }
  return value;
}

function collectUniqueIds(
  values: unknown[] | null,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): Set<string> {
  const ids = new Set<string>();
  if (!values) return ids;

  values.forEach((value, index) => {
    if (!isRecord(value)) {
      issues.push({ code: "invalid-field-type", path: `${path}[${index}]` });
      return;
    }
    const id = value["id"];
    if (!isNonEmptyString(id)) {
      issues.push({ code: "empty-id", path: `${path}[${index}].id` });
      return;
    }
    if (ids.has(id)) {
      issues.push({ code: "duplicate-id", path: `${path}[${index}].id`, value: id });
      return;
    }
    ids.add(id);
  });
  return ids;
}

function requireReference(
  value: unknown,
  targetIds: ReadonlySet<string>,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (!isNonEmptyString(value) || !targetIds.has(value)) {
    issues.push({
      code: "missing-reference",
      path,
      ...(typeof value === "string" ? { value } : {}),
    });
  }
}

function validateStringReferences(
  value: unknown,
  targetIds: ReadonlySet<string>,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (!isStringArray(value)) {
    issues.push({ code: "invalid-field-type", path });
    return;
  }
  value.forEach((id, index) => requireReference(id, targetIds, `${path}[${index}]`, issues));
}

function validateEffect(
  effect: unknown,
  path: string,
  cardIds: ReadonlySet<string>,
  statusIds: ReadonlySet<string>,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (!isRecord(effect)) {
    issues.push({ code: "invalid-field-type", path });
    return;
  }

  if (!isNonEmptyString(effect["id"])) issues.push({ code: "empty-id", path: `${path}.id` });
  const kind = effect["kind"];
  if (typeof kind !== "string" || !EFFECT_KINDS.has(kind)) {
    issues.push({ code: "invalid-effect-kind", path: `${path}.kind`, value: String(kind) });
    return;
  }

  const target = effect["target"];
  if (typeof target !== "string" || !EFFECT_TARGETS.has(target as FateKnotsMechanicalEffectTarget)) {
    issues.push({ code: "invalid-effect-target", path: `${path}.target`, value: String(target) });
  }

  const value = effect["value"];
  if (["damage", "heal", "shield"].includes(kind)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      issues.push({ code: "invalid-effect-value", path: `${path}.value` });
    }
  }
  if (["modify-stat", "modify-resource"].includes(kind)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ code: "invalid-effect-value", path: `${path}.value` });
    }
    if (!isNonEmptyString(effect["statId"])) {
      issues.push({ code: "invalid-effect-shape", path: `${path}.statId` });
    }
  }

  const durationTurns = effect["durationTurns"];
  if (
    durationTurns !== undefined &&
    (typeof durationTurns !== "number" || !Number.isInteger(durationTurns) || durationTurns <= 0)
  ) {
    issues.push({ code: "invalid-effect-duration", path: `${path}.durationTurns` });
  }

  if (kind === "apply-status" || kind === "remove-status") {
    requireReference(effect["statusId"], statusIds, `${path}.statusId`, issues);
  }
  if (kind === "grant-card" || kind === "revoke-card") {
    requireReference(effect["cardId"], cardIds, `${path}.cardId`, issues);
  }
  if (kind === "move") {
    const moveTo = effect["moveTo"];
    if (!isRecord(moveTo) || (moveTo["row"] === undefined && moveTo["range"] === undefined)) {
      issues.push({ code: "invalid-effect-shape", path: `${path}.moveTo` });
    }
  }
  if (kind === "reveal" && !isNonEmptyString(effect["revealId"])) {
    issues.push({ code: "invalid-effect-shape", path: `${path}.revealId` });
  }
  if (kind === "reveal" && target !== "run") {
    issues.push({ code: "invalid-effect-target", path: `${path}.target`, value: String(target) });
  }
  if (kind === "retreat" && target !== "ownTeam") {
    issues.push({ code: "invalid-effect-target", path: `${path}.target`, value: String(target) });
  }
}

function validateCards(
  cards: unknown[] | null,
  cardIds: ReadonlySet<string>,
  equipmentIds: ReadonlySet<string>,
  statusIds: ReadonlySet<string>,
  issues: FateKnotsUniverseValidationIssue[]
): Map<string, FateKnotsCardDefinition> {
  const result = new Map<string, FateKnotsCardDefinition>();
  if (!cards) return result;
  const allowedKinds = new Set<string>(FATE_KNOTS_CARD_KINDS);
  const allowedPriority = new Set<string>(FATE_KNOTS_RESOLUTION_PRIORITY_TIERS);

  cards.forEach((value, index) => {
    const path = `cards[${index}]`;
    if (!isRecord(value) || !isNonEmptyString(value["id"])) return;
    const id = value["id"];
    const kind = value["kind"];
    if (typeof kind !== "string" || !allowedKinds.has(kind)) {
      issues.push({ code: "invalid-card-kind", path: `${path}.kind`, value: String(kind) });
    }
    if (!isNonEmptyString(value["name"])) {
      issues.push({ code: "missing-required-field", path: `${path}.name` });
    }
    if (!isStringArray(value["tags"])) {
      issues.push({ code: "invalid-field-type", path: `${path}.tags` });
    }

    const priority = value["resolutionPriority"];
    if (priority !== undefined && (typeof priority !== "string" || !allowedPriority.has(priority))) {
      issues.push({
        code: "invalid-resolution-priority",
        path: `${path}.resolutionPriority`,
        value: String(priority),
      });
    }

    const effects = value["effects"];
    if (!Array.isArray(effects)) {
      issues.push({ code: "invalid-field-type", path: `${path}.effects` });
    } else {
      effects.forEach((effect, effectIndex) =>
        validateEffect(effect, `${path}.effects[${effectIndex}]`, cardIds, statusIds, issues)
      );
    }

    if (!Array.isArray(value["presentation"])) {
      issues.push({ code: "invalid-field-type", path: `${path}.presentation` });
    }

    if (kind === "equipment") {
      const sourceId = value["sourceId"];
      if (!isNonEmptyString(sourceId) || !equipmentIds.has(sourceId)) {
        issues.push({
          code: "invalid-equipment-card-link",
          path: `${path}.sourceId`,
          ...(typeof sourceId === "string" ? { value: sourceId } : {}),
        });
      }
    }

    result.set(id, value as unknown as FateKnotsCardDefinition);
  });
  return result;
}

function validateEquipment(
  equipment: unknown[] | null,
  cardIds: ReadonlySet<string>,
  issues: FateKnotsUniverseValidationIssue[]
): Map<string, FateKnotsEquipmentDefinition> {
  const result = new Map<string, FateKnotsEquipmentDefinition>();
  if (!equipment) return result;
  equipment.forEach((value, index) => {
    const path = `equipment[${index}]`;
    if (!isRecord(value) || !isNonEmptyString(value["id"])) return;
    if (!isNonEmptyString(value["name"])) pushTypeIssue(issues, `${path}.name`, value["name"] !== undefined);
    if (!isNonEmptyString(value["slot"])) pushTypeIssue(issues, `${path}.slot`, value["slot"] !== undefined);
    if (!isStringArray(value["tags"])) issues.push({ code: "invalid-field-type", path: `${path}.tags` });
    validateStringReferences(value["grantedCardIds"], cardIds, `${path}.grantedCardIds`, issues);
    if (value["removedCardIds"] !== undefined) {
      validateStringReferences(value["removedCardIds"], cardIds, `${path}.removedCardIds`, issues);
    }
    result.set(value["id"], value as unknown as FateKnotsEquipmentDefinition);
  });
  return result;
}

function validateCharacterEquipmentOwnership(
  characters: unknown[] | null,
  cardIds: ReadonlySet<string>,
  equipmentIds: ReadonlySet<string>,
  equipmentCardsBySource: ReadonlyMap<string, string[]>,
  assetIds: ReadonlySet<string>,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (!characters) return;
  characters.forEach((value, index) => {
    const path = `characters[${index}]`;
    if (!isRecord(value)) return;
    requireReference(value["portraitAssetId"], assetIds, `${path}.portraitAssetId`, issues);
    validateStringReferences(value["startingCardIds"], cardIds, `${path}.startingCardIds`, issues);
    validateStringReferences(value["startingEquipmentIds"], equipmentIds, `${path}.startingEquipmentIds`, issues);

    const startingCards = new Set(isStringArray(value["startingCardIds"]) ? value["startingCardIds"] : []);
    const startingEquipment = isStringArray(value["startingEquipmentIds"])
      ? value["startingEquipmentIds"]
      : [];

    for (const equipmentId of startingEquipment) {
      const representationCards = equipmentCardsBySource.get(equipmentId) ?? [];
      if (!representationCards.some((cardId) => startingCards.has(cardId))) {
        issues.push({
          code: "starting-equipment-card-missing",
          path: `${path}.startingEquipmentIds`,
          value: equipmentId,
        });
      }
    }

    const controller = value["combatController"];
    if (controller !== undefined && controller !== null) {
      if (!isRecord(controller) || (controller["kind"] !== "policy" && controller["kind"] !== "ai0")) {
        issues.push({ code: "invalid-equipment-controller", path: `${path}.combatController` });
      } else if (controller["kind"] === "policy" && !isNonEmptyString(controller["policyId"])) {
        issues.push({ code: "invalid-equipment-controller", path: `${path}.combatController.policyId` });
      }
    }
  });
}

/**
 * Runtime validation gate for a World Forge candidate.
 *
 * The validator deliberately focuses on structural safety, reference integrity
 * and fixed Fate Knots design laws. It does not judge story quality, balance,
 * prose quality, visual taste or whether a generated universe is interesting.
 */
export function validateFateKnotsUniversePackage(
  candidate: unknown
): FateKnotsUniverseValidationResult {
  const issues: FateKnotsUniverseValidationIssue[] = [];
  if (!isRecord(candidate)) {
    return { valid: false, package: null, issues: [{ code: "invalid-root", path: "$" }] };
  }

  if (candidate["schemaVersion"] !== FATE_KNOTS_SCHEMA_VERSION) {
    issues.push({
      code: "unsupported-schema-version",
      path: "schemaVersion",
      value: String(candidate["schemaVersion"]),
    });
  }

  requireString(candidate, "universeId", "$", issues);
  requireString(candidate, "title", "$", issues);
  requireString(candidate, "premise", "$", issues);
  requireString(candidate, "createdAt", "$", issues);

  const assets = requireArray(candidate, "assets", "$", issues);
  const locations = requireArray(candidate, "locations", "$", issues);
  const npcs = requireArray(candidate, "npcs", "$", issues);
  const characters = requireArray(candidate, "characters", "$", issues);
  const cards = requireArray(candidate, "cards", "$", issues);
  const equipment = requireArray(candidate, "equipment", "$", issues);
  const statuses = requireArray(candidate, "statuses", "$", issues);

  const assetIds = collectUniqueIds(assets, "assets", issues);
  const locationIds = collectUniqueIds(locations, "locations", issues);
  collectUniqueIds(npcs, "npcs", issues);
  collectUniqueIds(characters, "characters", issues);
  const cardIds = collectUniqueIds(cards, "cards", issues);
  const equipmentIds = collectUniqueIds(equipment, "equipment", issues);
  const statusIds = collectUniqueIds(statuses, "statuses", issues);

  if (!isRecord(candidate["theme"])) {
    pushTypeIssue(issues, "theme", candidate["theme"] !== undefined);
  } else {
    const theme = candidate["theme"];
    requireReference(theme["backgroundAssetId"], assetIds, "theme.backgroundAssetId", issues);
    requireReference(theme["closedBookAssetId"], assetIds, "theme.closedBookAssetId", issues);
    requireReference(theme["openPageAssetId"], assetIds, "theme.openPageAssetId", issues);
    if (theme["mapStyleAssetId"] !== undefined && theme["mapStyleAssetId"] !== null) {
      requireReference(theme["mapStyleAssetId"], assetIds, "theme.mapStyleAssetId", issues);
    }
  }

  if (!isRecord(candidate["music"])) pushTypeIssue(issues, "music", candidate["music"] !== undefined);

  locations?.forEach((value, index) => {
    if (!isRecord(value)) return;
    validateStringReferences(value["sceneAssetIds"], assetIds, `locations[${index}].sceneAssetIds`, issues);
  });

  npcs?.forEach((value, index) => {
    if (!isRecord(value)) return;
    requireReference(value["locationId"], locationIds, `npcs[${index}].locationId`, issues);
    if (value["portraitAssetId"] !== undefined && value["portraitAssetId"] !== null) {
      requireReference(value["portraitAssetId"], assetIds, `npcs[${index}].portraitAssetId`, issues);
    }
  });

  const cardMap = validateCards(cards, cardIds, equipmentIds, statusIds, issues);
  validateEquipment(equipment, cardIds, issues);

  statuses?.forEach((value, index) => {
    if (!isRecord(value)) return;
    if (value["grantedCardIds"] !== undefined) {
      validateStringReferences(value["grantedCardIds"], cardIds, `statuses[${index}].grantedCardIds`, issues);
    }
  });

  const equipmentCardsBySource = new Map<string, string[]>();
  for (const card of cardMap.values()) {
    if (card.kind !== "equipment" || !card.sourceId) continue;
    const existing = equipmentCardsBySource.get(card.sourceId) ?? [];
    existing.push(card.id);
    equipmentCardsBySource.set(card.sourceId, existing);
  }

  validateCharacterEquipmentOwnership(
    characters,
    cardIds,
    equipmentIds,
    equipmentCardsBySource,
    assetIds,
    issues
  );

  if (!isRecord(candidate["map"])) {
    pushTypeIssue(issues, "map", candidate["map"] !== undefined);
  } else {
    const map = candidate["map"];
    const nodes = Array.isArray(map["nodes"]) ? map["nodes"] : null;
    const edges = Array.isArray(map["edges"]) ? map["edges"] : null;
    if (!nodes) issues.push({ code: "invalid-field-type", path: "map.nodes" });
    if (!edges) issues.push({ code: "invalid-field-type", path: "map.edges" });
    const nodeIds = collectUniqueIds(nodes, "map.nodes", issues);
    nodes?.forEach((value, index) => {
      if (!isRecord(value)) return;
      requireReference(value["locationId"], locationIds, `map.nodes[${index}].locationId`, issues);
    });
    edges?.forEach((value, index) => {
      if (!isRecord(value)) return;
      const from = value["fromNodeId"];
      const to = value["toNodeId"];
      if (!isNonEmptyString(from) || !nodeIds.has(from)) {
        issues.push({ code: "invalid-map-edge", path: `map.edges[${index}].fromNodeId`, value: String(from) });
      }
      if (!isNonEmptyString(to) || !nodeIds.has(to)) {
        issues.push({ code: "invalid-map-edge", path: `map.edges[${index}].toNodeId`, value: String(to) });
      }
      if (value["travelCardIds"] !== undefined) {
        validateStringReferences(value["travelCardIds"], cardIds, `map.edges[${index}].travelCardIds`, issues);
      }
    });
  }

  if (!isRecord(candidate["finale"])) {
    pushTypeIssue(issues, "finale", candidate["finale"] !== undefined);
  } else {
    const finale = candidate["finale"];
    if (!isNonEmptyString(finale["finaleLocationId"]) || !locationIds.has(finale["finaleLocationId"])) {
      issues.push({
        code: "invalid-finale-reference",
        path: "finale.finaleLocationId",
        value: String(finale["finaleLocationId"]),
      });
    }
    if (finale["finalChoiceCardIds"] !== undefined) {
      validateStringReferences(finale["finalChoiceCardIds"], cardIds, "finale.finalChoiceCardIds", issues);
    }
    if (!isStringArray(finale["requiredKnotIds"])) {
      issues.push({ code: "invalid-field-type", path: "finale.requiredKnotIds" });
    }
    if (!isNonEmptyString(finale["successConditionId"])) {
      issues.push({ code: "missing-required-field", path: "finale.successConditionId" });
    }
    if (!isStringArray(finale["epilogueConditionIds"])) {
      issues.push({ code: "invalid-field-type", path: "finale.epilogueConditionIds" });
    }
  }

  if (!isStringArray(candidate["hiddenKnotIds"])) {
    pushTypeIssue(issues, "hiddenKnotIds", candidate["hiddenKnotIds"] !== undefined);
  }

  if (issues.length > 0) return { valid: false, package: null, issues };
  return { valid: true, package: candidate as unknown as FateKnotsUniversePackage, issues: [] };
}

function uniqueTrimmed(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeCard(card: FateKnotsCardDefinition): FateKnotsCardDefinition {
  const normalized = {
    ...card,
    id: card.id.trim(),
    name: card.name.trim(),
    tags: uniqueTrimmed(card.tags),
    effects: card.effects.map((effect: FateKnotsCardEffect) => {
      const next = { ...effect } as FateKnotsCardEffect;
      if (effect.tags) next.tags = uniqueTrimmed(effect.tags);
      if (effect.moveTo) next.moveTo = { ...effect.moveTo };
      return next;
    }),
    presentation: card.presentation.map((cue) => ({ ...cue })),
  } as FateKnotsCardDefinition;

  if (card.requirements) {
    normalized.requirements = card.requirements.map((requirement) => {
      const next = { ...requirement };
      if (requirement.phases) next.phases = requirement.phases.slice();
      if (requirement.rows) next.rows = requirement.rows.slice();
      if (requirement.ranges) next.ranges = requirement.ranges.slice();
      if (requirement.requiredCardTags) next.requiredCardTags = uniqueTrimmed(requirement.requiredCardTags);
      if (requirement.requiredEquipmentTags) {
        next.requiredEquipmentTags = uniqueTrimmed(requirement.requiredEquipmentTags);
      }
      if (requirement.forbiddenStatusIds) next.forbiddenStatusIds = uniqueTrimmed(requirement.forbiddenStatusIds);
      if (requirement.targetRows) next.targetRows = requirement.targetRows.slice();
      if (requirement.targetRanges) next.targetRanges = requirement.targetRanges.slice();
      return next;
    });
  }

  return normalized;
}

/**
 * Deterministic canonicalization after validation. This intentionally performs
 * only lossless cleanup (trim/deduplicate/copy) and never invents story content,
 * rule values, missing references or fallback assets.
 */
export function normalizeFateKnotsUniversePackage(
  candidate: unknown
): FateKnotsUniverseValidationResult {
  const validated = validateFateKnotsUniversePackage(candidate);
  if (!validated.valid || !validated.package) return validated;
  const source = validated.package;

  const normalized = {
    ...source,
    universeId: source.universeId.trim(),
    title: source.title.trim(),
    premise: source.premise.trim(),
    assets: source.assets.map((asset) => {
      const next = { ...asset, id: asset.id.trim(), path: asset.path.trim() };
      if (asset.tags) next.tags = uniqueTrimmed(asset.tags);
      return next;
    }),
    locations: source.locations.map((location) => ({
      ...location,
      id: location.id.trim(),
      name: location.name.trim(),
      sceneAssetIds: uniqueTrimmed(location.sceneAssetIds),
      tags: uniqueTrimmed(location.tags),
    })),
    map: {
      ...source.map,
      nodes: source.map.nodes.map((node) => {
        const next = { ...node };
        if (node.mapPosition) next.mapPosition = { ...node.mapPosition };
        return next;
      }),
      edges: source.map.edges.map((edge) => {
        const next = { ...edge };
        if (edge.travelCardIds) next.travelCardIds = uniqueTrimmed(edge.travelCardIds);
        if (edge.tags) next.tags = uniqueTrimmed(edge.tags);
        return next;
      }),
    },
    npcs: source.npcs.map((npc) => ({ ...npc, roleTags: uniqueTrimmed(npc.roleTags) })),
    characters: source.characters.map((character) => {
      const next = {
        ...character,
        tags: uniqueTrimmed(character.tags),
        baseStats: { ...character.baseStats },
        startingCardIds: character.startingCardIds.slice(),
        startingEquipmentIds: uniqueTrimmed(character.startingEquipmentIds),
      };
      if (character.combatController) next.combatController = { ...character.combatController };
      return next;
    }),
    cards: source.cards.map(normalizeCard),
    equipment: source.equipment.map((definition) => {
      const next = {
        ...definition,
        tags: uniqueTrimmed(definition.tags),
        grantedCardIds: uniqueTrimmed(definition.grantedCardIds),
      };
      if (definition.removedCardIds) next.removedCardIds = uniqueTrimmed(definition.removedCardIds);
      return next;
    }),
    statuses: source.statuses.map((status) => {
      const next = { ...status, tags: uniqueTrimmed(status.tags) };
      if (status.modifiers) next.modifiers = status.modifiers.map((modifier) => ({ ...modifier }));
      if (status.grantedCardIds) next.grantedCardIds = uniqueTrimmed(status.grantedCardIds);
      if (status.blockedCardTags) next.blockedCardTags = uniqueTrimmed(status.blockedCardTags);
      if (status.presentation) next.presentation = status.presentation.map((cue) => ({ ...cue }));
      return next;
    }),
    hiddenKnotIds: uniqueTrimmed(source.hiddenKnotIds),
    finale: { ...source.finale, requiredKnotIds: uniqueTrimmed(source.finale.requiredKnotIds), epilogueConditionIds: uniqueTrimmed(source.finale.epilogueConditionIds) },
    theme: { ...source.theme, cardFrameByKind: { ...source.theme.cardFrameByKind }, visualTags: uniqueTrimmed(source.theme.visualTags) },
    music: { ...source.music, instrumentTags: uniqueTrimmed(source.music.instrumentTags), moodTags: uniqueTrimmed(source.music.moodTags), stateCueIds: { ...source.music.stateCueIds } },
  } as FateKnotsUniversePackage;

  if (source.finale.requiredItemIds) {
    normalized.finale.requiredItemIds = uniqueTrimmed(source.finale.requiredItemIds);
  }
  if (source.finale.finalChoiceCardIds) {
    normalized.finale.finalChoiceCardIds = uniqueTrimmed(source.finale.finalChoiceCardIds);
  }
  if (source.theme.bookmarkAssetIds) {
    normalized.theme.bookmarkAssetIds = uniqueTrimmed(source.theme.bookmarkAssetIds);
  }
  if (source.theme.transitionAssetIds) {
    normalized.theme.transitionAssetIds = uniqueTrimmed(source.theme.transitionAssetIds);
  }

  return { valid: true, package: normalized, issues: [] };
}
