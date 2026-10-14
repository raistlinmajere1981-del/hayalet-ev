import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCardEffect,
  FateKnotsPosition,
  FateKnotsStatId,
  FateKnotsTeamId,
} from "./contracts.js";

/**
 * Mechanical target selection is deliberately separate from presentation
 * `applyTo`. A card may mechanically affect one actor while its visual cue is
 * rendered on a card, page overlay, battlefield or several avatars.
 */
export type FateKnotsMechanicalEffectTarget =
  "self" | "primaryTarget" | "secondaryTarget" | "allAllies" | "allEnemies" | "ownTeam" | "run";

export interface FateKnotsExecutableCardEffect extends FateKnotsCardEffect {
  target: FateKnotsMechanicalEffectTarget;
}

export type FateKnotsExecutableCardDefinition = Omit<FateKnotsCardDefinition, "effects"> & {
  effects: FateKnotsExecutableCardEffect[];
};

export type FateKnotsEffectResolutionIssueCode =
  | "missing-primary-target"
  | "missing-secondary-target"
  | "target-not-found"
  | "no-targets-resolved"
  | "actor-target-required"
  | "run-target-required"
  | "team-target-required"
  | "missing-positive-value"
  | "missing-finite-value"
  | "missing-stat-id"
  | "invalid-resource-stat"
  | "missing-status-id"
  | "missing-card-id"
  | "missing-move-patch"
  | "missing-reveal-id";

export interface FateKnotsEffectResolutionIssue {
  code: FateKnotsEffectResolutionIssueCode;
  effectId: string;
  value?: string;
}

/**
 * Ordered mechanical instructions produced by card resolution.
 *
 * These patches do not mutate canonical state. The combat/run state machine
 * applies them in order, which keeps HP clamping, falling, shield lifetime,
 * status duration and other phase rules in one authority layer.
 */
export type FateKnotsMechanicalPatch =
  | { kind: "damage"; effectId: string; actorId: string; amount: number }
  | { kind: "heal"; effectId: string; actorId: string; amount: number }
  | { kind: "shield"; effectId: string; actorId: string; amount: number }
  | {
      kind: "status-add";
      effectId: string;
      actorId: string;
      statusId: string;
      durationTurns?: number;
    }
  | { kind: "status-remove"; effectId: string; actorId: string; statusId: string }
  | {
      kind: "position";
      effectId: string;
      actorId: string;
      moveTo: Partial<FateKnotsPosition>;
    }
  | {
      kind: "stat";
      effectId: string;
      actorId: string;
      statId: FateKnotsStatId;
      delta: number;
    }
  | {
      kind: "resource";
      effectId: string;
      actorId: string;
      statId: "energy";
      delta: number;
    }
  | { kind: "card-grant"; effectId: string; actorId: string; cardId: string }
  | { kind: "card-revoke"; effectId: string; actorId: string; cardId: string }
  | { kind: "card-consume"; effectId: string; actorId: string; cardId: string }
  | { kind: "run-reveal"; effectId: string; revealId: string }
  | { kind: "retreat-request"; effectId: string; teamId: FateKnotsTeamId };

export interface FateKnotsMechanicalResolvedEffect {
  effectId: string;
  cardId: string;
  actorId: string;
  targetIds: string[];
  kind: FateKnotsCardEffect["kind"];
  value?: number;
  statId?: FateKnotsStatId;
  statusId?: string;
  cardRefId?: string;
  revealId?: string;
}

export interface FateKnotsEffectResolutionContext {
  card: FateKnotsExecutableCardDefinition;
  actor: FateKnotsActorState;
  actors: readonly FateKnotsActorState[];
  primaryTargetId?: string | null;
  secondaryTargetId?: string | null;
}

export interface FateKnotsEffectResolutionResult {
  resolved: boolean;
  issues: FateKnotsEffectResolutionIssue[];
  effects: FateKnotsMechanicalResolvedEffect[];
  patches: FateKnotsMechanicalPatch[];
}

interface PreparedEffect {
  effect: FateKnotsExecutableCardEffect;
  targetIds: string[];
  teamId?: FateKnotsTeamId;
}

const ACTOR_EFFECT_KINDS = new Set<FateKnotsCardEffect["kind"]>([
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
]);

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function findActor(
  context: FateKnotsEffectResolutionContext,
  actorId: string
): FateKnotsActorState | null {
  if (context.actor.actorId === actorId) return context.actor;
  return context.actors.find((candidate) => candidate.actorId === actorId) ?? null;
}

