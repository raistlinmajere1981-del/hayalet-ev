import type {
  FateKnotsActorState,
  FateKnotsCombatState,
  FateKnotsPosition,
  FateKnotsTeamId,
} from "./contracts.js";
import {
  cloneFateKnotsCombatRuntimeState,
  getFateKnotsCombatActorRuntime,
  getFateKnotsEffectiveMaxHp,
  reconcileFateKnotsCombatRuntimeState,
  type FateKnotsCombatModifierStatId,
  type FateKnotsCombatRuntimeState,
} from "./combat-runtime.js";
import type { FateKnotsMechanicalPatch } from "./effect-resolution.js";
import { applyFateKnotsPositionPatch, isFateKnotsRange, isFateKnotsRow } from "./position.js";

export type FateKnotsCombatPatchIssueCode =
  | "actor-not-found"
  | "runtime-actor-not-found"
  | "invalid-positive-amount"
  | "invalid-finite-delta"
  | "unsupported-combat-stat"
  | "invalid-position-patch"
  | "invalid-status-id"
  | "invalid-card-id"
  | "invalid-reveal-id"
  | "invalid-team-id";

export interface FateKnotsCombatPatchIssue {
  code: FateKnotsCombatPatchIssueCode;
  patchIndex: number;
  effectId: string;
  actorId?: string;
  value?: string;
}

export interface FateKnotsAppliedCombatPatch {
  patchIndex: number;
  effectId: string;
  kind: FateKnotsMechanicalPatch["kind"];
  actorId?: string;
  hpBefore?: number;
  hpAfter?: number;
  shieldBefore?: number;
  shieldAfter?: number;
  shieldAbsorbed?: number;
  energyBefore?: number;
  energyAfter?: number;
  positionBefore?: FateKnotsPosition;
  positionAfter?: FateKnotsPosition;
  fallenBefore?: boolean;
  fallenAfter?: boolean;
}

export interface FateKnotsCombatPatchApplyResult {
  ok: boolean;
  combat: FateKnotsCombatState;
  runtime: FateKnotsCombatRuntimeState;
  applied: FateKnotsAppliedCombatPatch[];
  deferredRunPatches: Extract<FateKnotsMechanicalPatch, { kind: "run-reveal" }>[];
  issues: FateKnotsCombatPatchIssue[];
}

function cloneActor(actor: FateKnotsActorState): FateKnotsActorState {
  return {
    ...actor,
    position: { ...actor.position },
    ownedCardIds: actor.ownedCardIds.slice(),
    availableCardIds: actor.availableCardIds.slice(),
    equipmentIds: actor.equipmentIds.slice(),
    statusIds: actor.statusIds.slice(),
    injuryIds: actor.injuryIds.slice(),
  };
}

