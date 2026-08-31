import type {
  FateKnotsActorState,
  FateKnotsCombatState,
  FateKnotsStatusDefinition,
} from "./contracts.js";
import {
  cloneFateKnotsCombatRuntimeState,
  reconcileFateKnotsCombatRuntimeState,
  type FateKnotsCombatRuntimeState,
} from "./combat-runtime.js";

export type FateKnotsCombatClosureIssueCode =
  | "combat-still-active"
  | "status-definition-not-found";

export interface FateKnotsCombatClosureIssue {
  code: FateKnotsCombatClosureIssueCode;
  actorId?: string;
  statusId?: string;
}

export interface FateKnotsCombatClosureResult {
  ok: boolean;
  combat: FateKnotsCombatState;
  runtime: FateKnotsCombatRuntimeState;
  removedCombatStatusIdsByActor: Record<string, string[]>;
  issues: FateKnotsCombatClosureIssue[];
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

/**
 * Removes combat-scoped state before actor state is copied back into the run.
 *
 * V1 rule:
 * - shields and direct combat stat modifiers never leave combat
 * - any status tracked by a combat duration timer expires when combat ends
 * - non-persistent statuses also expire when combat ends
 * - only persistent statuses without a combat timer survive into run state
 *
 * A lasting wound/curse therefore has to be explicit persistent content rather
 * than an accidental leftover from a timed combat effect.
 */
export function closeFateKnotsTerminalCombat(
  combatInput: FateKnotsCombatState,
  runtimeInput: FateKnotsCombatRuntimeState,
  statuses: readonly FateKnotsStatusDefinition[]
): FateKnotsCombatClosureResult {
  const combat = cloneCombat(combatInput);
  const runtime = cloneFateKnotsCombatRuntimeState(
    reconcileFateKnotsCombatRuntimeState(combat, runtimeInput)
  );

  if (combat.result === "active") {
    return {
      ok: false,
      combat,
      runtime,
      removedCombatStatusIdsByActor: {},
      issues: [{ code: "combat-still-active" }],
    };
  }

  const statusById = new Map(statuses.map((status) => [status.id, status] as const));
  const issues: FateKnotsCombatClosureIssue[] = [];

  for (const actor of combat.actors) {
    for (const statusId of actor.statusIds) {
      if (!statusById.has(statusId)) {
        issues.push({ code: "status-definition-not-found", actorId: actor.actorId, statusId });
      }
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      combat,
      runtime,
      removedCombatStatusIdsByActor: {},
      issues,
    };
  }

  const removedCombatStatusIdsByActor: Record<string, string[]> = {};

  for (const actor of combat.actors) {
    const runtimeActor = runtime.actorRuntime.find((candidate) => candidate.actorId === actor.actorId);
    const timedIds = new Set(runtimeActor?.timedStatuses.map((status) => status.statusId) ?? []);
    const removed: string[] = [];

    actor.statusIds = actor.statusIds.filter((statusId) => {
      const definition = statusById.get(statusId);
      const combatScoped = timedIds.has(statusId) || definition?.persistent === false;
      if (combatScoped) removed.push(statusId);
      return !combatScoped;
    });

    actor.hp = Math.min(actor.hp, Math.max(actor.maxHp, 0));

    if (runtimeActor) {
      runtimeActor.shield = 0;
      runtimeActor.statModifiers = [];
      runtimeActor.timedStatuses = [];
    }

    if (removed.length > 0) {
      removedCombatStatusIdsByActor[actor.actorId] = Array.from(new Set(removed));
    }
  }

  runtime.retreatRequestedTeamIds = [];

  return {
    ok: true,
    combat,
    runtime,
    removedCombatStatusIdsByActor,
    issues: [],
  };
}
