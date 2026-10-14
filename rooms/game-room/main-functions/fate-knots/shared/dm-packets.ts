import type {
  FateKnotsCombatResultPackage,
  FateKnotsCombatState,
  FateKnotsDmScenePacket,
  FateKnotsResolvedEffect,
  FateKnotsRunState,
} from "./contracts.js";

export type FateKnotsDmPacketIssueCode =
  | "run-not-active"
  | "dm-disallowed-during-combat"
  | "party-actor-not-found"
  | "combat-not-terminal";

export interface FateKnotsDmPacketIssue {
  code: FateKnotsDmPacketIssueCode;
  actorId?: string;
}

export interface FateKnotsDmScenePacketBuildResult {
  ok: boolean;
  packet: FateKnotsDmScenePacket | null;
  issues: FateKnotsDmPacketIssue[];
}

export interface FateKnotsCombatResultPacketBuildResult {
  ok: boolean;
  packet: FateKnotsCombatResultPackage | null;
  issues: FateKnotsDmPacketIssue[];
}

export interface FateKnotsDmScenePacketContext {
  visibleFacts: readonly string[];
  availableTransitionIds: readonly string[];
  engineResultSummary?: FateKnotsCombatResultPackage | null;
}

export interface FateKnotsCombatResultPacketContext {
  resolvedEffects: readonly FateKnotsResolvedEffect[];
  narrativeFacts: readonly string[];
  lootSourceId?: string | null;
}

function uniqueTrimmed(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isCombatPhase(phase: FateKnotsRunState["phase"]): boolean {
  return (
    phase === "combat-discussion" ||
    phase === "combat-commit" ||
    phase === "combat-resolution" ||
    phase === "combat-aftermath"
  );
}

function cloneResolvedEffect(effect: FateKnotsResolvedEffect): FateKnotsResolvedEffect {
  const next: FateKnotsResolvedEffect = {
    ...effect,
    targetIds: effect.targetIds.slice(),
    presentationCueIds: effect.presentationCueIds.slice(),
  };
  if (effect.resultingPosition) next.resultingPosition = { ...effect.resultingPosition };
  return next;
}

/**
 * Builds the compact terminal combat package AI1 may receive after the engine
 * has finished combat. The builder never asks AI1 to infer victory, fallen state
 * or turn count from prose.
 */
export function buildFateKnotsCombatResultPackage(
  combat: FateKnotsCombatState,
  context: FateKnotsCombatResultPacketContext
): FateKnotsCombatResultPacketBuildResult {
  if (combat.result === "active") {
    return { ok: false, packet: null, issues: [{ code: "combat-not-terminal" }] };
  }

  const fallenActorIds = combat.actors
    .filter((actor) => actor.fallen)
    .map((actor) => actor.actorId);
  const survivingActorIds = combat.actors
    .filter((actor) => !actor.fallen)
    .map((actor) => actor.actorId);

  const packet: FateKnotsCombatResultPackage = {
    combatId: combat.combatId,
    result: combat.result,
    turns: combat.turnIndex + 1,
    fallenActorIds,
    survivingActorIds,
    resolvedEffects: context.resolvedEffects.map(cloneResolvedEffect),
    narrativeFacts: uniqueTrimmed(context.narrativeFacts),
  };

  if (context.lootSourceId !== undefined) packet.lootSourceId = context.lootSourceId;

  return { ok: true, packet, issues: [] };
}

/**
 * Builds the bounded AI1 scene packet from player-visible engine facts only.
 * It deliberately refuses combat phases so AI1 cannot drift back into the
 * per-action combat loop through a generic narration call.
 */
export function buildFateKnotsDmScenePacket(
  run: FateKnotsRunState,
  context: FateKnotsDmScenePacketContext
): FateKnotsDmScenePacketBuildResult {
  if (run.result !== "active" && run.phase !== "completed" && run.phase !== "failed") {
    return { ok: false, packet: null, issues: [{ code: "run-not-active" }] };
  }

  if (isCombatPhase(run.phase)) {
    return { ok: false, packet: null, issues: [{ code: "dm-disallowed-during-combat" }] };
  }

  const actorById = new Map(run.actors.map((actor) => [actor.actorId, actor] as const));
  const issues: FateKnotsDmPacketIssue[] = [];
  const playerSummaries: FateKnotsDmScenePacket["playerSummaries"] = [];

  for (const actorId of run.partyActorIds) {
    const actor = actorById.get(actorId);
    if (!actor) {
      issues.push({ code: "party-actor-not-found", actorId });
      continue;
    }
    playerSummaries.push({
      actorId: actor.actorId,
      characterId: actor.characterId,
      hp: actor.hp,
      maxHp: actor.maxHp,
      statusIds: actor.statusIds.slice(),
      injuryIds: actor.injuryIds.slice(),
    });
  }

  if (issues.length > 0) return { ok: false, packet: null, issues };

  const packet: FateKnotsDmScenePacket = {
    universeId: run.universeId,
    runId: run.runId,
    phase: run.phase,
    locationId: run.activeLocationId,
    visibleFacts: uniqueTrimmed(context.visibleFacts),
    playerSummaries,
    availableTransitionIds: uniqueTrimmed(context.availableTransitionIds),
  };

  if (context.engineResultSummary !== undefined) {
    packet.engineResultSummary = context.engineResultSummary
      ? {
          ...context.engineResultSummary,
          fallenActorIds: context.engineResultSummary.fallenActorIds.slice(),
          survivingActorIds: context.engineResultSummary.survivingActorIds.slice(),
          resolvedEffects: context.engineResultSummary.resolvedEffects.map(cloneResolvedEffect),
          narrativeFacts: context.engineResultSummary.narrativeFacts.slice(),
        }
      : null;
  }

  return { ok: true, packet, issues: [] };
}
