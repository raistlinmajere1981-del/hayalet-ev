import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCardRequirement,
  FateKnotsEquipmentDefinition,
  FateKnotsPhase,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import {
  matchesFateKnotsActorPositionRequirement,
  matchesFateKnotsTargetPositionRequirement,
} from "./position.js";

export type FateKnotsCardLegalityIssueCode =
  | "card-not-available"
  | "actor-fallen"
  | "phase-not-allowed"
  | "actor-position-not-allowed"
  | "missing-required-card-tag"
  | "missing-required-equipment-tag"
  | "forbidden-status-active"
  | "standing-actor-required"
  | "target-required"
  | "secondary-target-unsupported"
  | "target-team-not-allowed"
  | "target-position-not-allowed"
  | "target-life-state-not-allowed";

export interface FateKnotsCardLegalityIssue {
  code: FateKnotsCardLegalityIssueCode;
  requirementIndex?: number;
  value?: string;
}

export interface FateKnotsCardLegalityResult {
  legal: boolean;
  issues: FateKnotsCardLegalityIssue[];
}

export interface FateKnotsCardCatalog {
  cards: readonly FateKnotsCardDefinition[];
  equipment: readonly FateKnotsEquipmentDefinition[];
  statuses: readonly FateKnotsStatusDefinition[];
}

export interface FateKnotsCardLegalityContext extends FateKnotsCardCatalog {
  phase: FateKnotsPhase;
  actor: FateKnotsActorState;
  /** Primary target alias retained for existing callers. */
  target?: FateKnotsActorState | null;
  primaryTarget?: FateKnotsActorState | null;
}

function uniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

function activeStatusIds(actor: FateKnotsActorState): string[] {
  return uniqueIds([...actor.statusIds, ...actor.injuryIds]);
}

function findEquipment(
  actor: FateKnotsActorState,
  catalog: readonly FateKnotsEquipmentDefinition[]
): FateKnotsEquipmentDefinition[] {
  const equippedIds = new Set(actor.equipmentIds);
  return catalog.filter((definition) => equippedIds.has(definition.id));
}

function findStatuses(
  actor: FateKnotsActorState,
  catalog: readonly FateKnotsStatusDefinition[]
): FateKnotsStatusDefinition[] {
  const ids = new Set(activeStatusIds(actor));
  return catalog.filter((definition) => ids.has(definition.id));
}

/**
 * Rebuilds the mechanically available card set from canonical actor ownership.
 *
 * Order of application is intentionally stable:
 * 1. owned cards
 * 2. equipment grants
 * 3. status/injury grants
 * 4. equipment removals
 * 5. status/injury blocked tags
 *
 * Phase, position and target legality are evaluated separately. This function
 * answers only which cards the actor currently possesses/can access.
 */
export function buildFateKnotsAvailableCardIds(
  actor: FateKnotsActorState,
  catalog: FateKnotsCardCatalog
): string[] {
  const available = new Set(actor.ownedCardIds);
  const equipment = findEquipment(actor, catalog.equipment);
  const statuses = findStatuses(actor, catalog.statuses);

  for (const definition of equipment) {
    for (const cardId of definition.grantedCardIds) available.add(cardId);
  }

  for (const definition of statuses) {
    for (const cardId of definition.grantedCardIds ?? []) available.add(cardId);
  }

  for (const definition of equipment) {
    for (const cardId of definition.removedCardIds ?? []) available.delete(cardId);
  }

  const blockedTags = new Set(statuses.flatMap((definition) => definition.blockedCardTags ?? []));
  const cardById = new Map(catalog.cards.map((card) => [card.id, card] as const));

  return Array.from(available).filter((cardId) => {
    const card = cardById.get(cardId);
    if (!card) return false;
    return card.tags.every((tag) => !blockedTags.has(tag));
  });
}

function hasEveryRequiredEquipmentTag(
  actor: FateKnotsActorState,
  requiredTags: readonly string[],
  equipmentCatalog: readonly FateKnotsEquipmentDefinition[]
): string | null {
  const equipped = findEquipment(actor, equipmentCatalog);
  for (const requiredTag of requiredTags) {
    if (!equipped.some((definition) => definition.tags.includes(requiredTag))) return requiredTag;
  }
  return null;
}

function hasEveryRequiredCardTag(
  availableCardIds: readonly string[],
  requiredTags: readonly string[],
  cardCatalog: readonly FateKnotsCardDefinition[]
): string | null {
  const available = new Set(availableCardIds);
  const definitions = cardCatalog.filter((card) => available.has(card.id));
  for (const requiredTag of requiredTags) {
    if (!definitions.some((card) => card.tags.includes(requiredTag))) return requiredTag;
  }
  return null;
}

function requirementNeedsTarget(requirement: FateKnotsCardRequirement): boolean {
  return (
    requirement.targetTeam !== undefined ||
    requirement.targetRows !== undefined ||
    requirement.targetRanges !== undefined ||
    requirement.targetLifeState !== undefined
  );
}

