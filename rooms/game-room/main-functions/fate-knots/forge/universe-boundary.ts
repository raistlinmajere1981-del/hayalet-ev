import { FATE_KNOTS_PHASES, type FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  normalizeFateKnotsUniversePackage,
  validateFateKnotsUniversePackage,
  type FateKnotsUniverseValidationIssue,
  type FateKnotsUniverseValidationResult,
} from "./universe-validation.js";

const ROWS = new Set(["front", "rear"]);
const RANGES = new Set(["engaged", "near", "far"]);
const TARGET_TEAMS = new Set(["party", "opposition", "self", "any"]);
const TARGET_LIFE_STATES = new Set(["standing", "fallen", "any"]);
const INVENTORY_CARD_KINDS = new Set(["item", "equipment"]);
const EFFECTIVE_V1_MODIFIER_STATS = new Set(["maxHp", "speed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function deepTrimStrings(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(deepTrimStrings);
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) result[key] = deepTrimStrings(entry);
  return result;
}

function issue(
  path: string,
  code: FateKnotsUniverseValidationIssue["code"] = "invalid-field-type"
): FateKnotsUniverseValidationIssue {
  return { code, path };
}

function requireRecord(
  value: unknown,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  issues.push(issue(path));
  return false;
}

function requireArray(
  value: unknown,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): value is unknown[] {
  if (Array.isArray(value)) return true;
  issues.push(issue(path));
  return false;
}

function requireStringArray(
  value: unknown,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): value is string[] {
  if (isStringArray(value)) return true;
  issues.push(issue(path));
  return false;
}

function validateOptionalStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  if (record[key] !== undefined && !isStringArray(record[key]))
    issues.push(issue(`${path}.${key}`));
}

function validateCardRequirements(
  card: Record<string, unknown>,
  path: string,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  const requirements = card["requirements"];
  if (requirements === undefined) return;
  if (!Array.isArray(requirements)) {
    issues.push(issue(`${path}.requirements`));
    return;
  }
  requirements.forEach((value, index) => {
    const reqPath = `${path}.requirements[${index}]`;
    if (!requireRecord(value, reqPath, issues)) return;
    for (const key of [
      "requiredCardTags",
      "requiredEquipmentTags",
      "forbiddenStatusIds",
    ] as const) {
      validateOptionalStringArray(value, key, reqPath, issues);
    }
    if (value["phases"] !== undefined) {
      if (
        !isStringArray(value["phases"]) ||
        value["phases"].some(
          (entry) => !FATE_KNOTS_PHASES.includes(entry as (typeof FATE_KNOTS_PHASES)[number])
        )
      ) {
        issues.push(issue(`${reqPath}.phases`));
      }
    }
    for (const key of ["rows", "targetRows"] as const) {
      if (
        value[key] !== undefined &&
        (!isStringArray(value[key]) || value[key].some((entry) => !ROWS.has(entry)))
      ) {
        issues.push(issue(`${reqPath}.${key}`));
      }
    }
    for (const key of ["ranges", "targetRanges"] as const) {
      if (
        value[key] !== undefined &&
        (!isStringArray(value[key]) || value[key].some((entry) => !RANGES.has(entry)))
      ) {
        issues.push(issue(`${reqPath}.${key}`));
      }
    }
    if (
      value["targetTeam"] !== undefined &&
      (typeof value["targetTeam"] !== "string" || !TARGET_TEAMS.has(value["targetTeam"]))
    ) {
      issues.push(issue(`${reqPath}.targetTeam`));
    }
    if (
      value["targetLifeState"] !== undefined &&
      (typeof value["targetLifeState"] !== "string" ||
        !TARGET_LIFE_STATES.has(value["targetLifeState"]))
    ) {
      issues.push(issue(`${reqPath}.targetLifeState`));
    }
    if (
      value["actorMustBeStanding"] !== undefined &&
      typeof value["actorMustBeStanding"] !== "boolean"
    ) {
      issues.push(issue(`${reqPath}.actorMustBeStanding`));
    }
  });
}

function validateCardShapes(
  candidate: Record<string, unknown>,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  const cards = candidate["cards"];
  if (!Array.isArray(cards)) return;
  cards.forEach((value, index) => {
    const path = `cards[${index}]`;
    if (!requireRecord(value, path, issues)) return;
    validateCardRequirements(value, path, issues);
    const presentation = value["presentation"];
    if (Array.isArray(presentation)) {
      presentation.forEach((cue, cueIndex) => {
        if (!isRecord(cue)) issues.push(issue(`${path}.presentation[${cueIndex}]`));
      });
    }
    const effects = value["effects"];
    if (Array.isArray(effects)) {
      effects.forEach((effect, effectIndex) => {
        const effectPath = `${path}.effects[${effectIndex}]`;
        if (!isRecord(effect)) return;
        if (effect["tags"] !== undefined && !isStringArray(effect["tags"])) {
          issues.push(issue(`${effectPath}.tags`));
        }
        if (effect["target"] === "secondaryTarget") {
          issues.push({
            code: "invalid-effect-target",
            path: `${effectPath}.target`,
            value: "secondaryTarget",
          });
        }
      });
    }
  });
}