function resolveTargetIds(
  effect: FateKnotsExecutableCardEffect,
  context: FateKnotsEffectResolutionContext,
  issues: FateKnotsEffectResolutionIssue[]
): string[] {
  switch (effect.target) {
    case "self":
      return [context.actor.actorId];
    case "primaryTarget": {
      if (!context.primaryTargetId) {
        issues.push({ code: "missing-primary-target", effectId: effect.id });
        return [];
      }
      if (!findActor(context, context.primaryTargetId)) {
        issues.push({
          code: "target-not-found",
          effectId: effect.id,
          value: context.primaryTargetId,
        });
        return [];
      }
      return [context.primaryTargetId];
    }
    case "secondaryTarget": {
      if (!context.secondaryTargetId) {
        issues.push({ code: "missing-secondary-target", effectId: effect.id });
        return [];
      }
      if (!findActor(context, context.secondaryTargetId)) {
        issues.push({
          code: "target-not-found",
          effectId: effect.id,
          value: context.secondaryTargetId,
        });
        return [];
      }
      return [context.secondaryTargetId];
    }
    case "allAllies":
      return context.actors
        .filter((candidate) => candidate.teamId === context.actor.teamId)
        .map((candidate) => candidate.actorId);
    case "allEnemies":
      return context.actors
        .filter((candidate) => candidate.teamId !== context.actor.teamId)
        .map((candidate) => candidate.actorId);
    case "ownTeam":
    case "run":
      return [];
  }
}

function validateEffectFields(
  effect: FateKnotsExecutableCardEffect,
  issues: FateKnotsEffectResolutionIssue[]
): void {
  if (
    (effect.kind === "damage" || effect.kind === "heal" || effect.kind === "shield") &&
    !isPositiveFinite(effect.value)
  ) {
    issues.push({ code: "missing-positive-value", effectId: effect.id });
  }

  if (
    (effect.kind === "modify-stat" || effect.kind === "modify-resource") &&
    !isFiniteNumber(effect.value)
  ) {
    issues.push({ code: "missing-finite-value", effectId: effect.id });
  }

  if ((effect.kind === "modify-stat" || effect.kind === "modify-resource") && !effect.statId) {
    issues.push({ code: "missing-stat-id", effectId: effect.id });
  }

  if (effect.kind === "modify-resource" && effect.statId && effect.statId !== "energy") {
    issues.push({ code: "invalid-resource-stat", effectId: effect.id, value: effect.statId });
  }

  if ((effect.kind === "apply-status" || effect.kind === "remove-status") && !effect.statusId) {
    issues.push({ code: "missing-status-id", effectId: effect.id });
  }

  if ((effect.kind === "grant-card" || effect.kind === "revoke-card") && !effect.cardId) {
    issues.push({ code: "missing-card-id", effectId: effect.id });
  }

  if (effect.kind === "move" && !effect.moveTo) {
    issues.push({ code: "missing-move-patch", effectId: effect.id });
  }

  if (effect.kind === "reveal" && !effect.revealId) {
    issues.push({ code: "missing-reveal-id", effectId: effect.id });
  }
}

function prepareEffect(
  effect: FateKnotsExecutableCardEffect,
  context: FateKnotsEffectResolutionContext,
  issues: FateKnotsEffectResolutionIssue[]
): PreparedEffect {
  validateEffectFields(effect, issues);
  const targetIds = resolveTargetIds(effect, context, issues);

  if (ACTOR_EFFECT_KINDS.has(effect.kind)) {
    if (effect.target === "run" || effect.target === "ownTeam") {
      issues.push({ code: "actor-target-required", effectId: effect.id, value: effect.target });
    } else if (targetIds.length === 0) {
      issues.push({ code: "no-targets-resolved", effectId: effect.id });
    }
  }

  if (effect.kind === "reveal" && effect.target !== "run") {
    issues.push({ code: "run-target-required", effectId: effect.id, value: effect.target });
  }

  if (effect.kind === "retreat" && effect.target !== "ownTeam") {
    issues.push({ code: "team-target-required", effectId: effect.id, value: effect.target });
  }

  if (effect.target === "ownTeam") {
    return { effect, targetIds, teamId: context.actor.teamId };
  }
  return { effect, targetIds };
}

function buildResolvedEffect(
  context: FateKnotsEffectResolutionContext,
  prepared: PreparedEffect
): FateKnotsMechanicalResolvedEffect {
  const resolved: FateKnotsMechanicalResolvedEffect = {
    effectId: prepared.effect.id,
    cardId: context.card.id,
    actorId: context.actor.actorId,
    targetIds: prepared.targetIds.slice(),
    kind: prepared.effect.kind,
  };
  if (prepared.effect.value !== undefined) resolved.value = prepared.effect.value;
  if (prepared.effect.statId !== undefined) resolved.statId = prepared.effect.statId;
  if (prepared.effect.statusId !== undefined) resolved.statusId = prepared.effect.statusId;
  if (prepared.effect.cardId !== undefined) resolved.cardRefId = prepared.effect.cardId;
  if (prepared.effect.revealId !== undefined) resolved.revealId = prepared.effect.revealId;
  return resolved;
}

