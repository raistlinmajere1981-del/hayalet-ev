import type { FateKnotsCombatState, FateKnotsStatId, FateKnotsTeamId } from "./contracts.js";

export type FateKnotsCombatModifierStatId = Exclude<FateKnotsStatId, "hp" | "energy">;

export interface FateKnotsCombatStatModifier {
  effectId: string;
  statId: FateKnotsCombatModifierStatId;
  delta: number;
}

export interface FateKnotsTimedStatusInstance {
  effectId: string;
  statusId: string;
  remainingTurns: number;
  appliedTurnIndex: number;
}

export interface FateKnotsCombatActorRuntimeState {
  actorId: string;
  shield: number;
  statModifiers: FateKnotsCombatStatModifier[];
  timedStatuses: FateKnotsTimedStatusInstance[];
}

/**
 * Combat-only state that must disappear when the encounter ends.
 *
 * Canonical actor state keeps HP, energy, position, owned cards and persistent
 * status ids. Temporary shields, combat-scoped stat modifiers and duration
 * bookkeeping live here so they never pollute the forged character/world data.
 */
export interface FateKnotsCombatRuntimeState {
  actorRuntime: FateKnotsCombatActorRuntimeState[];
  retreatRequestedTeamIds: FateKnotsTeamId[];
}

function cloneModifier(modifier: FateKnotsCombatStatModifier): FateKnotsCombatStatModifier {
  return { ...modifier };
}

function cloneTimedStatus(status: FateKnotsTimedStatusInstance): FateKnotsTimedStatusInstance {
  return { ...status };
}

function createActorRuntime(actorId: string): FateKnotsCombatActorRuntimeState {
  return {
    actorId,
    shield: 0,
    statModifiers: [],
    timedStatuses: [],
  };
}

export function createFateKnotsCombatRuntimeState(
  combat: FateKnotsCombatState
): FateKnotsCombatRuntimeState {
  return {
    actorRuntime: combat.actors.map((actor) => createActorRuntime(actor.actorId)),
    retreatRequestedTeamIds: [],
  };
}

export function cloneFateKnotsCombatRuntimeState(
  runtime: FateKnotsCombatRuntimeState
): FateKnotsCombatRuntimeState {
  return {
    actorRuntime: runtime.actorRuntime.map((actor) => ({
      actorId: actor.actorId,
      shield: actor.shield,
      statModifiers: actor.statModifiers.map(cloneModifier),
      timedStatuses: actor.timedStatuses.map(cloneTimedStatus),
    })),
    retreatRequestedTeamIds: runtime.retreatRequestedTeamIds.slice(),
  };
}

/**
 * Reconciles runtime bookkeeping with the canonical combat actor list without
 * inventing any new effects. Existing actor runtime is preserved; newly added
 * actors receive an empty runtime surface and removed actors disappear.
 */
export function reconcileFateKnotsCombatRuntimeState(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState
): FateKnotsCombatRuntimeState {
  const current = new Map(runtime.actorRuntime.map((actor) => [actor.actorId, actor] as const));

  return {
    actorRuntime: combat.actors.map((actor) => {
      const existing = current.get(actor.actorId);
      if (!existing) return createActorRuntime(actor.actorId);
      return {
        actorId: existing.actorId,
        shield: existing.shield,
        statModifiers: existing.statModifiers.map(cloneModifier),
        timedStatuses: existing.timedStatuses.map(cloneTimedStatus),
      };
    }),
    retreatRequestedTeamIds: runtime.retreatRequestedTeamIds.slice(),
  };
}

export function getFateKnotsCombatActorRuntime(
  runtime: FateKnotsCombatRuntimeState,
  actorId: string
): FateKnotsCombatActorRuntimeState | null {
  return runtime.actorRuntime.find((actor) => actor.actorId === actorId) ?? null;
}

export function getFateKnotsCombatStatModifierTotal(
  runtime: FateKnotsCombatRuntimeState,
  actorId: string,
  statId: FateKnotsCombatModifierStatId
): number {
  const actor = getFateKnotsCombatActorRuntime(runtime, actorId);
  if (!actor) return 0;
  return actor.statModifiers
    .filter((modifier) => modifier.statId === statId)
    .reduce((sum, modifier) => sum + modifier.delta, 0);
}

export function getFateKnotsEffectiveMaxHp(
  combat: FateKnotsCombatState,
  runtime: FateKnotsCombatRuntimeState,
  actorId: string
): number | null {
  const actor = combat.actors.find((candidate) => candidate.actorId === actorId);
  if (!actor) return null;
  return Math.max(0, actor.maxHp + getFateKnotsCombatStatModifierTotal(runtime, actorId, "maxHp"));
}
