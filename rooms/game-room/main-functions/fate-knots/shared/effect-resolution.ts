import type {
  FateKnotsActorState,
  FateKnotsCardDefinition,
  FateKnotsCardEffect,
  FateKnotsPosition,
  FateKnotsStatId,
  FateKnotsTeamId,
} from "./contracts.js";
import { applyFateKnotsPositionPatch } from "./position.js";

/**
 * Mechanical targeting is intentionally separate from presentation `applyTo`.
 * A renderer may show an effect on a different visual surface than the state
 * object that receives the mechanical effect.
 */
export type FateKnotsMechanicalEffectTarget =
  | "self"
  | "primaryTarget"
  | "secondaryTarget"
  | "allAllies"
  | "allEnemies"
  | "ownTeam"
  | "run";

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

export type FateKnotsMechanicalPatch =
  | {
      kind: "hp";
      effectId: string;
      actorId: string;
      delta: number;
      nextHp: number;
      nextFallen: boolean;
    }
  | {
      kind: "shield";
      effectId: string;
      actorId: string;
      delta: number;
    }
  | {
      kind: "status-add";
      effectId: string;
      actorId: string;
      statusId: string;
      durationTurns?: number;
    }
  | {
      kind: "status-remove";
      effectId: string;
      actorId: string;
      statusId: string;
    }
  | {
      kind: "position";
      effectId: string;
      actorId: string;
      nextPosition: FateKnotsPosition;
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
  | {
      kind: "card-grant";
      effectId: string;
      actorId: string;
      cardId: string;
    }
  | {
      kind: "card-revoke";
      effectId: string;
      actorId: string;
      cardId: string;
    }
  | {
      kind: "card-consume";
      effectId: string;
      actorId: string;
      cardId: string;
    }
  | {
      kind: "run-reveal";
      effectId: string;
      revealId: string;
    }
  | {
      kind: "retreat-request";
      effectId: string;
      teamId: FateKnotsTeamId;
    };

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
  resultingHp?: number;
  resultingPosition?: FateKnotsPosition;
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

interface WorkingActorState {
  source: FateKnotsActorState;
  hp: number;
  fallen: boolean;
  position: FateKnotsPosition;
  statusIds: Set<string>;
  ownedCardIds: Set<string>;
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

function clonePosition(position: FateKnotsPosition): FateKnotsPosition {
  return { row: position.row, range: position.range };
}

function createWorkingActor(actor: FateKnotsActorState): WorkingActorState {
  return {
    source: actor,
    hp: actor.hp,
    fallen: actor.fallen,
    position: clonePosition(actor.position),
    statusIds: new Set([...actor.statusIds, ...actor.injuryIds]),
    ownedCardIds: new Set(actor.ownedCardIds),
  };
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getActorTargetIds(
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
      if (!context.actors.some((candidate) => candidate.actorId === context.primaryTargetId)) {
        issues.push({ code: "target-not-found", effectId: effect.id, value: context.primaryTargetId });
        return [];
      }
      return [context.primaryTargetId];
    }
    case "secondaryTarget": {
      if (!context.secondaryTargetId) {
        issues.push({ code: "missing-secondary-target", effectId: effect.id });
        return [];
      }
      if (!context.actors.some((candidate) => candidate.actorId === context.secondaryTargetId)) {
        issues.push({ code: "target-not-found", effectId: effect.id, value: context.secondaryTargetId });
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

  if (
    (effect.kind === "apply-status" || effect.kind === "remove-status") &&
    !effect.statusId
  ) {
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
  const targetIds = getActorTargetIds(effect, context, issues);

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

function createResolvedBase(
  card: FateKnotsExecutableCardDefinition,
  actor: FateKnotsActorState,
  prepared: PreparedEffect
): FateKnotsMechanicalResolvedEffect {
  const resolved: FateKnotsMechanicalResolvedEffect = {
    effectId: prepared.effect.id,
    cardId: card.id,
    actorId: actor.actorId,
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

function clampHp(value: number, maxHp: number): number {
  return Math.min(Math.max(value, 0), Math.max(maxHp, 0));
}

function requireWorkingActor(
  workingActors: Map<string, WorkingActorState>,
  actorId: string
): WorkingActorState {
  const actor = workingActors.get(actorId);
  if (!actor) throw new Error(`Fate Knots effect target disappeared: ${actorId}`);
  return actor;
}

function resolveActorEffect(
  card: FateKnotsExecutableCardDefinition,
  prepared: PreparedEffect,
  workingActors: Map<string, WorkingActorState>,
  patches: FateKnotsMechanicalPatch[],
  resolvedEffects: FateKnotsMechanicalResolvedEffect[]
): void {
  const effect = prepared.effect;

  for (const targetId of prepared.targetIds) {
    const target = requireWorkingActor(workingActors, targetId);
    const resolved = createResolvedBase(card, target.source, prepared);

    switch (effect.kind) {
      case "damage": {
        const value = effect.value as number;
        target.hp = clampHp(target.hp - value, target.source.maxHp);
        if (target.hp === 0) target.fallen = true;
        patches.push({
          kind: "hp",
          effectId: effect.id,
          actorId: targetId,
          delta: -value,
          nextHp: target.hp,
          nextFallen: target.fallen,
        });
        resolved.resultingHp = target.hp;
        break;
      }
      case "heal": {
        const value = effect.value as number;
        target.hp = clampHp(target.hp + value, target.source.maxHp);
        patches.push({
          kind: "hp",
          effectId: effect.id,
          actorId: targetId,
          delta: value,
          nextHp: target.hp,
          nextFallen: target.fallen,
        });
        resolved.resultingHp = target.hp;
        break;
      }
      case "shield":
        patches.push({
          kind: "shield",
          effectId: effect.id,
          actorId: targetId,
          delta: effect.value as number,
        });
        break;
      case "apply-status": {
        const statusId = effect.statusId as string;
        target.statusIds.add(statusId);
        const patch: Extract<FateKnotsMechanicalPatch, { kind: "status-add" }> = {
          kind: "status-add",
          effectId: effect.id,
          actorId: targetId,
          statusId,
        };
        if (effect.durationTurns !== undefined) patch.durationTurns = effect.durationTurns;
        patches.push(patch);
        break;
      }
      case "remove-status": {
        const statusId = effect.statusId as string;
        target.statusIds.delete(statusId);
        patches.push({
          kind: "status-remove",
          effectId: effect.id,
          actorId: targetId,
          statusId,
        });
        break;
      }
      case "move": {
        const nextPosition = applyFateKnotsPositionPatch(
          target.position,
          effect.moveTo as Partial<FateKnotsPosition>
        );
        target.position = nextPosition;
        patches.push({
          kind: "position",
          effectId: effect.id,
          actorId: targetId,
          nextPosition: clonePosition(nextPosition),
        });
        resolved.resultingPosition = clonePosition(nextPosition);
        break;
      }
      case "modify-stat":
        patches.push({
          kind: "stat",
          effectId: effect.id,
          actorId: targetId,
          statId: effect.statId as FateKnotsStatId,
          delta: effect.value as number,
        });
        break;
      case "modify-resource":
        patches.push({
          kind: "resource",
          effectId: effect.id,
          actorId: targetId,
          statId: "energy",
          delta: effect.value as number,
        });
        break;
      case "grant-card": {
        const cardId = effect.cardId as string;
        target.ownedCardIds.add(cardId);
        patches.push({ kind: "card-grant", effectId: effect.id, actorId: targetId, cardId });
        break;
      }
      case "revoke-card": {
        const cardId = effect.cardId as string;
        target.ownedCardIds.delete(cardId);
        patches.push({ kind: "card-revoke", effectId: effect.id, actorId: targetId, cardId });
        break;
      }
      case "consume": {
        const cardId = effect.cardId ?? card.id;
        target.ownedCardIds.delete(cardId);
        patches.push({ kind: "card-consume", effectId: effect.id, actorId: targetId, cardId });
        if (resolved.cardRefId === undefined) resolved.cardRefId = cardId;
        break;
      }
      case "reveal":
      case "retreat":
        throw new Error(`Non-actor Fate Knots effect reached actor resolver: ${effect.kind}`);
    }

    resolvedEffects.push(resolved);
  }
}

/**
 * Resolves a card into deterministic mechanical patches without mutating
 * canonical state. The caller is responsible for legality checks before this
 * function and for applying returned patches atomically afterward.
 *
 * Presentation cues are deliberately not resolved here. A later presentation
 * layer maps the resolved card/effect event onto animation, SFX and book UI.
 */
export function resolveFateKnotsCardEffects(
  context: FateKnotsEffectResolutionContext
): FateKnotsEffectResolutionResult {
  const issues: FateKnotsEffectResolutionIssue[] = [];
  const prepared = context.card.effects.map((effect) => prepareEffect(effect, context, issues));

  if (issues.length > 0) {
    return { resolved: false, issues, effects: [], patches: [] };
  }

  const workingActors = new Map(
    context.actors.map((actor) => [actor.actorId, createWorkingActor(actor)] as const)
  );
  if (!workingActors.has(context.actor.actorId)) {
    workingActors.set(context.actor.actorId, createWorkingActor(context.actor));
  }

  const patches: FateKnotsMechanicalPatch[] = [];
  const effects: FateKnotsMechanicalResolvedEffect[] = [];

  for (const preparedEffect of prepared) {
    if (ACTOR_EFFECT_KINDS.has(preparedEffect.effect.kind)) {
      resolveActorEffect(context.card, preparedEffect, workingActors, patches, effects);
      continue;
    }

    const resolved = createResolvedBase(context.card, context.actor, preparedEffect);
    if (preparedEffect.effect.kind === "reveal") {
      const revealId = preparedEffect.effect.revealId as string;
      patches.push({ kind: "run-reveal", effectId: preparedEffect.effect.id, revealId });
      effects.push(resolved);
      continue;
    }

    if (preparedEffect.effect.kind === "retreat") {
      patches.push({
        kind: "retreat-request",
        effectId: preparedEffect.effect.id,
        teamId: preparedEffect.teamId as FateKnotsTeamId,
      });
      effects.push(resolved);
    }
  }

  return {
    resolved: true,
    issues: [],
    effects,
    patches,
  };
}