function buildActorPatches(
  context: FateKnotsEffectResolutionContext,
  prepared: PreparedEffect
): FateKnotsMechanicalPatch[] {
  const effect = prepared.effect;
  const patches: FateKnotsMechanicalPatch[] = [];

  for (const actorId of prepared.targetIds) {
    switch (effect.kind) {
      case "damage":
        patches.push({
          kind: "damage",
          effectId: effect.id,
          actorId,
          amount: effect.value as number,
        });
        break;
      case "heal":
        patches.push({
          kind: "heal",
          effectId: effect.id,
          actorId,
          amount: effect.value as number,
        });
        break;
      case "shield":
        patches.push({
          kind: "shield",
          effectId: effect.id,
          actorId,
          amount: effect.value as number,
        });
        break;
      case "apply-status": {
        const patch: Extract<FateKnotsMechanicalPatch, { kind: "status-add" }> = {
          kind: "status-add",
          effectId: effect.id,
          actorId,
          statusId: effect.statusId as string,
        };
        if (effect.durationTurns !== undefined) patch.durationTurns = effect.durationTurns;
        patches.push(patch);
        break;
      }
      case "remove-status":
        patches.push({
          kind: "status-remove",
          effectId: effect.id,
          actorId,
          statusId: effect.statusId as string,
        });
        break;
      case "move":
        patches.push({
          kind: "position",
          effectId: effect.id,
          actorId,
          moveTo: { ...(effect.moveTo as Partial<FateKnotsPosition>) },
        });
        break;
      case "modify-stat":
        patches.push({
          kind: "stat",
          effectId: effect.id,
          actorId,
          statId: effect.statId as FateKnotsStatId,
          delta: effect.value as number,
        });
        break;
      case "modify-resource":
        patches.push({
          kind: "resource",
          effectId: effect.id,
          actorId,
          statId: "energy",
          delta: effect.value as number,
        });
        break;
      case "grant-card":
        patches.push({
          kind: "card-grant",
          effectId: effect.id,
          actorId,
          cardId: effect.cardId as string,
        });
        break;
      case "revoke-card":
        patches.push({
          kind: "card-revoke",
          effectId: effect.id,
          actorId,
          cardId: effect.cardId as string,
        });
        break;
      case "consume":
        patches.push({
          kind: "card-consume",
          effectId: effect.id,
          actorId,
          cardId: effect.cardId ?? context.card.id,
        });
        break;
      case "reveal":
      case "retreat":
        break;
    }
  }

  return patches;
}

/**
 * Converts a legal card into an atomic, ordered mechanical resolution plan.
 *
 * Preconditions:
 * - card/target legality has already been checked
 * - executable effects have explicit mechanical targets
 *
 * This function never mutates actors/run state and never selects presentation
 * cues. Those responsibilities remain with the state machine and presentation
 * layer respectively.
 */
export function resolveFateKnotsCardEffects(
  context: FateKnotsEffectResolutionContext
): FateKnotsEffectResolutionResult {
  const issues: FateKnotsEffectResolutionIssue[] = [];
  const prepared = context.card.effects.map((effect) => prepareEffect(effect, context, issues));

  if (issues.length > 0) {
    return { resolved: false, issues, effects: [], patches: [] };
  }

  const patches: FateKnotsMechanicalPatch[] = [];
  const effects: FateKnotsMechanicalResolvedEffect[] = [];

  for (const preparedEffect of prepared) {
    effects.push(buildResolvedEffect(context, preparedEffect));

    if (ACTOR_EFFECT_KINDS.has(preparedEffect.effect.kind)) {
      patches.push(...buildActorPatches(context, preparedEffect));
      continue;
    }

    if (preparedEffect.effect.kind === "reveal") {
      patches.push({
        kind: "run-reveal",
        effectId: preparedEffect.effect.id,
        revealId: preparedEffect.effect.revealId as string,
      });
      continue;
    }

    if (preparedEffect.effect.kind === "retreat") {
      patches.push({
        kind: "retreat-request",
        effectId: preparedEffect.effect.id,
        teamId: preparedEffect.teamId as FateKnotsTeamId,
      });
    }
  }

  return { resolved: true, issues: [], effects, patches };
}