function validateNormalizationShapes(
  candidate: Record<string, unknown>,
  issues: FateKnotsUniverseValidationIssue[]
): void {
  const theme = candidate["theme"];
  if (isRecord(theme)) {
    requireStringArray(theme["visualTags"], "theme.visualTags", issues);
    if (!isRecord(theme["cardFrameByKind"])) issues.push(issue("theme.cardFrameByKind"));
    validateOptionalStringArray(theme, "bookmarkAssetIds", "theme", issues);
    validateOptionalStringArray(theme, "transitionAssetIds", "theme", issues);
  }

  const music = candidate["music"];
  if (isRecord(music)) {
    requireStringArray(music["instrumentTags"], "music.instrumentTags", issues);
    requireStringArray(music["moodTags"], "music.moodTags", issues);
    if (!isRecord(music["stateCueIds"])) issues.push(issue("music.stateCueIds"));
  }

  const assets = candidate["assets"];
  if (Array.isArray(assets)) {
    assets.forEach((value, index) => {
      if (!isRecord(value)) return;
      validateOptionalStringArray(value, "tags", `assets[${index}]`, issues);
    });
  }

  const locations = candidate["locations"];
  if (Array.isArray(locations)) {
    locations.forEach((value, index) => {
      if (!isRecord(value)) return;
      requireStringArray(value["sceneAssetIds"], `locations[${index}].sceneAssetIds`, issues);
      requireStringArray(value["tags"], `locations[${index}].tags`, issues);
    });
  }

  const map = candidate["map"];
  if (isRecord(map) && Array.isArray(map["edges"])) {
    map["edges"].forEach((value, index) => {
      if (!isRecord(value)) return;
      validateOptionalStringArray(value, "travelCardIds", `map.edges[${index}]`, issues);
      validateOptionalStringArray(value, "tags", `map.edges[${index}]`, issues);
    });
  }

  const story = candidate["story"];
  if (isRecord(story)) {
    for (const key of ["knots", "transitions", "encounters"] as const) {
      requireArray(story[key], `story.${key}`, issues);
    }
    if (Array.isArray(story["knots"])) {
      story["knots"].forEach((value, index) => {
        if (!isRecord(value)) return;
        requireStringArray(value["visibleFacts"], `story.knots[${index}].visibleFacts`, issues);
        validateOptionalStringArray(value, "tags", `story.knots[${index}]`, issues);
      });
    }
  }

  const npcs = candidate["npcs"];
  if (Array.isArray(npcs)) {
    npcs.forEach((value, index) => {
      if (isRecord(value)) requireStringArray(value["roleTags"], `npcs[${index}].roleTags`, issues);
    });
  }

  const roles = candidate["npcRoles"];
  if (Array.isArray(roles)) {
    roles.forEach((value, index) => {
      if (!isRecord(value)) return;
      for (const key of ["personaFacts", "knownFacts", "relationshipFacts"] as const) {
        requireStringArray(value[key], `npcRoles[${index}].${key}`, issues);
      }
    });
  }

  const characters = candidate["characters"];
  if (Array.isArray(characters)) {
    characters.forEach((value, index) => {
      if (!isRecord(value)) return;
      requireStringArray(value["tags"], `characters[${index}].tags`, issues);
      requireStringArray(value["startingCardIds"], `characters[${index}].startingCardIds`, issues);
      requireStringArray(
        value["startingEquipmentIds"],
        `characters[${index}].startingEquipmentIds`,
        issues
      );
      if (!isRecord(value["baseStats"])) issues.push(issue(`characters[${index}].baseStats`));
    });
  }

  validateCardShapes(candidate, issues);

  const equipment = candidate["equipment"];
  if (Array.isArray(equipment)) {
    equipment.forEach((value, index) => {
      if (!isRecord(value)) return;
      requireStringArray(value["tags"], `equipment[${index}].tags`, issues);
      requireStringArray(value["grantedCardIds"], `equipment[${index}].grantedCardIds`, issues);
      validateOptionalStringArray(value, "removedCardIds", `equipment[${index}]`, issues);
    });
  }

  const statuses = candidate["statuses"];
  if (Array.isArray(statuses)) {
    statuses.forEach((value, index) => {
      if (!isRecord(value)) return;
      requireStringArray(value["tags"], `statuses[${index}].tags`, issues);
      validateOptionalStringArray(value, "grantedCardIds", `statuses[${index}]`, issues);
      validateOptionalStringArray(value, "blockedCardTags", `statuses[${index}]`, issues);
      if (
        value["modifiers"] !== undefined &&
        (!Array.isArray(value["modifiers"]) || value["modifiers"].some((entry) => !isRecord(entry)))
      ) {
        issues.push(issue(`statuses[${index}].modifiers`));
      }
      if (
        value["presentation"] !== undefined &&
        (!Array.isArray(value["presentation"]) ||
          value["presentation"].some((entry) => !isRecord(entry)))
      ) {
        issues.push(issue(`statuses[${index}].presentation`));
      }
    });
  }

  requireStringArray(candidate["hiddenKnotIds"], "hiddenKnotIds", issues);
  const finale = candidate["finale"];
  if (isRecord(finale)) {
    requireStringArray(finale["requiredKnotIds"], "finale.requiredKnotIds", issues);
    requireStringArray(finale["epilogueConditionIds"], "finale.epilogueConditionIds", issues);
    validateOptionalStringArray(finale, "requiredItemIds", "finale", issues);
    validateOptionalStringArray(finale, "finalChoiceCardIds", "finale", issues);
  }
}