function evaluateRequirement(
  requirement: FateKnotsCardRequirement,
  requirementIndex: number,
  context: FateKnotsCardLegalityContext,
  availableCardIds: readonly string[],
  target: FateKnotsActorState | null
): FateKnotsCardLegalityIssue[] {
  const issues: FateKnotsCardLegalityIssue[] = [];

  if (requirement.phases && !requirement.phases.includes(context.phase)) {
    issues.push({ code: "phase-not-allowed", requirementIndex });
  }

  if (!matchesFateKnotsActorPositionRequirement(context.actor.position, requirement)) {
    issues.push({ code: "actor-position-not-allowed", requirementIndex });
  }

  if (requirement.actorMustBeStanding === true && context.actor.fallen) {
    issues.push({ code: "standing-actor-required", requirementIndex });
  }

  const missingCardTag = hasEveryRequiredCardTag(
    availableCardIds,
    requirement.requiredCardTags ?? [],
    context.cards
  );
  if (missingCardTag) {
    issues.push({
      code: "missing-required-card-tag",
      requirementIndex,
      value: missingCardTag,
    });
  }

  const missingEquipmentTag = hasEveryRequiredEquipmentTag(
    context.actor,
    requirement.requiredEquipmentTags ?? [],
    context.equipment
  );
  if (missingEquipmentTag) {
    issues.push({
      code: "missing-required-equipment-tag",
      requirementIndex,
      value: missingEquipmentTag,
    });
  }

  const actorStatuses = new Set(activeStatusIds(context.actor));
  for (const statusId of requirement.forbiddenStatusIds ?? []) {
    if (actorStatuses.has(statusId)) {
      issues.push({ code: "forbidden-status-active", requirementIndex, value: statusId });
    }
  }

  if (requirementNeedsTarget(requirement) && !target) {
    issues.push({ code: "target-required", requirementIndex, value: "primaryTarget" });
    return issues;
  }

  if (!target) return issues;

  if (requirement.targetTeam === "self" && target.actorId !== context.actor.actorId) {
    issues.push({ code: "target-team-not-allowed", requirementIndex, value: "self" });
  } else if (
    requirement.targetTeam !== undefined &&
    requirement.targetTeam !== "self" &&
    requirement.targetTeam !== "any" &&
    target.teamId !== requirement.targetTeam
  ) {
    issues.push({
      code: "target-team-not-allowed",
      requirementIndex,
      value: requirement.targetTeam,
    });
  }

  if (!matchesFateKnotsTargetPositionRequirement(target.position, requirement)) {
    issues.push({ code: "target-position-not-allowed", requirementIndex });
  }

  if (requirement.targetLifeState === "standing" && target.fallen) {
    issues.push({ code: "target-life-state-not-allowed", requirementIndex, value: "standing" });
  }
  if (requirement.targetLifeState === "fallen" && !target.fallen) {
    issues.push({ code: "target-life-state-not-allowed", requirementIndex, value: "fallen" });
  }

  return issues;
}

function cardUsesEffectTarget(
  card: FateKnotsCardDefinition,
  target: "primaryTarget" | "secondaryTarget"
): boolean {
  return card.effects.some((effect) => effect.target === target);
}

/**
 * Returns machine-readable legality only. It deliberately contains no
 * player-facing status prose; the universe renderer decides how legal/illegal
 * state is communicated through card state and target affordances.
 *
 * V1 has only one fully-defined target legality grammar. Mechanical effects that
 * reference primaryTarget therefore make that slot mandatory even if the card
 * author omitted an explicit target requirement. secondaryTarget remains
 * reserved until a distinct second-target legality grammar is designed, so V1
 * fails closed instead of guessing how it should be constrained.
 */
export function evaluateFateKnotsCardLegality(
  card: FateKnotsCardDefinition,
  context: FateKnotsCardLegalityContext
): FateKnotsCardLegalityResult {
  const issues: FateKnotsCardLegalityIssue[] = [];
  const availableCardIds = buildFateKnotsAvailableCardIds(context.actor, context);
  const primaryTarget = context.primaryTarget ?? context.target ?? null;

  if (!availableCardIds.includes(card.id)) {
    issues.push({ code: "card-not-available" });
  }

  if (context.actor.fallen) {
    issues.push({ code: "actor-fallen" });
  }

  if (cardUsesEffectTarget(card, "primaryTarget") && !primaryTarget) {
    issues.push({ code: "target-required", value: "primaryTarget" });
  }
  if (cardUsesEffectTarget(card, "secondaryTarget")) {
    issues.push({ code: "secondary-target-unsupported", value: "secondaryTarget" });
  }

  // When authoring omits target constraints, a direct attack is hostile by
  // default. Explicit target-team/life-state requirements remain authoritative.
  // Apply this at the shared legality boundary, not only in the renderer.
  if (
    primaryTarget &&
    card.kind === "attack" &&
    card.effects.some((effect) => effect.kind === "damage" && effect.target === "primaryTarget")
  ) {
    const requirements = card.requirements ?? [];
    if (
      !requirements.some((requirement) => requirement.targetTeam !== undefined) &&
      primaryTarget.teamId === context.actor.teamId
    ) {
      issues.push({ code: "target-team-not-allowed", value: "opposing-team" });
    }
    if (
      !requirements.some((requirement) => requirement.targetLifeState !== undefined) &&
      primaryTarget.fallen
    ) {
      issues.push({ code: "target-life-state-not-allowed", value: "standing" });
    }
  }

  for (const [index, requirement] of (card.requirements ?? []).entries()) {
    issues.push(
      ...evaluateRequirement(requirement, index, context, availableCardIds, primaryTarget)
    );
  }

  return {
    legal: issues.length === 0,
    issues,
  };
}

export function getFateKnotsLegalTargetIds(
  card: FateKnotsCardDefinition,
  context: Omit<FateKnotsCardLegalityContext, "target" | "primaryTarget">,
  candidates: readonly FateKnotsActorState[]
): string[] {
  return candidates
    .filter(
      (target) =>
        evaluateFateKnotsCardLegality(card, {
          ...context,
          primaryTarget: target,
        }).legal
    )
    .map((target) => target.actorId);
}