function cloneCombat(combat: FateKnotsCombatState): FateKnotsCombatState {
  return {
    ...combat,
    config: { ...combat.config },
    actors: combat.actors.map(cloneActor),
    commits: combat.commits.map((commit) => ({ ...commit })),
  };
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isFiniteDelta(value: number): boolean {
  return Number.isFinite(value);
}

function isCombatModifierStat(value: string): value is FateKnotsCombatModifierStatId {
  return value === "maxHp" || value === "attack" || value === "defense" || value === "speed";
}

function hasActor(combat: FateKnotsCombatState, actorId: string): boolean {
  return combat.actors.some((actor) => actor.actorId === actorId);
}

function isTeamId(value: string): value is FateKnotsTeamId {
  return value === "party" || value === "opposition";
}

function validatePositionPatch(moveTo: Partial<FateKnotsPosition>): boolean {
  if (moveTo.row !== undefined && !isFateKnotsRow(moveTo.row)) return false;
  if (moveTo.range !== undefined && !isFateKnotsRange(moveTo.range)) return false;
  return moveTo.row !== undefined || moveTo.range !== undefined;
}

function validatePatch(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState,
  patch: FateKnotsMechanicalPatch,
  patchIndex: number
): FateKnotsCombatPatchIssue[] {
  const issues: FateKnotsCombatPatchIssue[] = [];

  if (
    patch.kind !== "run-reveal" &&
    patch.kind !== "retreat-request" &&
    !hasActor(combat, patch.actorId)
  ) {
    issues.push({
      code: "actor-not-found",
      patchIndex,
      effectId: patch.effectId,
      actorId: patch.actorId,
    });
    return issues;
  }

  if (
    patch.kind !== "run-reveal" &&
    patch.kind !== "retreat-request" &&
    !getFateKnotsCombatActorRuntime(runtime, patch.actorId)
  ) {
    issues.push({
      code: "runtime-actor-not-found",
      patchIndex,
      effectId: patch.effectId,
      actorId: patch.actorId,
    });
  }

  switch (patch.kind) {
    case "damage":
    case "heal":
    case "shield":
      if (!isPositiveFinite(patch.amount)) {
        issues.push({ code: "invalid-positive-amount", patchIndex, effectId: patch.effectId });
      }
      break;
    case "stat":
      if (!isFiniteDelta(patch.delta)) {
        issues.push({ code: "invalid-finite-delta", patchIndex, effectId: patch.effectId });
      }
      if (!isCombatModifierStat(patch.statId)) {
        issues.push({
          code: "unsupported-combat-stat",
          patchIndex,
          effectId: patch.effectId,
          actorId: patch.actorId,
          value: patch.statId,
        });
      }
      break;
    case "resource":
      if (!isFiniteDelta(patch.delta)) {
        issues.push({ code: "invalid-finite-delta", patchIndex, effectId: patch.effectId });
      }
      break;
    case "position":
      if (!validatePositionPatch(patch.moveTo)) {
        issues.push({ code: "invalid-position-patch", patchIndex, effectId: patch.effectId });
      }
      break;
    case "status-add":
    case "status-remove":
      if (patch.statusId.trim() === "") {
        issues.push({ code: "invalid-status-id", patchIndex, effectId: patch.effectId });
      }
      break;
    case "card-grant":
    case "card-revoke":
    case "card-consume":
      if (patch.cardId.trim() === "") {
        issues.push({ code: "invalid-card-id", patchIndex, effectId: patch.effectId });
      }
      break;
    case "run-reveal":
      if (patch.revealId.trim() === "") {
        issues.push({ code: "invalid-reveal-id", patchIndex, effectId: patch.effectId });
      }
      break;
    case "retreat-request":
      if (!isTeamId(patch.teamId)) {
        issues.push({ code: "invalid-team-id", patchIndex, effectId: patch.effectId });
      }
      break;
  }

  return issues;
}

function getActorOrThrow(combat: FateKnotsCombatState, actorId: string): FateKnotsActorState {
  const actor = combat.actors.find((candidate) => candidate.actorId === actorId);
  if (!actor) throw new Error(`Fate Knots combat actor disappeared: ${actorId}`);
  return actor;
}

function getRuntimeActorOrThrow(runtime: FateKnotsCombatRuntimeState, actorId: string) {
  const actor = getFateKnotsCombatActorRuntime(runtime, actorId);
  if (!actor) throw new Error(`Fate Knots combat runtime actor disappeared: ${actorId}`);
  return actor;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function removeOneString(values: readonly string[], value: string): string[] {
  const index = values.indexOf(value);
  if (index < 0) return values.slice();
  return [...values.slice(0, index), ...values.slice(index + 1)];
}

function refreshTimedStatus(
  combat: FateKnotsCombatState,
  runtimeActor: ReturnType<typeof getRuntimeActorOrThrow>,
  effectId: string,
  statusId: string,
  durationTurns: number
): void {
  const existing = runtimeActor.timedStatuses.find((status) => status.statusId === statusId);
  if (existing) {
    existing.effectId = effectId;
    existing.remainingTurns = Math.max(existing.remainingTurns, durationTurns);
    existing.appliedTurnIndex = combat.turnIndex;
    return;
  }

  runtimeActor.timedStatuses.push({
    effectId,
    statusId,
    remainingTurns: durationTurns,
    appliedTurnIndex: combat.turnIndex,
  });
}

function applyActorPatch(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState,
  patch: Exclude<FateKnotsMechanicalPatch, { kind: "run-reveal" } | { kind: "retreat-request" }>,
  patchIndex: number
): FateKnotsAppliedCombatPatch {
  const actor = getActorOrThrow(combat, patch.actorId);
  const runtimeActor = getRuntimeActorOrThrow(runtime, patch.actorId);
  const applied: FateKnotsAppliedCombatPatch = {
    patchIndex,
    effectId: patch.effectId,
    kind: patch.kind,
    actorId: patch.actorId,
  };

  switch (patch.kind) {
    case "damage": {
      applied.hpBefore = actor.hp;
      applied.shieldBefore = runtimeActor.shield;
      applied.fallenBefore = actor.fallen;
      const absorbed = Math.min(runtimeActor.shield, patch.amount);
      runtimeActor.shield -= absorbed;
      actor.hp = Math.max(0, actor.hp - (patch.amount - absorbed));
      if (actor.hp === 0) actor.fallen = true;
      applied.shieldAbsorbed = absorbed;
      applied.shieldAfter = runtimeActor.shield;
      applied.hpAfter = actor.hp;
      applied.fallenAfter = actor.fallen;
      break;
    }
    case "heal": {
      applied.hpBefore = actor.hp;
      applied.fallenBefore = actor.fallen;
      const effectiveMaxHp =
        getFateKnotsEffectiveMaxHp(combat, runtime, actor.actorId) ?? actor.maxHp;
      actor.hp = Math.min(effectiveMaxHp, Math.max(0, actor.hp + patch.amount));
      applied.hpAfter = actor.hp;
      applied.fallenAfter = actor.fallen;
      break;
    }
    case "shield":
      applied.shieldBefore = runtimeActor.shield;
      runtimeActor.shield += patch.amount;
      applied.shieldAfter = runtimeActor.shield;
      break;
    case "status-add":
      actor.statusIds = uniqueStrings([...actor.statusIds, patch.statusId]);
      if (patch.durationTurns !== undefined && patch.durationTurns > 0) {
        refreshTimedStatus(
          combat,
          runtimeActor,
          patch.effectId,
          patch.statusId,
          patch.durationTurns
        );
      }
      break;
    case "status-remove":
      actor.statusIds = actor.statusIds.filter((statusId) => statusId !== patch.statusId);
      runtimeActor.timedStatuses = runtimeActor.timedStatuses.filter(
        (status) => status.statusId !== patch.statusId
      );
      break;
    case "position":
      applied.positionBefore = { ...actor.position };
      actor.position = applyFateKnotsPositionPatch(actor.position, patch.moveTo);
      applied.positionAfter = { ...actor.position };
      break;
    case "stat": {
      runtimeActor.statModifiers.push({
        effectId: patch.effectId,
        statId: patch.statId as FateKnotsCombatModifierStatId,
        delta: patch.delta,
      });
      if (patch.statId === "maxHp") {
        applied.hpBefore = actor.hp;
        applied.fallenBefore = actor.fallen;
        const effectiveMaxHp =
          getFateKnotsEffectiveMaxHp(combat, runtime, actor.actorId) ?? actor.maxHp;
        actor.hp = Math.min(actor.hp, effectiveMaxHp);
        if (actor.hp === 0) actor.fallen = true;
        applied.hpAfter = actor.hp;
        applied.fallenAfter = actor.fallen;
      }
      break;
    }
    case "resource":
      applied.energyBefore = actor.energy;
      actor.energy = Math.max(0, actor.energy + patch.delta);
      applied.energyAfter = actor.energy;
      break;
    case "card-grant":
      actor.ownedCardIds = uniqueStrings([...actor.ownedCardIds, patch.cardId]);
      break;
    case "card-revoke":
      actor.ownedCardIds = actor.ownedCardIds.filter((cardId) => cardId !== patch.cardId);
      break;
    case "card-consume":
      actor.ownedCardIds = removeOneString(actor.ownedCardIds, patch.cardId);
      break;
  }

  return applied;
}

/**
 * Applies an ordered card-resolution patch batch as one atomic combat update.
 * Any invalid patch rejects the entire batch and returns untouched clones.
 *
 * `run-reveal` patches are deliberately deferred to the run authority. A
 * retreat patch records only that the team requested retreat; deciding whether
 * that request ends combat belongs to terminal combat-result evaluation.
 */
export function applyFateKnotsCombatPatches(
  combat: FateKnotsCombatState,
  runtimeInput: FateKnotsCombatRuntimeState,
  patches: readonly FateKnotsMechanicalPatch[]
): FateKnotsCombatPatchApplyResult {
  const runtime = reconcileFateKnotsCombatRuntimeState(combat, runtimeInput);
  const issues = patches.flatMap((patch, patchIndex) =>
    validatePatch(combat, runtime, patch, patchIndex)
  );

  if (issues.length > 0) {
    return {
      ok: false,
      combat: cloneCombat(combat),
      runtime: cloneFateKnotsCombatRuntimeState(runtime),
      applied: [],
      deferredRunPatches: [],
      issues,
    };
  }

  const nextCombat = cloneCombat(combat);
  const nextRuntime = cloneFateKnotsCombatRuntimeState(runtime);
  const applied: FateKnotsAppliedCombatPatch[] = [];
  const deferredRunPatches: Extract<FateKnotsMechanicalPatch, { kind: "run-reveal" }>[] = [];

  patches.forEach((patch, patchIndex) => {
    if (patch.kind === "run-reveal") {
      deferredRunPatches.push({ ...patch });
      return;
    }

    if (patch.kind === "retreat-request") {
      if (!nextRuntime.retreatRequestedTeamIds.includes(patch.teamId)) {
        nextRuntime.retreatRequestedTeamIds.push(patch.teamId);
      }
      applied.push({
        patchIndex,
        effectId: patch.effectId,
        kind: patch.kind,
      });
      return;
    }

    applied.push(applyActorPatch(nextCombat, nextRuntime, patch, patchIndex));
  });

  return {
    ok: true,
    combat: nextCombat,
    runtime: nextRuntime,
    applied,
    deferredRunPatches,
    issues: [],
  };
}