function validateRuntimeMechanics(
  universe: FateKnotsUniversePackage
): FateKnotsUniverseValidationIssue[] {
  const issues: FateKnotsUniverseValidationIssue[] = [];
  const cardById = new Map(universe.cards.map((card) => [card.id, card] as const));
  const knotIds = new Set(universe.story.knots.map((knot) => knot.id));

  universe.story.encounters.forEach((encounter, encounterIndex) => {
    (encounter.lootCardIds ?? []).forEach((cardId, lootIndex) => {
      const card = cardById.get(cardId);
      if (card && !INVENTORY_CARD_KINDS.has(card.kind)) {
        issues.push({
          code: "invalid-story-encounter",
          path: `story.encounters[${encounterIndex}].lootCardIds[${lootIndex}]`,
          value: cardId,
        });
      }
    });
  });

  universe.cards.forEach((card, cardIndex) => {
    card.effects.forEach((effect, effectIndex) => {
      const path = `cards[${cardIndex}].effects[${effectIndex}]`;
      if (effect.kind === "reveal" && (!effect.revealId || !knotIds.has(effect.revealId))) {
        issues.push({
          code: "invalid-effect-shape",
          path: `${path}.revealId`,
          value: effect.revealId ?? "",
        });
      }
      if (
        effect.kind === "modify-stat" &&
        (!effect.statId || !EFFECTIVE_V1_MODIFIER_STATS.has(effect.statId))
      ) {
        issues.push({
          code: "invalid-effect-shape",
          path: `${path}.statId`,
          value: effect.statId ?? "",
        });
      }
    });
  });

  universe.statuses.forEach((status, statusIndex) => {
    if ((status.modifiers ?? []).length > 0) {
      issues.push({ code: "invalid-field-type", path: `statuses[${statusIndex}].modifiers` });
    }
  });

  return issues;
}

/**
 * The only unknown -> canonical Universe Package boundary used by Forge and
 * persistence. String values are normalized before identity/reference checks,
 * nested shapes required by canonicalization are verified before typed code is
 * allowed to touch them, and the normalized package is validated again.
 */
export function parseFateKnotsUniversePackage(
  candidate: unknown
): FateKnotsUniverseValidationResult {
  const trimmed = deepTrimStrings(candidate);
  if (!isRecord(trimmed)) return validateFateKnotsUniversePackage(trimmed);

  const preflightIssues: FateKnotsUniverseValidationIssue[] = [];
  validateNormalizationShapes(trimmed, preflightIssues);
  if (preflightIssues.length > 0) {
    return { valid: false, package: null, issues: preflightIssues };
  }

  try {
    const normalized = normalizeFateKnotsUniversePackage(trimmed);
    if (!normalized.valid || !normalized.package) return normalized;

    const runtimeIssues = validateRuntimeMechanics(normalized.package);
    if (runtimeIssues.length > 0) return { valid: false, package: null, issues: runtimeIssues };

    const revalidated = validateFateKnotsUniversePackage(normalized.package);
    if (!revalidated.valid || !revalidated.package) return revalidated;
    return { valid: true, package: structuredClone(normalized.package), issues: [] };
  } catch {
    return { valid: false, package: null, issues: [issue("$")] };
  }
}
